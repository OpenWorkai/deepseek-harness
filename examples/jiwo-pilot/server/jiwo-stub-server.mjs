#!/usr/bin/env node
// jiwo-stub-server.mjs
// ---------------------------------------------------------------------------
// Stub Jiwo MCP backend for the DSH pilot (Phase 1, MIGRATION_JIWO.md §5/§9).
//
// This is NOT the real Jiwo backend. It is an in-repo, dependency-free stand-in
// that lets the pilot run end-to-end today. The real Jiwo API is a drop-in
// replacement: swap the two handlers below for HTTP calls to Jiwo and keep the
// same tool contracts. Jiwo stays the sole source of truth in both cases.
//
// Transport: MCP over stdio (newline-delimited JSON-RPC 2.0).
// Tools:
//   jiwo_read_note  - read-only; never mutates. Missing note => error, not empty.
//   jiwo_write_tag  - idempotent, confirmation-gated write (confirmed: true).
//
// Persistence: an in-memory Map seeded from SEED_NOTES, with write-through to a
// JSONL file (default: examples/jiwo-pilot/.jiwo-data.jsonl, gitignored). The
// JSONL file IS the pilot's "Jiwo backend" fact-source; the server performs no
// schema migration or deletion of any other data, which is what makes the
// Phase 1 rollback (disable overlay -> old path still works) safe.
// ---------------------------------------------------------------------------

import { createInterface } from 'node:readline'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

// --- Seed (committed; stands in for Jiwo's current data) -------------------
const SEED_NOTES = [
  {
    id: 'note-1',
    title: '季度复盘笔记',
    body: 'Q2 用户留存从 41% 提升到 47%，主因是 onboarding 重排。下一步验证推送时机。',
    tags: ['review', 'growth'],
    updatedAt: '2026-08-18T09:12:00.000Z',
  },
  {
    id: 'note-2',
    title: '即我迁移观察',
    body: 'DSH 作为 agent 壳可行；账户、关系数据、跨设备同步仍由即我负责。',
    tags: ['migration', 'dsh'],
    updatedAt: '2026-08-20T14:03:00.000Z',
  },
  {
    id: 'note-3',
    title: '读书摘录',
    body: '《人月神话》：向进度落后的项目增加人手，只会使它更慢。',
    tags: ['reading'],
    updatedAt: '2026-08-21T20:30:00.000Z',
  },
]

const DATA_FILE =
  process.env.JIWO_DATA_FILE ||
  path.join(process.cwd(), 'examples', 'jiwo-pilot', '.jiwo-data.jsonl')

/** @type {Map<string, any>} */
const store = new Map()

async function loadAll() {
  for (const n of SEED_NOTES) store.set(n.id, { ...n, tags: [...n.tags] })
  if (existsSync(DATA_FILE)) {
    // Last record per id wins (write-through overwrites the whole file, but a
    // user-supplied append-only file is tolerated the same way).
    const text = await readFile(DATA_FILE, 'utf8')
    for (const line of text.split('\n')) {
      const t = line.trim()
      if (!t) continue
      try {
        const rec = JSON.parse(t)
        if (rec && rec.id) store.set(rec.id, rec)
      } catch {
        // ignore malformed lines
      }
    }
  }
}

async function persist() {
  await mkdir(path.dirname(DATA_FILE), { recursive: true })
  const lines = [...store.values()].map((r) => JSON.stringify(r)).join('\n') + '\n'
  await writeFile(DATA_FILE, lines, 'utf8')
}

// --- MCP protocol plumbing ------------------------------------------------
const rl = createInterface({ input: process.stdin, crlfDelay: Infinity })
let buffer = ''

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n')
}

function textBlock(text) {
  return [{ type: 'text', text }]
}

function toolError(message) {
  return { content: textBlock('Error: ' + message), isError: true }
}

function toolResult(text, structuredContent) {
  const r = { content: textBlock(text) }
  if (structuredContent !== undefined) r.structuredContent = structuredContent
  return r
}

const TOOLS = [
  {
    name: 'jiwo_read_note',
    description:
      'Read a single note from the Jiwo backend (read-only). Returns id, title, body, tags and updatedAt. Jiwo remains the sole source of truth; this tool never mutates data. Use it to surface a note for the user before any write.',
    inputSchema: {
      type: 'object',
      properties: {
        noteId: { type: 'string', description: 'Jiwo note id, e.g. "note-1"' },
      },
      required: ['noteId'],
    },
  },
  {
    name: 'jiwo_write_tag',
    description:
      'Append a tag to a Jiwo note. Idempotent: re-adding an existing tag is a no-op (no duplicate record). Requires explicit confirmation: pass confirmed:true ONLY after the user has approved the write. The write lands on the Jiwo backend (this stub: its JSONL store).',
    inputSchema: {
      type: 'object',
      properties: {
        noteId: { type: 'string', description: 'Jiwo note id' },
        tag: { type: 'string', description: 'Tag to append, e.g. "verified"' },
        confirmed: {
          type: 'boolean',
          description: 'Must be true; set only after explicit user confirmation',
        },
      },
      required: ['noteId', 'tag', 'confirmed'],
    },
  },
]

async function dispatchTool(name, args) {
  if (name === 'jiwo_read_note') {
    const note = store.get(args.noteId)
    if (!note) return toolError('note not found: ' + String(args.noteId))
    return toolResult(JSON.stringify(note, null, 2), { note })
  }

  if (name === 'jiwo_write_tag') {
    if (args.confirmed !== true) {
      return toolError(
        'write rejected: confirmed must be true. Obtain explicit user confirmation before writing.',
      )
    }
    const note = store.get(args.noteId)
    if (!note) return toolError('note not found: ' + String(args.noteId))
    const tag = String(args.tag ?? '').trim()
    if (!tag) return toolError('write rejected: tag must be a non-empty string')
    const tags = [...note.tags]
    const changed = !tags.includes(tag)
    if (changed) tags.push(tag)
    note.tags = tags
    note.updatedAt = new Date().toISOString()
    store.set(note.id, note)
    await persist()
    return toolResult(
      changed
        ? `Tag "${tag}" added to ${note.id}. Tags: ${tags.join(', ')}.`
        : `Tag "${tag}" already present on ${note.id}; no change (idempotent). Tags: ${tags.join(', ')}.`,
      { noteId: note.id, tags, changed },
    )
  }

  return toolError('unknown tool: ' + String(name))
}

async function handle(message) {
  const id = message.id
  const method = message.method

  if (method === 'initialize') {
    return {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'jiwo-stub', version: '0.1.0' },
    }
  }

  if (method === 'tools/list') {
    return { tools: TOOLS }
  }

  if (method === 'tools/call') {
    const result = await dispatchTool(message.params?.name, message.params?.arguments || {})
    return result
  }

  if (method === 'shutdown') {
    return null
  }

  // notifications/initialized and other notifications have no id -> no reply
  if (id === undefined) return undefined
  return { error: { code: -32601, message: 'Method not found: ' + method } }
}

rl.on('line', async (line) => {
  const t = line.trim()
  if (!t) return
  let message
  try {
    message = JSON.parse(t)
  } catch {
    return
  }
  try {
    const result = await handle(message)
    if (result === undefined) return // notification: no response
    send({ jsonrpc: '2.0', id: message.id, result })
  } catch (err) {
    send({ jsonrpc: '2.0', id: message.id, error: { code: -32603, message: String(err) } })
  }
})

process.on('SIGINT', () => process.exit(0))
process.on('SIGTERM', () => process.exit(0))

await loadAll()
// Signal readiness on stderr (stdout is the JSON-RPC channel).
process.stderr.write('jiwo-stub: ready, ' + store.size + ' notes loaded\n')
