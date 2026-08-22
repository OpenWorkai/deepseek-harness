import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import { afterEach, expect, test } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { CallId } from '@deepseek-ai/dsh-llm'
import { apply as applyMcpClient } from '@deepseek-ai/dsh-mcp-client'

const ADAPTER = fileURLToPath(new URL('../opendesign-readonly-server.mjs', import.meta.url))
const REPO_ROOT = fileURLToPath(new URL('../../../..', import.meta.url))

const DESIGN_SYSTEM = {
  id: 'user:aurora',
  title: 'Aurora',
  summary: 'A calm product design system.',
  category: 'product',
  swatches: ['#102030', '#f7f8fa'],
  surface: 'web',
  body: '# Aurora\n\nPrivate design guidance.',
  source: 'user',
  status: 'published',
  isEditable: true,
  createdAt: '2026-08-20T10:00:00.000Z',
  updatedAt: '2026-08-21T11:00:00.000Z',
  provenance: { sourceNotes: 'must not enter the model context' },
  projectId: 'private-project-id',
  extra: 'must not cross the adapter allowlist',
}

const stopped = []

afterEach(async () => {
  await Promise.all(stopped.splice(0).map((stop) => stop()))
})

async function startUpstream() {
  const server = createServer((req, res) => {
    res.setHeader('content-type', 'application/json')
    if (req.url === '/api/design-systems') {
      res.end(JSON.stringify({ designSystems: [DESIGN_SYSTEM] }))
      return
    }

    const prefix = '/api/design-systems/'
    if (req.url?.startsWith(prefix)) {
      const id = decodeURIComponent(req.url.slice(prefix.length))
      if (id === 'user:missing') {
        res.statusCode = 404
        res.end(JSON.stringify({ error: 'design system not found' }))
        return
      }
      if (id === 'user:forbidden') {
        res.statusCode = 403
        res.end(JSON.stringify({ error: 'design system denied' }))
        return
      }
      if (id === 'user:unauthorized') {
        res.statusCode = 401
        res.end(JSON.stringify({ error: 'authentication required' }))
        return
      }
      if (id === 'user:rate-limited') {
        res.statusCode = 429
        res.end(JSON.stringify({ error: 'too many requests' }))
        return
      }
      if (id === 'user:broken') {
        res.end(JSON.stringify({ designSystem: { title: 'Missing id' } }))
        return
      }
      if (id === 'user:untitled') {
        res.end(JSON.stringify({ designSystem: { id: 'user:untitled' } }))
        return
      }
      if (id === 'user:slow') {
        setTimeout(() => res.end(JSON.stringify({ designSystem: DESIGN_SYSTEM })), 200)
        return
      }
      if (id === DESIGN_SYSTEM.id) {
        res.end(JSON.stringify({ ...DESIGN_SYSTEM, designSystem: DESIGN_SYSTEM }))
        return
      }
    }

    res.statusCode = 500
    res.end(JSON.stringify({ error: 'fixture route mismatch' }))
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('fixture did not bind a TCP port')

  const stop = () => new Promise((resolve) => server.close(resolve))
  stopped.push(stop)
  return `http://127.0.0.1:${address.port}`
}

function startAdapter(baseUrl, timeoutMs = 1_000) {
  const proc = spawn(process.execPath, [ADAPTER], {
    env: {
      ...process.env,
      OPENDESIGN_BASE_URL: baseUrl,
      OPENDESIGN_REQUEST_TIMEOUT_MS: String(timeoutMs),
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  let buffer = ''
  let ready = false
  let nextId = 1
  const pending = new Map()
  const stderr = []

  proc.stderr.on('data', (chunk) => {
    const text = chunk.toString()
    stderr.push(text)
    if (text.includes('ready')) ready = true
  })
  proc.stdout.on('data', (chunk) => {
    buffer += chunk.toString()
    let newline
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim()
      buffer = buffer.slice(newline + 1)
      if (!line) continue
      const message = JSON.parse(line)
      const deferred = pending.get(message.id)
      if (!deferred) continue
      pending.delete(message.id)
      if (message.error) deferred.reject(new Error(JSON.stringify(message.error)))
      else deferred.resolve(message.result)
    }
  })
  proc.on('exit', () => {
    for (const deferred of pending.values()) deferred.reject(new Error('adapter exited'))
    pending.clear()
  })

  const call = (method, params = {}) => {
    const id = nextId++
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject })
      proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
    })
  }
  const stop = async () => {
    if (proc.exitCode !== null) return
    proc.kill()
    await new Promise((resolve) => {
      proc.once('exit', resolve)
      setTimeout(resolve, 1_000)
    })
  }
  stopped.push(stop)

  return {
    call,
    stderr: () => stderr.join(''),
    waitReady: async () => {
      for (let attempt = 0; attempt < 100 && !ready; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 20))
      }
      return ready
    },
  }
}

async function boot(timeoutMs) {
  const baseUrl = await startUpstream()
  const adapter = startAdapter(baseUrl, timeoutMs)
  expect(await adapter.waitReady()).toBe(true)
  await adapter.call('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'contract-test', version: '0' },
  })
  return adapter
}

test('tool discovery exposes exactly the two approved read-only tools', async () => {
  const adapter = await boot()
  const result = await adapter.call('tools/list')
  expect(result.tools.map((tool) => tool.name).sort()).toEqual([
    'opendesign_get_design_system',
    'opendesign_list_design_systems',
  ])

  const list = result.tools.find((tool) => tool.name === 'opendesign_list_design_systems')
  expect(list.inputSchema).toEqual({ type: 'object', properties: {}, additionalProperties: false })
  expect(list.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false })

  const get = result.tools.find((tool) => tool.name === 'opendesign_get_design_system')
  expect(get.inputSchema.required).toEqual(['id'])
  expect(get.inputSchema.properties.id.type).toBe('string')
  expect(get.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false })
})

test('list returns allowlisted summaries and never exposes body', async () => {
  const adapter = await boot()
  const result = await adapter.call('tools/call', {
    name: 'opendesign_list_design_systems',
    arguments: {},
  })
  expect(result.isError).toBeFalsy()
  expect(result.structuredContent.designSystems).toEqual([
    {
      id: 'user:aurora',
      title: 'Aurora',
      summary: 'A calm product design system.',
      category: 'product',
      swatches: ['#102030', '#f7f8fa'],
      surface: 'web',
      source: 'user',
      status: 'published',
      isEditable: true,
      createdAt: '2026-08-20T10:00:00.000Z',
      updatedAt: '2026-08-21T11:00:00.000Z',
    },
  ])
  expect(JSON.stringify(result)).not.toContain('Private design guidance')
  expect(JSON.stringify(result)).not.toContain('private-project-id')
})

test('get returns the allowlisted detail including body', async () => {
  const adapter = await boot()
  const result = await adapter.call('tools/call', {
    name: 'opendesign_get_design_system',
    arguments: { id: DESIGN_SYSTEM.id },
  })
  expect(result.isError).toBeFalsy()
  expect(result.structuredContent.designSystem.body).toBe(DESIGN_SYSTEM.body)
  expect(result.structuredContent.designSystem.id).toBe(DESIGN_SYSTEM.id)
  expect(result.structuredContent.designSystem.title).toBe(DESIGN_SYSTEM.title)
  expect(result.structuredContent.designSystem).not.toHaveProperty('provenance')
  expect(result.structuredContent.designSystem).not.toHaveProperty('projectId')
  expect(result.structuredContent.designSystem).not.toHaveProperty('extra')
})

test('missing id is rejected before contacting OpenDesign', async () => {
  const adapter = await boot()
  const result = await adapter.call('tools/call', {
    name: 'opendesign_get_design_system',
    arguments: { id: '  ' },
  })
  expect(result.isError).toBe(true)
  expect(result.structuredContent.error.code).toBe('INVALID_INPUT')
})

test.each([
  ['user:missing', 'NOT_FOUND', 404],
  ['user:unauthorized', 'UNAUTHORIZED', 401],
  ['user:forbidden', 'FORBIDDEN', 403],
  ['user:rate-limited', 'RATE_LIMITED', 429],
])('classifies upstream %s failures as %s', async (id, code, status) => {
  const adapter = await boot()
  const result = await adapter.call('tools/call', {
    name: 'opendesign_get_design_system',
    arguments: { id },
  })
  expect(result.isError).toBe(true)
  expect(result.structuredContent.error).toMatchObject({ code, status })
})

test('reports schema incompatibility instead of returning an empty object', async () => {
  const adapter = await boot()
  const missingId = await adapter.call('tools/call', {
    name: 'opendesign_get_design_system',
    arguments: { id: 'user:broken' },
  })
  expect(missingId.isError).toBe(true)
  expect(missingId.structuredContent.error.code).toBe('SCHEMA_INCOMPATIBLE')

  const missingTitle = await adapter.call('tools/call', {
    name: 'opendesign_get_design_system',
    arguments: { id: 'user:untitled' },
  })
  expect(missingTitle.isError).toBe(true)
  expect(missingTitle.structuredContent.error.code).toBe('SCHEMA_INCOMPATIBLE')
})

test('reports request timeout as a classified tool error', async () => {
  const adapter = await boot(30)
  const result = await adapter.call('tools/call', {
    name: 'opendesign_get_design_system',
    arguments: { id: 'user:slow' },
  })
  expect(result.isError).toBe(true)
  expect(result.structuredContent.error.code).toBe('UPSTREAM_TIMEOUT')
})

test('reports an unavailable OpenDesign daemon as a classified tool error', async () => {
  const adapter = startAdapter('http://127.0.0.1:1')
  expect(await adapter.waitReady()).toBe(true)
  await adapter.call('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'contract-test', version: '0' },
  })
  const result = await adapter.call('tools/call', {
    name: 'opendesign_list_design_systems',
    arguments: {},
  })
  expect(result.isError).toBe(true)
  expect(result.structuredContent.error.code).toBe('UPSTREAM_UNAVAILABLE')
})

test('write and unknown tools are unavailable and rejected', async () => {
  const adapter = await boot()
  const result = await adapter.call('tools/call', {
    name: 'opendesign_create_design_system',
    arguments: { title: 'must not be created' },
  })
  expect(result.isError).toBe(true)
  expect(result.structuredContent.error.code).toBe('UNKNOWN_TOOL')
})

test('overlay points DSH at the OpenDesign read-only adapter', () => {
  const yaml = fs.readFileSync(
    fileURLToPath(new URL('../../jiwo-pilot.cordis.yml', import.meta.url)),
    'utf8',
  )
  expect(yaml).toContain('failOnStartupError: true')
  expect(yaml).toContain('transport: stdio')
  expect(yaml).toContain('serverName: opendesign')
  expect(yaml).toContain('opendesign-readonly-server.mjs')
  expect(yaml).not.toContain('JIWO_DATA_FILE')
})

test('real dsh-mcp-client discovers and executes only the OpenDesign read tools', async () => {
  const baseUrl = await startUpstream()
  const ctx = new Context()
  try {
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    await applyMcpClient(ctx, {
      transport: 'stdio',
      serverName: 'opendesign',
      command: process.execPath,
      args: [ADAPTER],
      env: {
        OPENDESIGN_BASE_URL: baseUrl,
        OPENDESIGN_REQUEST_TIMEOUT_MS: '1000',
      },
      cwd: REPO_ROOT,
      toolCallTimeoutMs: 5_000,
      failOnStartupError: true,
    })

    const names = ctx.tools
      .schemas()
      .map((schema) => schema.name)
      .filter((name) => name.startsWith('mcp__opendesign__'))
      .sort()
    expect(names).toEqual([
      'mcp__opendesign__opendesign_get_design_system',
      'mcp__opendesign__opendesign_list_design_systems',
    ])
    expect(names).not.toContain('mcp__opendesign__opendesign_create_design_system')

    const list = await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: CallId('opendesign-list'),
      name: 'mcp__opendesign__opendesign_list_design_systems',
      arguments: {},
    })
    expect(list.isError).toBe(false)
    expect(JSON.stringify(list.value)).toContain('Aurora')
    expect(JSON.stringify(list.value)).not.toContain('Private design guidance')
    expect(JSON.stringify(list.value)).not.toContain('private-project-id')

    const detail = await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: CallId('opendesign-get'),
      name: 'mcp__opendesign__opendesign_get_design_system',
      arguments: { id: DESIGN_SYSTEM.id },
    })
    expect(detail.isError).toBe(false)
    expect(JSON.stringify(detail.value)).toContain('Private design guidance')
    expect(JSON.stringify(detail.value)).not.toContain('private-project-id')
  } finally {
    await ctx.fiber.dispose()
  }
})
