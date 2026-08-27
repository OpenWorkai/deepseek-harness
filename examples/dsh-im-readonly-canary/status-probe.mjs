import { randomUUID } from 'node:crypto'

const TELEGRAM_STATUS_PATH = '/telegram/connection.status'
const TELEGRAM_BOT_ID = /^telegram_[a-f0-9]{24}$/u
const NUMERIC_TELEGRAM_USER_ID = /^[1-9]\d{0,15}$/u

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value
    : null
}

function loopbackBaseUrl(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error('dsh-im canary requires http://127.0.0.1:<port>')
  }
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.port === ''
    || url.username !== '' || url.password !== '' || url.pathname !== '/'
    || url.search !== '' || url.hash !== '') {
    throw new Error('dsh-im canary requires http://127.0.0.1:<port>')
  }
  return url
}

/**
 * Call dsh-im's read-only Telegram status endpoint through the real DSH Host
 * Connection RPC carrier. The caller owns timeout and cancellation policy.
 */
export async function probeTelegramStatus(baseUrl, options = {}) {
  const origin = loopbackBaseUrl(baseUrl)
  const doFetch = options.doFetch ?? globalThis.fetch
  const rpcId = (options.rpcId ?? randomUUID)()
  const response = await doFetch(new URL(TELEGRAM_STATUS_PATH, origin), {
    method: 'POST',
    redirect: 'error',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'client-request',
      rpcId,
      method: 'connection.status',
      payload: {},
    }),
    ...options.signal === undefined ? {} : { signal: options.signal },
  })
  if (!response.ok) {
    throw new Error(`dsh-im canary transport failed: HTTP ${String(response.status)}`)
  }

  let body
  try {
    body = await response.json()
  } catch {
    throw new Error('dsh-im canary received an invalid server-response envelope')
  }
  const envelope = record(body)
  if (envelope?.type !== 'server-response' || typeof envelope.rpcId !== 'string'
    || !Object.hasOwn(envelope, 'result')) {
    throw new Error('dsh-im canary received an invalid server-response envelope')
  }
  if (envelope.rpcId !== rpcId) {
    throw new Error('dsh-im canary response correlation failed')
  }
  return envelope.result
}

/**
 * Fail closed unless the status proves one connected, private-allowlisted
 * Telegram bot. The returned summary omits credential and identity details.
 */
export function assertSingleTelegramCanary(result) {
  const rpcResult = record(result)
  const value = record(rpcResult?.value)
  const bots = value?.bots
  const totals = record(value?.totals)
  const bot = Array.isArray(bots) && bots.length === 1 ? record(bots[0]) : null
  const identity = record(bot?.bot)
  const policy = record(bot?.accessPolicy)
  const allowedUsers = policy?.allowedUsers
  const ready = rpcResult?.ok === true
    && totals?.configured === 1
    && totals?.connected === 1
    && bot?.connected === true
    && bot?.state === 'connected'
    && typeof bot?.botId === 'string'
    && TELEGRAM_BOT_ID.test(bot.botId)
    && typeof identity?.idMasked === 'string'
    && identity.idMasked.length > 0
    && policy?.accessMode === 'private-allowlist'
    && Array.isArray(allowedUsers)
    && allowedUsers.length > 0
    && allowedUsers.every(userId => typeof userId === 'string' && NUMERIC_TELEGRAM_USER_ID.test(userId))

  if (!ready) throw new Error('dsh-im Telegram single-bot canary is not ready')
  return {
    ready: true,
    channel: 'telegram',
    configured: 1,
    connected: 1,
    botId: bot.botId,
    identityMasked: identity.idMasked,
    accessMode: 'private-allowlist',
  }
}
