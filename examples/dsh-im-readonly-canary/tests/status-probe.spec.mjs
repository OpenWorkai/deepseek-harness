import { describe, expect, it, vi } from 'vitest'
import {
  assertSingleTelegramCanary,
  probeTelegramStatus,
} from '../status-probe.mjs'

const RPC_ID = '00000000-0000-4000-8000-000000000001'

function response(body, init) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

function connectedSnapshot(overrides = {}) {
  return {
    ok: true,
    value: {
      schemaVersion: 1,
      revision: 4,
      state: 'connected',
      bots: [{
        botId: 'telegram_0123456789abcdef01234567',
        state: 'connected',
        connected: true,
        configured: true,
        bot: {
          name: 'Non-production bot',
          username: 'private_canary_bot',
          idMasked: '123456•••6789',
        },
        health: { lastCheckedAt: 1_777_777_777 },
        accessPolicy: {
          accessMode: 'private-allowlist',
          allowedUsers: ['123456789'],
        },
        token: 'must-not-be-returned',
      }],
      totals: { configured: 1, connected: 1 },
      ...overrides,
    },
  }
}

describe('dsh-im real Host loopback status probe', () => {
  it('posts the DSH Connection RPC envelope and validates response correlation', async () => {
    const doFetch = vi.fn().mockResolvedValue(response({
      type: 'server-response',
      rpcId: RPC_ID,
      result: connectedSnapshot(),
    }))
    const controller = new AbortController()

    const result = await probeTelegramStatus('http://127.0.0.1:3080', {
      doFetch,
      rpcId: () => RPC_ID,
      signal: controller.signal,
    })

    expect(result).toEqual(connectedSnapshot())
    expect(doFetch).toHaveBeenCalledOnce()
    const [url, init] = doFetch.mock.calls[0]
    expect(url).toEqual(new URL('http://127.0.0.1:3080/telegram/connection.status'))
    expect(init).toMatchObject({
      method: 'POST',
      redirect: 'error',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
    })
    expect(JSON.parse(init.body)).toEqual({
      type: 'client-request',
      rpcId: RPC_ID,
      method: 'connection.status',
      payload: {},
    })
  })

  it.each([
    'https://127.0.0.1:3080',
    'http://localhost:3080',
    'http://[::1]:3080',
    'http://192.168.1.50:3080',
    'http://user:pass@127.0.0.1:3080',
    'http://127.0.0.1:3080/api',
  ])('rejects a non-canonical loopback Host URL: %s', async (baseUrl) => {
    const doFetch = vi.fn()

    await expect(probeTelegramStatus(baseUrl, { doFetch, rpcId: () => RPC_ID }))
      .rejects.toThrow('requires http://127.0.0.1:<port>')
    expect(doFetch).not.toHaveBeenCalled()
  })

  it('rejects HTTP failures, malformed envelopes, and mismatched response IDs', async () => {
    await expect(probeTelegramStatus('http://127.0.0.1:3080', {
      doFetch: vi.fn().mockResolvedValue(new Response('forbidden', { status: 403 })),
      rpcId: () => RPC_ID,
    })).rejects.toThrow('HTTP 403')

    await expect(probeTelegramStatus('http://127.0.0.1:3080', {
      doFetch: vi.fn().mockResolvedValue(response({ nope: true })),
      rpcId: () => RPC_ID,
    })).rejects.toThrow('invalid server-response envelope')

    await expect(probeTelegramStatus('http://127.0.0.1:3080', {
      doFetch: vi.fn().mockResolvedValue(response({
        type: 'server-response',
        rpcId: '00000000-0000-4000-8000-000000000002',
        result: connectedSnapshot(),
      })),
      rpcId: () => RPC_ID,
    })).rejects.toThrow('response correlation failed')
  })

  it('reduces one connected allowlisted bot to a secret-free canary result', () => {
    const summary = assertSingleTelegramCanary(connectedSnapshot())

    expect(summary).toEqual({
      ready: true,
      channel: 'telegram',
      configured: 1,
      connected: 1,
      botId: 'telegram_0123456789abcdef01234567',
      identityMasked: '123456•••6789',
      accessMode: 'private-allowlist',
    })
    expect(JSON.stringify(summary)).not.toMatch(/Non-production bot|private_canary_bot|"123456789"|must-not-be-returned/)
  })

  it.each([
    connectedSnapshot({ bots: [], totals: { configured: 0, connected: 0 } }),
    connectedSnapshot({
      bots: [connectedSnapshot().value.bots[0], connectedSnapshot().value.bots[0]],
      totals: { configured: 2, connected: 2 },
    }),
    connectedSnapshot({
      bots: [{ ...connectedSnapshot().value.bots[0], connected: false, state: 'offline' }],
      totals: { configured: 1, connected: 0 },
    }),
    connectedSnapshot({
      bots: [{
        ...connectedSnapshot().value.bots[0],
        accessPolicy: { accessMode: 'compatible', allowedUsers: [] },
      }],
    }),
  ])('fails closed unless exactly one connected private-allowlist bot is present', (snapshot) => {
    expect(() => assertSingleTelegramCanary(snapshot)).toThrow('single-bot canary is not ready')
  })
})
