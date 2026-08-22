#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const argv = process.argv.slice(2)

function flag(name, fallback) {
  const index = argv.indexOf(name)
  return index >= 0 && index + 1 < argv.length ? argv[index + 1] : fallback
}

function positiveInt(name, fallback) {
  const parsed = Number.parseInt(flag(name, String(fallback)), 10)
  if (!Number.isFinite(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`)
  return parsed
}

function nonNegativeInt(name, fallback) {
  const parsed = Number.parseInt(flag(name, String(fallback)), 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`)
  }
  return parsed
}

const LISTS = positiveInt('--lists', 100)
const GETS = positiveInt('--gets', 200)
const CONCURRENCY = positiveInt('--concurrency', 50)
const WARMUP = nonNegativeInt('--warmup', 5)
const CALL_TIMEOUT_MS = positiveInt('--call-timeout-ms', 15_000)
const ADAPTER_PATH = fileURLToPath(new URL('./opendesign-readonly-server.mjs', import.meta.url))
const customCommand = process.env.OPENDESIGN_MCP_SERVER_CMD
const serverCommand = customCommand
  ? ['sh', '-c', customCommand]
  : [process.execPath, ADAPTER_PATH]

class McpClient {
  constructor(command) {
    this.proc = spawn(command[0], command.slice(1), {
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    this.buffer = ''
    this.nextId = 1
    this.pending = new Map()
    this.ready = false

    this.proc.stderr.on('data', (chunk) => {
      if (chunk.toString().includes('ready')) this.ready = true
    })
    this.proc.stdout.on('data', (chunk) => {
      this.buffer += chunk.toString()
      let newline
      while ((newline = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, newline).trim()
        this.buffer = this.buffer.slice(newline + 1)
        if (!line) continue
        let message
        try {
          message = JSON.parse(line)
        } catch {
          continue
        }
        const deferred = this.pending.get(message.id)
        if (!deferred) continue
        this.pending.delete(message.id)
        if (message.error) deferred.reject(new Error(message.error.message || 'JSON-RPC error'))
        else deferred.resolve(message.result)
      }
    })
    this.proc.on('exit', () => {
      for (const deferred of this.pending.values()) deferred.reject(new Error('MCP server exited'))
      this.pending.clear()
    })
  }

  call(method, params = {}) {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`timeout: ${method}`))
      }, CALL_TIMEOUT_MS)
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer)
          resolve(value)
        },
        reject: (error) => {
          clearTimeout(timer)
          reject(error)
        },
      })
      this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
    })
  }

  notify(method, params = {}) {
    this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n')
  }

  async initialize(timeoutMs = 20_000) {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline && !this.ready && this.proc.exitCode === null) {
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
    if (this.proc.exitCode !== null) return false
    try {
      await this.call('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'opendesign-baseline-harness', version: '0.1.0' },
      })
      this.notify('notifications/initialized')
      return true
    } catch {
      return false
    }
  }

  async stop() {
    if (this.proc.exitCode !== null) return
    this.proc.kill()
    await new Promise((resolve) => {
      this.proc.once('exit', resolve)
      setTimeout(resolve, 5_000)
    })
  }
}

function nowMs() {
  return Number(process.hrtime.bigint()) / 1_000_000
}

function percentile(sorted, value) {
  if (sorted.length === 0) return null
  const index = Math.max(0, Math.ceil((value / 100) * sorted.length) - 1)
  return Number(sorted[index].toFixed(3))
}

function latencySummary(samples) {
  const sorted = [...samples].sort((left, right) => left - right)
  return {
    samples: sorted.length,
    min: sorted.length ? Number(sorted[0].toFixed(3)) : null,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted.length ? Number(sorted.at(-1).toFixed(3)) : null,
  }
}

function successSummary(total, ok) {
  return {
    total,
    ok,
    err: total - ok,
    successRate: Number(((ok / total) * 100).toFixed(2)),
  }
}

async function toolCall(client, name, args = {}) {
  return client.call('tools/call', { name, arguments: args })
}

async function measure(client, count, call) {
  const latencies = []
  let ok = 0
  for (let index = 0; index < count; index++) {
    const started = nowMs()
    const result = await call(index)
    latencies.push(nowMs() - started)
    if (result && !result.isError) ok++
  }
  return { success: successSummary(count, ok), latency: latencySummary(latencies) }
}

let client = new McpClient(serverCommand)
if (!(await client.initialize())) {
  await client.stop()
  throw new Error('OpenDesign MCP adapter did not initialize')
}

const tools = await client.call('tools/list')
const toolNames = tools.tools.map((tool) => tool.name).sort()
const expectedTools = ['opendesign_get_design_system', 'opendesign_list_design_systems']
if (JSON.stringify(toolNames) !== JSON.stringify(expectedTools)) {
  await client.stop()
  throw new Error(`unexpected tool discovery result: ${JSON.stringify(toolNames)}`)
}

const initialList = await toolCall(client, 'opendesign_list_design_systems')
if (initialList.isError) {
  await client.stop()
  throw new Error(initialList.content?.[0]?.text || 'OpenDesign list failed')
}
const systems = initialList.structuredContent?.designSystems
if (!Array.isArray(systems) || systems.length === 0) {
  await client.stop()
  throw new Error('OpenDesign has no design systems available for the baseline')
}
const goldenId = process.env.OPENDESIGN_GOLDEN_ID?.trim() || systems[0].id

for (let index = 0; index < WARMUP; index++) {
  await toolCall(client, 'opendesign_list_design_systems')
  await toolCall(client, 'opendesign_get_design_system', { id: goldenId })
}

const listMetrics = await measure(client, LISTS, () =>
  toolCall(client, 'opendesign_list_design_systems'),
)
const getMetrics = await measure(client, GETS, () =>
  toolCall(client, 'opendesign_get_design_system', { id: goldenId }),
)

const errorCases = [
  {
    label: 'missing_id',
    expectedCode: 'INVALID_INPUT',
    call: () => toolCall(client, 'opendesign_get_design_system'),
  },
  {
    label: 'not_found',
    expectedCode: 'NOT_FOUND',
    call: () => toolCall(client, 'opendesign_get_design_system', { id: 'user:does-not-exist' }),
  },
  {
    label: 'write_tool_rejected',
    expectedCode: 'UNKNOWN_TOOL',
    call: () => toolCall(client, 'opendesign_create_design_system', { title: 'forbidden' }),
  },
]
const errors = {}
for (const errorCase of errorCases) {
  const result = await errorCase.call()
  const actualCode = result?.structuredContent?.error?.code
  errors[errorCase.label] = {
    visible: result?.isError === true,
    expectedCode: errorCase.expectedCode,
    actualCode: actualCode || null,
    classified: actualCode === errorCase.expectedCode,
  }
}

const concurrencyStarted = nowMs()
const concurrent = await Promise.allSettled(
  Array.from({ length: CONCURRENCY }, () =>
    toolCall(client, 'opendesign_get_design_system', { id: goldenId }),
  ),
)
const concurrencyElapsedMs = nowMs() - concurrencyStarted
const concurrencyOk = concurrent.filter(
  (result) => result.status === 'fulfilled' && !result.value.isError,
).length

const restartStarted = nowMs()
await client.stop()
client = new McpClient(serverCommand)
const readyAfterRestart = await client.initialize()
const restartReadyAt = nowMs()
const firstRead = readyAfterRestart
  ? await toolCall(client, 'opendesign_get_design_system', { id: goldenId })
  : null
const restartReadAt = nowMs()
await client.stop()

const report = {
  meta: {
    generatedAt: new Date().toISOString(),
    upstream: process.env.OPENDESIGN_BASE_URL || 'http://127.0.0.1:7456',
    server: customCommand || `node ${path.basename(ADAPTER_PATH)}`,
    goldenId,
    readOnly: true,
    config: { lists: LISTS, gets: GETS, concurrency: CONCURRENCY, warmup: WARMUP },
  },
  disclaimer:
    'Measures the DSH-facing OpenDesign MCP path. It does not measure OpenWork renderer/IPC, CPU/RSS, or an OpenDesign daemon restart; collect those separately for P0-05.',
  discovery: { tools: toolNames, exactReadOnlySet: true },
  golden: { list: listMetrics.success, get: getMetrics.success },
  latency: { listMs: listMetrics.latency, getMs: getMetrics.latency },
  errors,
  concurrency: {
    inFlight: CONCURRENCY,
    ok: concurrencyOk,
    err: CONCURRENCY - concurrencyOk,
    elapsedMs: Number(concurrencyElapsedMs.toFixed(3)),
    opsPerSec: Number((CONCURRENCY / (concurrencyElapsedMs / 1_000)).toFixed(2)),
    successRate: Number(((concurrencyOk / CONCURRENCY) * 100).toFixed(2)),
  },
  recovery: {
    scope: 'MCP adapter restart; OpenDesign daemon remains running',
    restartToReadyMs: Number((restartReadyAt - restartStarted).toFixed(3)),
    restartToFirstReadMs: Number((restartReadAt - restartStarted).toFixed(3)),
    readyAfterRestart,
    firstReadSucceeded: firstRead !== null && !firstRead.isError,
  },
}

if (argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log('\n=== OpenWork → OpenDesign · DSH read-only path baseline ===')
  console.log(`upstream : ${report.meta.upstream}`)
  console.log(`goldenId: ${report.meta.goldenId}`)
  console.log(`tools   : ${report.discovery.tools.join(', ')}`)
  console.log('\n· Golden success')
  console.log(`  list: ${report.golden.list.ok}/${report.golden.list.total} (${report.golden.list.successRate}%)`)
  console.log(`  get : ${report.golden.get.ok}/${report.golden.get.total} (${report.golden.get.successRate}%)`)
  console.log('\n· Latency (ms)')
  console.log(`  list: p50=${report.latency.listMs.p50} p95=${report.latency.listMs.p95} p99=${report.latency.listMs.p99}`)
  console.log(`  get : p50=${report.latency.getMs.p50} p95=${report.latency.getMs.p95} p99=${report.latency.getMs.p99}`)
  console.log('\n· Classified errors')
  for (const [name, result] of Object.entries(report.errors)) {
    console.log(`  ${name}: ${result.actualCode} (${result.classified ? 'classified' : 'mismatch'})`)
  }
  console.log('\n· Concurrency')
  console.log(`  ${report.concurrency.ok}/${report.concurrency.inFlight} ok, ${report.concurrency.opsPerSec} ops/s`)
  console.log('\n· Adapter recovery')
  console.log(`  ready=${report.recovery.restartToReadyMs}ms firstRead=${report.recovery.restartToFirstReadMs}ms`)
  console.log(`\n${report.disclaimer}\n`)
}

export { report }
