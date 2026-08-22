// Local replay cache only. OpenDesign remains the authoritative data source.
import type { Context } from '@deepseek-ai/cordis'
import { z } from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'

const cachedDesignSystem = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string().optional(),
  summary: z.string().optional(),
  swatches: z.array(z.string()).optional(),
  surface: z.string().optional(),
  body: z.string().optional(),
  source: z.string().optional(),
  status: z.string().optional(),
  isEditable: z.boolean().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  cachedAt: z.string(),
})

export type CachedDesignSystem = z.infer<typeof cachedDesignSystem>

export const OpenDesignReadCache = defineDomain({
  name: 'opendesign-read-cache',
  version: 1,
  tables: {
    designSystems: domainTable<string, CachedDesignSystem>(cachedDesignSystem),
  },
})

export type OpenDesignCacheHandle = {
  put(designSystem: Omit<CachedDesignSystem, 'cachedAt'>): Promise<void>
  get(id: string): Promise<CachedDesignSystem | undefined>
  close(): Promise<void>
}

/** Open a disposable local cache for replayed list/get results. */
export async function openOpenDesignCache(ctx: Context): Promise<OpenDesignCacheHandle> {
  const domain = await ctx.storageDomain.open(OpenDesignReadCache)
  const table = domain.table('designSystems')
  return {
    async put(designSystem) {
      await table.put(designSystem.id, { ...designSystem, cachedAt: new Date().toISOString() })
    },
    async get(id) {
      return table.get(id)
    },
    async close() {
      await domain.close()
    },
  }
}
