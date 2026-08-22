#!/usr/bin/env node

import { createInterface } from 'node:readline'

const DEFAULT_BASE_URL = 'http://127.0.0.1:7456'
const DEFAULT_TIMEOUT_MS = 10_000

function resolveBaseUrl(value) {
  const url = new URL(String(value || DEFAULT_BASE_URL).replace(/\/+$/, ''))
  const loopbackHosts = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])
  if (url.protocol !== 'http:' || !loopbackHosts.has(url.hostname)) {
    throw new Error('OPENDESIGN_BASE_URL must be a loopback http URL')
  }
  return url.toString().replace(/\/+$/, '')
}

function resolveTimeoutMs(value) {
  const parsed = Number.parseInt(String(value || DEFAULT_TIMEOUT_MS), 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error('OPENDESIGN_REQUEST_TIMEOUT_MS must be a positive integer')
  }
  return parsed
}

const BASE_URL = resolveBaseUrl(process.env.OPENDESIGN_BASE_URL)
const REQUEST_TIMEOUT_MS = resolveTimeoutMs(process.env.OPENDESIGN_REQUEST_TIMEOUT_MS)

class AdapterError extends Error {
  constructor(code, message, status) {
    super(message)
    this.code = code
    this.status = status
  }
}

function textBlock(text) {
  return [{ type: 'text', text }]
}

function toolError(error) {
  const normalized =
    error instanceof AdapterError
      ? error
      : new AdapterError('INTERNAL_ERROR', error instanceof Error ? error.message : String(error))
  const detail = { code: normalized.code, message: normalized.message }
  if (normalized.status !== undefined) detail.status = normalized.status
  return {
    content: textBlock(`Error [${detail.code}]: ${detail.message}`),
    structuredContent: { error: detail },
    isError: true,
  }
}

function toolResult(key, value) {
  return {
    content: textBlock(JSON.stringify(value, null, 2)),
    structuredContent: { [key]: value },
  }
}

function httpErrorCode(status) {
  if (status === 401) return 'UNAUTHORIZED'
  if (status === 403) return 'FORBIDDEN'
  if (status === 404) return 'NOT_FOUND'
  if (status === 429) return 'RATE_LIMITED'
  if (status >= 500) return 'UPSTREAM_ERROR'
  return 'UPSTREAM_HTTP_ERROR'
}

function errorMessage(payload, status) {
  if (payload && typeof payload === 'object' && typeof payload.error === 'string') {
    return payload.error
  }
  return `OpenDesign returned HTTP ${status}`
}

async function getJson(pathname) {
  let response
  try {
    response = await fetch(`${BASE_URL}${pathname}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new AdapterError('UPSTREAM_TIMEOUT', 'OpenDesign request timed out')
    }
    throw new AdapterError('UPSTREAM_UNAVAILABLE', 'OpenDesign is unavailable')
  }

  const text = await response.text()
  let payload
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    throw new AdapterError(
      'SCHEMA_INCOMPATIBLE',
      `OpenDesign returned invalid JSON for ${pathname}`,
      response.status,
    )
  }

  if (!response.ok) {
    throw new AdapterError(
      httpErrorCode(response.status),
      errorMessage(payload, response.status),
      response.status,
    )
  }
  return payload
}

function readString(record, key) {
  const value = record[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function readBoolean(record, key) {
  return typeof record[key] === 'boolean' ? record[key] : undefined
}

function readStringArray(record, key) {
  const value = record[key]
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return undefined
  return [...value]
}

function assignDefined(target, key, value) {
  if (value !== undefined) target[key] = value
}

function sanitizeDesignSystem(value, includeBody) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AdapterError('SCHEMA_INCOMPATIBLE', 'OpenDesign design system must be an object')
  }
  const record = value
  const id = readString(record, 'id')
  if (!id) throw new AdapterError('SCHEMA_INCOMPATIBLE', 'OpenDesign design system is missing id')
  const title = readString(record, 'title')
  if (!title) {
    throw new AdapterError('SCHEMA_INCOMPATIBLE', 'OpenDesign design system is missing title')
  }

  const result = { id, title }
  assignDefined(result, 'summary', readString(record, 'summary'))
  assignDefined(result, 'category', readString(record, 'category'))
  assignDefined(result, 'swatches', readStringArray(record, 'swatches'))
  assignDefined(result, 'surface', readString(record, 'surface'))
  if (includeBody) assignDefined(result, 'body', readString(record, 'body'))
  assignDefined(result, 'source', readString(record, 'source'))
  assignDefined(result, 'status', readString(record, 'status'))
  assignDefined(result, 'isEditable', readBoolean(record, 'isEditable'))
  assignDefined(result, 'createdAt', readString(record, 'createdAt'))
  assignDefined(result, 'updatedAt', readString(record, 'updatedAt'))
  return result
}

async function listDesignSystems() {
  const payload = await getJson('/api/design-systems')
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.designSystems)) {
    throw new AdapterError(
      'SCHEMA_INCOMPATIBLE',
      'OpenDesign list response must contain designSystems[]',
    )
  }
  return payload.designSystems.map((item) => sanitizeDesignSystem(item, false))
}

async function getDesignSystem(args) {
  const id = typeof args.id === 'string' ? args.id.trim() : ''
  if (!id) throw new AdapterError('INVALID_INPUT', 'id must be a non-empty string')
  const payload = await getJson(`/api/design-systems/${encodeURIComponent(id)}`)
  const detail =
    payload && typeof payload === 'object' && payload.designSystem !== undefined
      ? payload.designSystem
      : payload
  return sanitizeDesignSystem(detail, true)
}

const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
}

const TOOLS = [
  {
    name: 'opendesign_list_design_systems',
    description:
      'List locally installed OpenDesign design systems. Returns allowlisted summaries without DESIGN.md body, provenance or project identifiers.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: READ_ONLY_ANNOTATIONS,
  },
  {
    name: 'opendesign_get_design_system',
    description:
      'Read one locally installed OpenDesign design system by id. Returns allowlisted detail including DESIGN.md body.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', minLength: 1, description: 'OpenDesign id, for example user:aurora' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },
]

async function dispatchTool(name, args) {
  try {
    if (name === 'opendesign_list_design_systems') {
      return toolResult('designSystems', await listDesignSystems())
    }
    if (name === 'opendesign_get_design_system') {
      return toolResult('designSystem', await getDesignSystem(args))
    }
    throw new AdapterError('UNKNOWN_TOOL', `unknown or unavailable tool: ${String(name)}`)
  } catch (error) {
    return toolError(error)
  }
}

async function handle(message) {
  if (message.method === 'initialize') {
    return {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'opendesign-readonly-adapter', version: '0.1.0' },
    }
  }
  if (message.method === 'tools/list') return { tools: TOOLS }
  if (message.method === 'tools/call') {
    return dispatchTool(message.params?.name, message.params?.arguments || {})
  }
  if (message.method === 'shutdown') return null
  if (message.id === undefined) return undefined
  return { error: { code: -32601, message: `Method not found: ${String(message.method)}` } }
}

function send(message) {
  process.stdout.write(JSON.stringify(message) + '\n')
}

const input = createInterface({ input: process.stdin, crlfDelay: Infinity })
input.on('line', async (line) => {
  const text = line.trim()
  if (!text) return
  let message
  try {
    message = JSON.parse(text)
  } catch {
    return
  }

  try {
    const result = await handle(message)
    if (result !== undefined) send({ jsonrpc: '2.0', id: message.id, result })
  } catch (error) {
    send({
      jsonrpc: '2.0',
      id: message.id,
      error: { code: -32603, message: error instanceof Error ? error.message : String(error) },
    })
  }
})

process.on('SIGINT', () => process.exit(0))
process.on('SIGTERM', () => process.exit(0))

process.stderr.write('opendesign-readonly-adapter: ready\n')
