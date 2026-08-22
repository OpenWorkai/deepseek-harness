// jiwo.contract.test.mjs
// ---------------------------------------------------------------------------
// Contract + rollback tests for the stub Jiwo MCP backend (Phase 1 acceptance
// gates from MIGRATION_JIWO.md §6). These speak real JSON-RPC to a spawned
// server instance, so they exercise the exact wire contract the model and the
// dsh-mcp-client see.
//
// Coverage:
//   - tools/list shape (exactly the 2 approved tools, correct input schemas)
//   - golden read (field-level equality against the seed)
//   - error visibility (missing note => error, never silent empty)
//   - confirmation gate (write without confirmed:true is rejected)
//   - idempotent write (repeat => no duplicate record, success both times)
//   - persistence / source-of-truth (write lands in the JSONL store)
//   - rollback proxy (stub is a pure tool-bridge: read path intact after a
//     write, no migration artifact) -- the full DSH disable-overlay drill is
//     manual per §6.
//   - overlay config contract (failOnStartupError: true, transport: stdio)
// ---------------------------------------------------------------------------

import { test, expect, afterEach } from 'vitest'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const SERVER = fileURLToPath(new URL('../jiwo-stub-server.mjs', import.meta.url))

/** Boot a server with an isolated temp store; returns a JSON-RPC client. */
function startServer(dataFile) {
  const proc = spawn(process.execPath, [SERVER], {
    env: { ...process.env, JIWO_DATA_FILE: dataFile },
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  let buf = ''
  let ready = false
  const pending = new Map()
  let nextId = 1
  const stderr = []
  proc.stderr.on('data', (d) => {
    stderr.push(d.toString())
    if (!ready && d.toString().includes('ready')) ready = true
  })
  proc.stdout.on('data', (d) => {
    buf += d.toString()
    let idx
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim()
      buf = buf.slice(idx + 1)
      if (!line) continue
      const msg = JSON.parse(line)
      if (msg.id !== undefined && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id)
        pending.delete(msg.id)
        if (msg.error) reject(new Error(JSON.stringify(msg.error)))
        else resolve(msg.result)
      }
    }
  })
  function sendRaw(obj) {
    proc.stdin.write(JSON.stringify(obj) + '\n')
  }
  function call(method, params) {
    const id = nextId++
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject })
      sendRaw({ jsonrpc: '2.0', id, method, params })
    })
  }
  async function waitReady() {
    for (let i = 0; i < 100 && !ready; i++) await new Promise((r) => setTimeout(r, 20))
    return ready
  }
  return {
    proc,
    call,
    notify: (method, params) => sendRaw({ jsonrpc: '2.0', method, params }),
    waitReady,
    stderr: () => stderr.join(''),
    kill: () => {
      try {
        proc.kill()
      } catch {
        /* already gone */
      }
    },
  }
}

const booted = []
afterEach(() => {
  for (const s of booted) s.kill()
  booted.length = 0
})

async function boot() {
  const dataFile = path.join(os.tmpdir(), `jiwo-test-${Math.random().toString(36).slice(2)}.jsonl`)
  const s = startServer(dataFile)
  booted.push(s)
  expect(await s.waitReady()).toBe(true)
  await s.call('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'contract-test', version: '0' },
  })
  s.notify('notifications/initialized', {})
  return { s, dataFile }
}

const GOLDEN_NOTE_1 = {
  id: 'note-1',
  title: '季度复盘笔记',
  body: 'Q2 用户留存从 41% 提升到 47%，主因是 onboarding 重排。下一步验证推送时机。',
  tags: ['review', 'growth'],
  updatedAt: '2026-08-18T09:12:00.000Z',
}

test('tools/list exposes exactly the 2 approved tools with correct schemas', async () => {
  const { s } = await boot()
  const res = await s.call('tools/list', {})
  const names = res.tools.map((t) => t.name).sort()
  expect(names).toEqual(['jiwo_read_note', 'jiwo_write_tag'])

  const read = res.tools.find((t) => t.name === 'jiwo_read_note')
  expect(read.inputSchema.required).toEqual(['noteId'])
  expect(read.inputSchema.properties.noteId.type).toBe('string')

  const write = res.tools.find((t) => t.name === 'jiwo_write_tag')
  expect(write.inputSchema.required.sort()).toEqual(['confirmed', 'noteId', 'tag'])
  expect(write.inputSchema.properties.confirmed.type).toBe('boolean')
})

test('golden read: field-level equality against the seed', async () => {
  const { s } = await boot()
  const res = await s.call('tools/call', { name: 'jiwo_read_note', arguments: { noteId: 'note-1' } })
  expect(res.isError).toBeFalsy()
  expect(res.structuredContent.note).toEqual(GOLDEN_NOTE_1)
})

test('error visibility: missing note returns an error, never silent empty', async () => {
  const { s } = await boot()
  const res = await s.call('tools/call', { name: 'jiwo_read_note', arguments: { noteId: 'nope' } })
  expect(res.isError).toBe(true)
  expect(res.content[0].text).toContain('not found')
  // No structuredContent leaks a fake empty note.
  expect(res.structuredContent).toBeUndefined()
})

test('confirmation gate: write without confirmed:true is rejected', async () => {
  const { s } = await boot()
  const res = await s.call('tools/call', {
    name: 'jiwo_write_tag',
    arguments: { noteId: 'note-1', tag: 'x', confirmed: false },
  })
  expect(res.isError).toBe(true)
  expect(res.content[0].text).toContain('confirmed must be true')

  // Missing confirmed entirely is also rejected.
  const res2 = await s.call('tools/call', {
    name: 'jiwo_write_tag',
    arguments: { noteId: 'note-1', tag: 'x' },
  })
  expect(res2.isError).toBe(true)
})

test('idempotent write: repeat does not create a duplicate record', async () => {
  const { s } = await boot()
  const first = await s.call('tools/call', {
    name: 'jiwo_write_tag',
    arguments: { noteId: 'note-1', tag: 'verified', confirmed: true },
  })
  expect(first.isError).toBeFalsy()
  expect(first.structuredContent.changed).toBe(true)
  expect(first.structuredContent.tags).toContain('verified')

  const second = await s.call('tools/call', {
    name: 'jiwo_write_tag',
    arguments: { noteId: 'note-1', tag: 'verified', confirmed: true },
  })
  expect(second.isError).toBeFalsy()
  expect(second.structuredContent.changed).toBe(false) // no-op
  expect(second.structuredContent.tags).toEqual(first.structuredContent.tags)
  expect(second.structuredContent.tags.filter((t) => t === 'verified')).toHaveLength(1)

  // Confirm the read path reflects the new tag.
  const reread = await s.call('tools/call', { name: 'jiwo_read_note', arguments: { noteId: 'note-1' } })
  expect(reread.structuredContent.note.tags).toContain('verified')
})

test('persistence: the write lands in the JSONL store (source of truth)', async () => {
  const { s, dataFile } = await boot()
  await s.call('tools/call', {
    name: 'jiwo_write_tag',
    arguments: { noteId: 'note-1', tag: 'verified', confirmed: true },
  })
  s.kill()
  // The store file IS the Jiwo backend stub; parse it and check last-write-wins.
  const lines = fs.readFileSync(dataFile, 'utf8').split('\n').filter(Boolean)
  const records = lines.map((l) => JSON.parse(l))
  const note1 = records.filter((r) => r.id === 'note-1').at(-1)
  expect(note1.tags).toContain('verified')
})

test('rollback proxy: read path stays intact after a write (no migration)', async () => {
  const { s } = await boot()
  await s.call('tools/call', {
    name: 'jiwo_write_tag',
    arguments: { noteId: 'note-1', tag: 'verified', confirmed: true },
  })
  // Other seed notes are untouched; the stub is a pure tool-bridge.
  const note2 = await s.call('tools/call', { name: 'jiwo_read_note', arguments: { noteId: 'note-2' } })
  expect(note2.isError).toBeFalsy()
  expect(note2.structuredContent.note.tags).toEqual(['migration', 'dsh'])

  const note3 = await s.call('tools/call', { name: 'jiwo_read_note', arguments: { noteId: 'note-3' } })
  expect(note3.structuredContent.note.title).toBe('读书摘录')
})

test('overlay config contract: failOnStartupError true and stdio transport', () => {
  const yml = fs.readFileSync(
    fileURLToPath(new URL('../../jiwo-pilot.cordis.yml', import.meta.url)),
    'utf8',
  )
  expect(yml).toContain('failOnStartupError: true')
  expect(yml).toContain('transport: stdio')
  expect(yml).toContain("serverName: jiwo")
  expect(yml).toContain("name: '@deepseek-ai/dsh-mcp-client'")
})
