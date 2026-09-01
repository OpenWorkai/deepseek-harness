// Local replay cache only. OpenDesign remains the authoritative data source.
import type { Context } from '@deepseek-ai/cordis'
import { z } from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import type {
  OpenDesignSystemDetail,
  OpenDesignSystemId,
} from '../events.js'

const cachedDesignSystem = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string().optional(),
  summary: z.string().optional(),
  swatches: z.array(z.string()).optional(),
  surface: z.string().optional(),
  source: z.string().optional(),
  status: z.string().optional(),
  isEditable: z.boolean().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  cachedAt: z.string(),
}).strict()

export type CachedDesignSystemSummary = z.infer<typeof cachedDesignSystem>

export const OpenDesignReadCache = defineDomain({
  name: 'opendesign_read_cache',
  version: 1,
  tables: {
    design_systems: domainTable<string, CachedDesignSystemSummary>(cachedDesignSystem),
  },
})

export type OpenDesignCacheHandle = {
  put(designSystem: Omit<CachedDesignSystemSummary, 'cachedAt'>): Promise<void>
  get(id: string): Promise<CachedDesignSystemSummary | undefined>
  close(): Promise<void>
}

export type OpenDesignSessionDetailCache = {
  put(designSystem: OpenDesignSystemDetail): void
  get(id: OpenDesignSystemId): OpenDesignSystemDetail | undefined
  clear(): void
}

/** Keep full design-system details in disposable session memory. */
export function createOpenDesignSessionDetailCache(): OpenDesignSessionDetailCache {
  const details = new Map<OpenDesignSystemId, OpenDesignSystemDetail>()
  return {
    put(designSystem) {
      details.set(designSystem.id, designSystem)
    },
    get(id) {
      return details.get(id)
    },
    clear() {
      details.clear()
    },
  }
}

/** Open a disposable local cache for replayed list summaries. */
export async function openOpenDesignCache(ctx: Context): Promise<OpenDesignCacheHandle> {
  const domain = await ctx.storageDomain.open(OpenDesignReadCache)
  const table = domain.table('design_systems')
  return {
    async put(designSystem) {
      const record = cachedDesignSystem.parse({
        ...designSystem,
        cachedAt: new Date().toISOString(),
      })
      await table.put(record.id, record)
    },
    async get(id) {
      return table.get(id)
    },
    async close() {
      await domain.close()
    },
  }
}
