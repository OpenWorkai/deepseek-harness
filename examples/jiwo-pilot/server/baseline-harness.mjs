#!/usr/bin/env node
// baseline-harness.mjs
// ---------------------------------------------------------------------------
// Phase 0 baseline collector for the Jiwo → DSH pilot (MIGRATION_JIWO.md §5/§6).
//
// Speaks REAL newline-delimited JSON-RPC 2.0 to an MCP server that implements
// the Jiwo tool contract (jiwo_read_note / arkme_record_create). It defaults to
// the in-repo stub for a *reference* baseline, and can target the real Jiwo
// endpoint by setting JIWO_SERVER_CMD.
//
// This tool answers §5 gate (4): "record the current baseline of the candidate
// slice — success rate, error types, p50/p95 latency, peak concurrency,
// recovery time." It does NOT itself decide the §6 acceptance thresholds; it
// produces the measurements those thresholds get calibrated against.
//
// Metrics:
//   1. success rate      - golden read + confirmed write, expected ~100%.
//   2. error distribution - missing note / unconfirmed / empty text / missing
//                           text / unknown, each must surface as isError:true (§6).
//   3. latency p50/p95    - separate read and write percentiles (warmup-excluded).
//   4. concurrency        - N concurrent reads from one client; ops/sec + error%.
//   5. recovery time      - kill + restart -> ready + first successful read,
//                           and confirm a pre-restart write persisted.
//
// Output: human-readable summary to stdout; --json emits a machine object.
// The stub numbers are explicitly NOT production baselines (see PHASE0.md §4/§6).
// ---------------------------------------------------------------------------

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'

// --- CLI / env -------------------------------------------------------------
const argv = process.argv.slice(2)
function flag(name, def) {
  const i = argv.indexOf(name)
  if (i >= 0 && i + 1 < argv.length) return argv[i + 1]
  return def
}
const READS = Math.max(1, parseInt(flag('--reads', '200'), 10))
const WRITES = Math.max(1, parseInt(flag('--writes', '100'), 10))
const CONCURRENCY = Math.max(1, parseInt(flag('--concurrency', '200'), 10))
const WARMUP = Math.max(0, parseInt(flag('--warmup', '5'), 10))
const CALL_TIMEOUT = 15000
const STUB_PATH = fileURLToPath(new URL('./jiwo-stub-server.mjs', import.meta.url))

// Resolve the server command. Custom endpoints are run via `sh -c` so the
// caller can supply any shell command + args. The default uses the in-repo
// dependency-free stub, which is what makes this script runnable with zero
// setup today.
const customCmd = process.env.JIWO_SERVER_CMD
const serverCmd = customCmd ? ['sh', '-c', customCmd] : [process.execPath, STUB_PATH]

// Isolate the store so the baseline never mutates the committed gitignored file.
const DATA_FILE = path.join(
  os.tmpdir(),
  `jiwo-baseline-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`,
)
const serverEnv = { ...process.env, JIWO_DATA_FILE: DATA_FILE }

// --- JSON-RPC client over stdio --------------------------------------------
class McpClient {
  constructor(cmd) {
    this.proc = spawn(cmd[0], cmd.slice(1), {
      env: serverEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    this.buf = ''
    this.nextId = 1
    this.pending = new Map()
    this.ready = false
    this.proc.stderr.on('data', (d) => {
      if (!this.ready && d.toString().includes('ready')) this.ready = true
    })
    this.proc.stdout.on('data', (d) => {
      this.buf += d.toString()
      let idx
      while ((idx = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, idx).trim()
        this.buf = this.buf.slice(idx + 1)
        if (!line) continue
        let msg
        try {
          msg = JSON.parse(line)
        } catch {
          continue
        }
        if (msg.id !== undefined && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id)
          this.pending.delete(msg.id)
          if (msg.error) reject(Object.assign(new Error(msg.error.message || 'rpc'), { rpc: msg.error }))
          else resolve(msg.result)
        }
      }
    })
    this.proc.on('exit', () => {
      for (const { reject } of this.pending.values()) reject(new Error('server exited'))
      this.pending.clear()
    })
  }

  call(method, params) {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error(`timeout: ${method}`))
        }
      }, CALL_TIMEOUT)
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer)
          resolve(v)
        },
        reject: (e) => {
          clearTimeout(timer)
          reject(e)
        },
      })
      this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
    })
  }

  notify(method, params) {
    this.proc.stdin.write(
      JSON.stringify({ jsonrpc: '2.0', method, params: params || {} }) + '\n',
    )
  }

  async waitReady(timeoutMs = 20000) {
    const deadline = Date.now() + timeoutMs
    // Prefer the server's explicit readiness signal. The stub emits "ready"
    // on stderr ONLY after its async loadAll() (JSONL read) finishes, so waiting
    // for it guarantees the store is fully loaded before we issue any call.
    // Generic servers without such a signal fall through to initialize-polling.
    while (Date.now() < deadline) {
      if (this.ready) {
        await this.call('initialize', {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'baseline-harness', version: '0' },
        })
        this.notify('notifications/initialized', {})
        return true
      }
      await new Promise((r) => setTimeout(r, 30))
    }
    try {
      await this.call('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'baseline-harness', version: '0' },
      })
      this.notify('notifications/initialized', {})
      return true
    } catch {
      return false
    }
  }

  kill() {
    try {
      this.proc.kill()
    } catch {
      /* already gone */
    }
  }
}

// --- helpers ---------------------------------------------------------------
function percentile(sortedMs, p) {
  if (sortedMs.length === 0) return null
  const idx = Math.min(sortedMs.length - 1, Math.floor((p / 100) * sortedMs.length))
  return Number(sortedMs[idx].toFixed(3))
}

function nowMs() {
  return Number(process.hrtime.bigint() / 1000000n)
}

// --- main ------------------------------------------------------------------
const report = {
  meta: {
    generatedAt: new Date().toISOString(),
    server: customCmd ? `JIWO_SERVER_CMD (${customCmd})` : `in-repo stub (${path.basename(STUB_PATH)})`,
    isStubReference: !customCmd,
    config: { reads: READS, writes: WRITES, concurrency: CONCURRENCY, warmup: WARMUP },
  },
  disclaimer:
    'STUB-REFERENCE NUMBERS ONLY — not a production baseline. Replace JIWO_SERVER_CMD with the real Arkme endpoint to collect fidelity numbers.',
  golden: { reads: {}, writes: {} },
  errors: {},
  latency: { readMs: {}, writeMs: {} },
  concurrency: {},
  recovery: {},
}

const client = new McpClient(serverCmd)
const okReady = await client.waitReady()
if (!okReady) {
  console.error('FAIL: server did not become ready')
  process.exit(1)
}

// 1+2. Golden success rate + error distribution ------------------------------
const goldenReadOk = { ok: 0, err: 0 }
const goldenWriteOk = { ok: 0, err: 0 }
const errorCounts = {}
const errorLatencies = [] // errors still have latency; tracked separately

// warmup reads
for (let i = 0; i < WARMUP; i++) {
  await client.call('tools/call', { name: 'jiwo_read_note', arguments: { noteId: 'note-1' } })
}

// golden reads (latency captured)
const readLatencies = []
for (let i = 0; i < READS; i++) {
  const t0 = nowMs()
  const r = await client.call('tools/call', {
    name: 'jiwo_read_note',
    arguments: { noteId: 'note-' + ((i % 3) + 1) },
  })
  readLatencies.push(nowMs() - t0)
  if (r && !r.isError) goldenReadOk.ok++
  else goldenReadOk.err++
}

// golden confirmed writes (unique text to exercise the persist path)
const writeLatencies = []
for (let i = 0; i < WRITES; i++) {
  const text = `bl-${Date.now().toString(36)}-${i}`
  const t0 = nowMs()
  const r = await client.call('tools/call', {
    name: 'arkme_record_create',
    arguments: { text, confirmed: true },
  })
  writeLatencies.push(nowMs() - t0)
  if (r && !r.isError) goldenWriteOk.ok++
  else goldenWriteOk.err++
}

// error-distribution workload (each must return isError:true)
const errorCases = [
  { label: 'missing_note_read', call: { name: 'jiwo_read_note', arguments: { noteId: 'does-not-exist' } } },
  { label: 'unconfirmed_write', call: { name: 'arkme_record_create', arguments: { text: 'x', confirmed: false } } },
  { label: 'missing_confirmed_write', call: { name: 'arkme_record_create', arguments: { text: 'x' } } },
  { label: 'empty_text_write', call: { name: 'arkme_record_create', arguments: { text: '   ', confirmed: true } } },
  { label: 'missing_text_write', call: { name: 'arkme_record_create', arguments: { confirmed: true } } },
]
const ERROR_REPEAT = 10
for (const c of errorCases) {
  let surfaced = 0
  for (let i = 0; i < ERROR_REPEAT; i++) {
    const r = await client.call('tools/call', c.call)
    if (r && r.isError) surfaced++
  }
  errorCounts[c.label] = { attempts: ERROR_REPEAT, surfacedAsError: surfaced, visible: surfaced === ERROR_REPEAT }
}

report.golden.reads = {
  total: READS,
  ok: goldenReadOk.ok,
  err: goldenReadOk.err,
  successRate: Number(((goldenReadOk.ok / READS) * 100).toFixed(2)),
}
report.golden.writes = {
  total: WRITES,
  ok: goldenWriteOk.ok,
  err: goldenWriteOk.err,
  successRate: Number(((goldenWriteOk.ok / WRITES) * 100).toFixed(2)),
}
report.errors = errorCounts

// 3. latency percentiles ----------------------------------------------------
const rSorted = [...readLatencies].sort((a, b) => a - b)
const wSorted = [...writeLatencies].sort((a, b) => a - b)
report.latency.readMs = {
  samples: rSorted.length,
  min: Number(rSorted[0].toFixed(3)),
  p50: percentile(rSorted, 50),
  p95: percentile(rSorted, 95),
  max: Number(rSorted[rSorted.length - 1].toFixed(3)),
}
report.latency.writeMs = {
  samples: wSorted.length,
  min: Number(wSorted[0].toFixed(3)),
  p50: percentile(wSorted, 50),
  p95: percentile(wSorted, 95),
  max: Number(wSorted[wSorted.length - 1].toFixed(3)),
}

// 4. peak concurrency (single client process, N in-flight reads) -------------
const before = nowMs()
const conPromises = []
for (let i = 0; i < CONCURRENCY; i++) {
  conPromises.push(
    client.call('tools/call', { name: 'jiwo_read_note', arguments: { noteId: 'note-1' } }),
  )
}
const conResults = await Promise.allSettled(conPromises)
const elapsed = nowMs() - before
const conOk = conResults.filter((p) => p.status === 'fulfilled' && !p.value.isError).length
const conErr = conResults.length - conOk
report.concurrency = {
  inFlight: CONCURRENCY,
  ok: conOk,
  err: conErr,
  elapsedMs: Number(elapsed.toFixed(1)),
  opsPerSec: Number((CONCURRENCY / (elapsed / 1000)).toFixed(1)),
  successRate: Number(((conOk / CONCURRENCY) * 100).toFixed(2)),
  note: 'Single-client-process concurrency; not multi-client peak load. Calibrate with a real multi-client harness against the live endpoint.',
}

// 5. restart recovery + persistence -----------------------------------------
// First perform a durable write we will check after restart.
const PERSIST_TEXT = `recover-${Date.now().toString(36)}`
const persistRes = await client.call('tools/call', {
  name: 'arkme_record_create',
  arguments: { text: PERSIST_TEXT, confirmed: true },
})
const PERSIST_ID = persistRes?.structuredContent?.recordId

const tRestart = nowMs()
client.kill()
// wait for exit
await new Promise((resolve) => {
  const p = client.proc
  if (p.exitCode !== null) return resolve()
  p.on('exit', resolve)
  setTimeout(resolve, 5000)
})

const client2 = new McpClient(serverCmd)
const ready2 = await client2.waitReady()
const tReady = nowMs()
// first successful read after restart
const reread = await client2.call('tools/call', {
  name: 'jiwo_read_note',
  arguments: { noteId: PERSIST_ID },
})
const tFirstRead = nowMs()
const persisted = reread && !reread.isError && reread.structuredContent?.note?.text === PERSIST_TEXT
report.recovery = {
  restartToReadyMs: Number((tReady - tRestart).toFixed(1)),
  restartToFirstReadMs: Number((tFirstRead - tRestart).toFixed(1)),
  readyAfterRestart: ready2,
  persistedWriteAfterRestart: !!persisted,
}

client2.kill()

// cleanup temp store (keep with KEEP_DATA=1 for manual inspection)
if (!process.env.KEEP_DATA) {
  try {
    fs.unlinkSync(DATA_FILE)
  } catch {
    /* ignore */
  }
}

// --- render ----------------------------------------------------------------
if (argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2))
} else {
  const r = report
  console.log('')
  console.log('=== Jiwo → DSH Pilot · Phase 0 Baseline (reference) ===')
  console.log(`server : ${r.meta.server}`)
  console.log(`stub?  : ${r.meta.isStubReference}  (${r.disclaimer})`)
  console.log('')
  console.log('· Golden success rate')
  console.log(`  read  : ${r.golden.reads.ok}/${r.golden.reads.total}  (${r.golden.reads.successRate}%)`)
  console.log(`  write : ${r.golden.writes.ok}/${r.golden.writes.total}  (${r.golden.writes.successRate}%)`)
  console.log('')
  console.log('· Error visibility (each must surface isError:true)')
  for (const [k, v] of Object.entries(r.errors)) {
    console.log(`  ${k.padEnd(22)} ${v.surfacedAsError}/${v.attempts}  ${v.visible ? 'VISIBLE' : 'SILENT ✗'}`)
  }
  console.log('')
  console.log('· Latency (ms, warmup-excluded)')
  console.log(
    `  read  : p50=${r.latency.readMs.p50}  p95=${r.latency.readMs.p95}  max=${r.latency.readMs.max}`,
  )
  console.log(
    `  write : p50=${r.latency.writeMs.p50}  p95=${r.latency.writeMs.p95}  max=${r.latency.writeMs.max}`,
  )
  console.log('')
  console.log('· Peak concurrency (single client process)')
  console.log(
    `  inFlight=${r.concurrency.inFlight}  ok=${r.concurrency.ok}  err=${r.concurrency.err}  ` +
      `${r.concurrency.opsPerSec} ops/s  (${r.concurrency.successRate}%)`,
  )
  console.log(`  note: ${r.concurrency.note}`)
  console.log('')
  console.log('· Restart recovery + persistence')
  console.log(
    `  restart→ready=${r.recovery.restartToReadyMs}ms  restart→firstRead=${r.recovery.restartToFirstReadMs}ms`,
  )
  console.log(
    `  readyAfterRestart=${r.recovery.readyAfterRestart}  persistedWriteAfterRestart=${r.recovery.persistedWriteAfterRestart}`,
  )
  console.log('')
}

export { report }
