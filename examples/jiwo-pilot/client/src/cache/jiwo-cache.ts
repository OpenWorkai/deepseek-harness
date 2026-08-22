// jiwo-cache.ts — LOCAL CACHE ONLY.
//
// Per MIGRATION_JIWO.md §1/§5, `storage-domain` is a schema-validated KV doc
// layer, NOT a relational business DB. In the pilot it is used solely to cache
// notes retrieved from Jiwo so the UI can replay results across session
// reloads without re-querying the backend on every paint. It holds NO
// authoritative Jiwo data and performs NO migration of personal-data tables.
//
// API follows packages/storage/storage-domain/README.md and its test suite:
//   defineDomain -> DomainFacility(ctx,{backend,routes}) ->
//   ctx.storage.mount('domain', facility) -> facility.open(spec) ->
//   domain.table('notes').put(key, value) / .get(key).
import type { Context } from '@deepseek-ai/cordis'
import { defineDomain, DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import z from '@deepseek-ai/schemastery'

export interface CachedNote {
  readonly id: string
  readonly title: string
  readonly body: string
  readonly tags: readonly string[]
  readonly updatedAt: string
  readonly cachedAt: string
}

export const JiwoNoteCache = defineDomain({
  name: 'jiwo-note-cache',
  version: 1,
  tables: {
    notes: z.object({
      id: z.string(),
      title: z.string(),
      body: z.string(),
      tags: z.array(z.string()),
      updatedAt: z.string(),
      cachedAt: z.string(),
    }),
  },
})

export interface JiwoCacheHandle {
  put(note: Omit<CachedNote, 'cachedAt'>): Promise<void>
  get(id: string): Promise<CachedNote | undefined>
  close(): void
}

/**
 * Open the local Jiwo note cache. `backend` resolves to the host's configured
 * storage backend; 'memory' is the safe default for a cache (lost on restart,
 * which is acceptable for a cache).
 */
export async function openJiwoCache(ctx: Context, backend = 'memory'): Promise<JiwoCacheHandle> {
  const facility = new DomainFacility(ctx, { backend, routes: {} })
  ctx.storage.mount('domain', facility)
  const domain = await facility.open(JiwoNoteCache)
  const table = domain.table('notes')
  return {
    async put(note) {
      await table.put(note.id, { ...note, cachedAt: new Date().toISOString() })
    },
    async get(id) {
      return (await table.get(id)) as CachedNote | undefined
    },
    close() {
      domain.close()
    },
  }
}
