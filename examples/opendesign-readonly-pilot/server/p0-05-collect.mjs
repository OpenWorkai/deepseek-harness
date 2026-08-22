#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

const SCRIPT_PATH = fileURLToPath(import.meta.url)
const PILOT_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..')
const DSH_ROOT = path.resolve(PILOT_ROOT, '..', '..')

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const openWorkRepo = required(args, '--openwork', process.env.OPENWORK_REPO)
  const openDesignRepo = required(args, '--opendesign', process.env.OPENDESIGN_REPO)
  const dataDir = path.resolve(required(args, '--data-dir', process.env.OD_DATA_DIR))
  const goldenId = required(args, '--golden-id', process.env.OPENDESIGN_GOLDEN_ID)
  const daemonNode = path.resolve(args.get('--node') || process.env.OPENDESIGN_NODE || process.execPath)
  const outputDir = path.resolve(args.get('--output-dir') || path.join(PILOT_ROOT, 'evidence'))
  const reads = positiveInt(args.get('--reads'), 20)
  const concurrency = positiveInt(args.get('--concurrency'), 20)
  const warmup = nonNegativeInt(args.get('--warmup'), 2)
  const port = args.has('--port') ? positiveInt(args.get('--port'), 7456) : await findFreePort()
  const baseUrl = `http://127.0.0.1:${port}`
  const daemonEntry = path.join(openDesignRepo, 'apps', 'daemon', 'dist', 'cli.js')
  const openWorkOutput = path.join(outputDir, 'p0-05-openwork.json')
  const openWorkFallbackOutput = path.join(outputDir, 'p0-05-openwork-after-dsh.json')
  const dshOutput = path.join(outputDir, 'p0-05-dsh.json')
  const comparisonOutput = path.join(outputDir, 'p0-05-comparison.json')

  await mkdir(outputDir, { recursive: true })
  const [openWorkCommit, openDesignCommit, dshCommit] = await Promise.all([
    gitCommit(openWorkRepo),
    gitCommit(openDesignRepo),
    gitCommit(DSH_ROOT),
  ])

  await runOpenWorkProbe({
    openWorkRepo,
    dataDir,
    daemonEntry,
    daemonNode,
    goldenId,
    output: openWorkOutput,
    openWorkCommit,
    openDesignCommit,
    reads,
    concurrency,
    warmup,
  })
  const openWork = JSON.parse(await readFile(openWorkOutput, 'utf8'))

  const daemon = spawn(
    daemonNode,
    [daemonEntry, '--host', '127.0.0.1', '--port', String(port), '--no-open'],
    {
      cwd: path.dirname(path.dirname(daemonEntry)),
      env: {
        ...process.env,
        OD_DATA_DIR: dataDir,
        OD_BIND_HOST: '127.0.0.1',
        OD_PORT: String(port),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  let daemonStderr = ''
  daemon.stderr.on('data', (chunk) => {
    daemonStderr += chunk.toString()
  })

  let dsh
  try {
    await waitForHealth(baseUrl, daemon, () => daemonStderr)
    const result = await run(
      process.execPath,
      [
        path.join(PILOT_ROOT, 'server', 'baseline-harness.mjs'),
        '--lists',
        String(reads),
        '--gets',
        String(reads),
        '--concurrency',
        String(concurrency),
        '--warmup',
        String(warmup),
        '--json',
      ],
      {
        cwd: DSH_ROOT,
        env: {
          ...process.env,
          OPENDESIGN_BASE_URL: baseUrl,
          OPENDESIGN_GOLDEN_ID: goldenId,
        },
        capture: true,
      },
    )
    dsh = JSON.parse(result.stdout.trim())
    dsh.meta.dshCommit = dshCommit
    dsh.meta.openDesignCommit = openDesignCommit
    dsh.meta.dataDir = dataDir
    await writeFile(dshOutput, `${JSON.stringify(dsh, null, 2)}\n`, 'utf8')
  } finally {
    await stopProcess(daemon)
  }

  await runOpenWorkProbe({
    openWorkRepo,
    dataDir,
    daemonEntry,
    daemonNode,
    goldenId,
    output: openWorkFallbackOutput,
    openWorkCommit,
    openDesignCommit,
    reads: 1,
    concurrency: 1,
    warmup: 0,
  })
  const openWorkFallback = JSON.parse(await readFile(openWorkFallbackOutput, 'utf8'))

  const comparison = compareReports(
    openWork,
    dsh,
    {
      generatedAt: new Date().toISOString(),
      openWorkCommit,
      openDesignCommit,
      dshCommit,
      dataDir,
      goldenId,
    },
    openWorkFallback,
  )
  await writeFile(comparisonOutput, `${JSON.stringify(comparison, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ output: comparisonOutput, decision: comparison.decision }, null, 2))
}

export function compareReports(openWork, dsh, meta = {}, openWorkFallback) {
  const listDiff = diffFields(openWork?.sample?.listGolden, dsh?.sample?.listGolden)
  const getDiff = diffFields(openWork?.sample?.getGolden, dsh?.sample?.getGolden)
  const dshErrorsClassified = Object.values(dsh?.errors || {}).every((entry) => entry?.classified === true)
  const checks = {
    sameGoldenId:
      Boolean(openWork?.meta?.goldenId) && openWork.meta.goldenId === dsh?.meta?.goldenId,
    sameDataDir:
      Boolean(openWork?.meta?.dataDir) && openWork.meta.dataDir === dsh?.meta?.dataDir,
    listFieldsMatch: listDiff.length === 0,
    getFieldsMatch: getDiff.length === 0,
    openWorkReadsSucceeded:
      openWork?.golden?.list?.successRate === 100 && openWork?.golden?.get?.successRate === 100,
    dshReadsSucceeded: dsh?.golden?.list?.successRate === 100 && dsh?.golden?.get?.successRate === 100,
    concurrencySucceeded:
      openWork?.concurrency?.successRate === 100 && dsh?.concurrency?.successRate === 100,
    openWorkRecovered:
      openWork?.recovery?.restarted === true && openWork?.recovery?.firstReadSucceeded === true,
    dshRecovered:
      dsh?.recovery?.readyAfterRestart === true && dsh?.recovery?.firstReadSucceeded === true,
    openWorkErrorsClassified: openWork?.errors?.notFound?.classified === true,
    dshErrorsClassified,
    exactDshReadOnlyTools: dsh?.discovery?.exactReadOnlySet === true,
    fallbackAfterDshSucceeded:
      openWorkFallback?.meta?.dataDir === openWork?.meta?.dataDir &&
      openWorkFallback?.meta?.goldenId === openWork?.meta?.goldenId &&
      openWorkFallback?.golden?.list?.successRate === 100 &&
      openWorkFallback?.golden?.get?.successRate === 100 &&
      openWorkFallback?.errors?.notFound?.classified === true,
  }
  const goEligible = Object.values(checks).every(Boolean)
  return {
    meta,
    decision: goEligible ? 'P0-05-PASS' : 'P0-05-HOLD',
    goEligible,
    checks,
    differences: { list: listDiff, get: getDiff },
    thresholds: {
      openWork: thresholdInputs(openWork),
      dsh: thresholdInputs(dsh),
    },
    limits: [
      'P0-05-PASS is not an overall Phase 0 GO.',
      'P0-07 owner approval and frozen Phase 1 thresholds remain separate gates.',
      'Resource scopes differ and must not be combined into one process-wide overhead number.',
    ],
  }
}

async function runOpenWorkProbe({
  openWorkRepo,
  dataDir,
  daemonEntry,
  daemonNode,
  goldenId,
  output,
  openWorkCommit,
  openDesignCommit,
  reads,
  concurrency,
  warmup,
}) {
  await run(
    'pnpm',
    [
      'exec',
      'playwright',
      'test',
      '--config',
      'playwright.config.ts',
      'tests/e2e/features/art-design/opendesign-p0-05.e2e.ts',
      '--reporter=list',
    ],
    {
      cwd: openWorkRepo,
      env: {
        ...process.env,
        E2E_DEV: '1',
        OD_DATA_DIR: dataDir,
        OPENWORK_OPENDESIGN_DAEMON_BIN: daemonEntry,
        OPENWORK_OPENDESIGN_DAEMON_RUNTIME: daemonNode,
        OPENDESIGN_GOLDEN_ID: goldenId,
        P0_05_OPENWORK_OUTPUT: output,
        P0_05_OPENWORK_COMMIT: openWorkCommit,
        P0_05_OPENDESIGN_COMMIT: openDesignCommit,
        P0_05_READS: String(reads),
        P0_05_CONCURRENCY: String(concurrency),
        P0_05_WARMUP: String(warmup),
      },
    },
  )
}

function thresholdInputs(report) {
  return {
    listP95Ms: report?.latency?.listMs?.p95 ?? null,
    listP99Ms: report?.latency?.listMs?.p99 ?? null,
    getP95Ms: report?.latency?.getMs?.p95 ?? null,
    getP99Ms: report?.latency?.getMs?.p99 ?? null,
    concurrency: report?.concurrency ?? null,
    rssDeltaMiB: report?.resources?.rssDeltaMiB ?? null,
    restartToReadyMs: report?.recovery?.restartToReadyMs ?? null,
    restartToFirstReadMs: report?.recovery?.restartToFirstReadMs ?? null,
  }
}

function diffFields(left, right) {
  const leftRecord = isRecord(left) ? left : {}
  const rightRecord = isRecord(right) ? right : {}
  const keys = [...new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)])].sort()
  return keys
    .filter((key) => !isDeepStrictEqual(leftRecord[key], rightRecord[key]))
    .map((key) => ({ key, openWork: leftRecord[key] ?? null, dsh: rightRecord[key] ?? null }))
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function parseArgs(argv) {
  const args = new Map()
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index]
    if (!key.startsWith('--')) throw new Error(`unexpected argument: ${key}`)
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${key}`)
    args.set(key, value)
    index += 1
  }
  return args
}

function required(args, key, fallback) {
  const value = args.get(key) || fallback
  if (!value?.trim()) throw new Error(`${key} is required`)
  return value.trim()
}

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(value || String(fallback), 10)
  if (!Number.isFinite(parsed) || parsed < 1) throw new Error('count must be a positive integer')
  return parsed
}

function nonNegativeInt(value, fallback) {
  const parsed = Number.parseInt(value || String(fallback), 10)
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error('warmup must be a non-negative integer')
  return parsed
}

async function gitCommit(repo) {
  const result = await run('git', ['rev-parse', 'HEAD'], { cwd: repo, capture: true })
  return result.stdout.trim()
}

async function run(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env || process.env,
      stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolve({ stdout, stderr })
      else reject(new Error(`${command} exited with ${code ?? signal}${stderr ? `: ${stderr.trim()}` : ''}`))
    })
  })
}

async function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close(() => {
        if (typeof address === 'object' && address?.port) resolve(address.port)
        else reject(new Error('unable to allocate a loopback port'))
      })
    })
  })
}

async function waitForHealth(baseUrl, child, getStderr) {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`OpenDesign daemon exited before ready: ${getStderr().trim()}`)
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`)
      if (response.ok) return
    } catch {
      // The daemon has not bound the port yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`OpenDesign daemon health timed out: ${getStderr().trim()}`)
}

async function stopProcess(child) {
  if (child.exitCode !== null) return
  child.kill('SIGTERM')
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ])
  if (child.exitCode === null) child.kill('SIGKILL')
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
