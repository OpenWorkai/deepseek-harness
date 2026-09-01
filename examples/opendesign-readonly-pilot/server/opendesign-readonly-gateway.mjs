import { createInterface } from 'node:readline'
import { CallId } from '@deepseek-ai/dsh-llm'

const PROTOCOL_VERSION = 'opendesign-readonly/1'
const SERVER_INFO = { name: 'dsh-opendesign-readonly-pilot', version: '1' }
const PUBLIC_PREFIX = 'mcp__opendesign__'
const APPROVED_TOOLS = [
  'opendesign_get_design_system',
  'opendesign_list_design_systems',
]

export const inject = ['tools']

function write(message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`)
}

function fail(id, code, message, data) {
  write({ id, error: { code, message, ...(data === undefined ? {} : { data }) } })
}

async function approvedCatalog(ctx) {
  const deadline = Date.now() + 5_000
  while (Date.now() < deadline) {
    const names = ctx.tools
      .schemas()
      .map(schema => schema.name)
      .filter(name => name.startsWith(PUBLIC_PREFIX))
      .map(name => name.slice(PUBLIC_PREFIX.length))
      .sort()
    if (JSON.stringify(names) === JSON.stringify(APPROVED_TOOLS)) {
      return names.map(name => ({ name }))
    }
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  throw new Error('OpenDesign read-only tool catalog does not match the approved contract')
}

function requestId(value) {
  return typeof value === 'string' || typeof value === 'number' ? value : null
}

function requestParams(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {}
}

export async function apply(ctx) {
  const tools = await approvedCatalog(ctx)
  const input = createInterface({ input: process.stdin, crlfDelay: Infinity })
  const inflight = new Map()
  let initialized = false

  const handle = async (message) => {
    if (typeof message !== 'object' || message === null || Array.isArray(message)) {
      fail(null, -32600, 'Invalid request')
      return
    }
    const id = requestId(message.id)
    const params = requestParams(message.params)

    if (message.method === '$/cancelRequest') {
      const target = requestId(params.id)
      if (target !== null) inflight.get(target)?.abort()
      return
    }
    if (id === null || typeof message.method !== 'string') {
      fail(id, -32600, 'Invalid request')
      return
    }

    if (message.method === 'initialize') {
      if (params.protocolVersion !== PROTOCOL_VERSION) {
        fail(id, -32001, 'Unsupported read-only protocol version')
        return
      }
      initialized = true
      write({ id, result: { protocolVersion: PROTOCOL_VERSION, serverInfo: SERVER_INFO } })
      return
    }
    if (!initialized) {
      fail(id, -32002, 'Runtime is not initialized')
      return
    }
    if (message.method === 'tools/list') {
      write({ id, result: { tools } })
      return
    }
    if (message.method === 'shutdown') {
      write({ id, result: {} })
      setImmediate(() => process.kill(process.pid, 'SIGTERM'))
      return
    }
    if (message.method !== 'tools/call') {
      fail(id, -32601, 'Method not found')
      return
    }

    const name = typeof params.name === 'string' ? params.name : ''
    if (!APPROVED_TOOLS.includes(name)) {
      fail(id, -32601, 'Tool not found')
      return
    }
    const args = requestParams(params.arguments)
    const controller = new AbortController()
    inflight.set(id, controller)
    try {
      const result = await ctx.tools.execute({
        signal: controller.signal,
        callId: CallId(`openwork-${String(id)}`),
        name: `${PUBLIC_PREFIX}${name}`,
        arguments: args,
      })
      if (result.isError) {
        fail(id, controller.signal.aborted ? -32800 : -32010, controller.signal.aborted
          ? 'Request cancelled'
          : 'OpenDesign read failed')
        return
      }
      write({ id, result: result.value })
    } catch {
      fail(id, controller.signal.aborted ? -32800 : -32010, controller.signal.aborted
        ? 'Request cancelled'
        : 'OpenDesign read failed')
    } finally {
      inflight.delete(id)
    }
  }

  input.on('line', (line) => {
    if (!line.trim()) return
    let message
    try {
      message = JSON.parse(line)
    } catch {
      fail(null, -32700, 'Parse error')
      return
    }
    void handle(message)
  })

  ctx.effect(() => () => {
    for (const controller of inflight.values()) controller.abort()
    inflight.clear()
    input.close()
  }, 'opendesign-readonly-gateway')
}
