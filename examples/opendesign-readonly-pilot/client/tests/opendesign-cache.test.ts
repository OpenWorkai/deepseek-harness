import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import type { OpenDesignSystemDetail, OpenDesignSystemId } from '../src/events.ts'
import {
  createOpenDesignSessionDetailCache,
  openOpenDesignCache,
} from '../src/cache/opendesign-cache.ts'

function createStorageContext() {
  const stored = new Map<string, unknown>()
  const context = {
    storageDomain: {
      open: async () => ({
        table: () => ({
          put: async (key: string, value: unknown) => { stored.set(key, value) },
          get: (key: string) => stored.get(key),
        }),
        close: async () => {},
      }),
    },
  } as unknown as Context
  return { context, stored }
}

const id = 'agentic' as OpenDesignSystemId

describe('OpenDesign read caches', () => {
  it('rejects body before writing a persistent summary', async () => {
    const { context, stored } = createStorageContext()
    const cache = await openOpenDesignCache(context)

    await expect(cache.put({ id, title: 'Agentic', body: '# private' } as never)).rejects.toThrow()
    expect(stored.size).toBe(0)
  })

  it('persists only approved list summary fields', async () => {
    const { context, stored } = createStorageContext()
    const cache = await openOpenDesignCache(context)

    await cache.put({ id, title: 'Agentic', summary: 'Summary' })

    expect(stored.get(id)).toMatchObject({ id, title: 'Agentic', summary: 'Summary' })
    expect(stored.get(id)).not.toHaveProperty('body')
  })

  it('keeps detail body in memory and clears it with the session', () => {
    const cache = createOpenDesignSessionDetailCache()
    const detail: OpenDesignSystemDetail = { id, title: 'Agentic', body: '# private' }

    cache.put(detail)
    expect(cache.get(id)).toEqual(detail)

    cache.clear()
    expect(cache.get(id)).toBeUndefined()
  })
})
