// Host half of the Jiwo pilot plugin.
//
// SCAFFOLD — not yet composed into the host build (see README "Composing the
// client plugin"). The matches the cookbook adding-a-settings-card.md exactly;
// to actually load it, register this package in pnpm-workspace.yaml and
// tsconfig.host.json, then add a `jiwo-pilot` entry to your cordis profile.
//
// Responsibilities (per MIGRATION_JIWO.md §5 Phase 1):
//   - own the local cache lifecycle (storage-domain, cache ONLY)
//   - register the settings namespace that the browser card binds to
// The tool execution itself is performed by the dsh-mcp-client overlay
// (jiwo-pilot.cordis.yml); a production Jiwo adapter would observe those tool
// results and emit the jiwo/read + jiwo/tag_write session events.
import type { Context } from '@deepseek-ai/cordis'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import { openJiwoCache, type JiwoCacheHandle } from './cache/jiwo-cache.js'

export const JIWO_NS = settingsNamespace('jiwo-pilot')
export const inject = ['storage']

export interface Config {
  endpoint?: string
}
export const Config: z<Config> = z.object({
  endpoint: z.string().default('stub'),
})

export function apply(ctx: Context, config: Config) {
  // Local cache (storage-domain): cache ONLY, never authoritative data.
  let handle: JiwoCacheHandle | undefined
  ctx.effect(() => {
    let disposed = false
    void openJiwoCache(ctx).then((h) => {
      if (disposed) h.close()
      else handle = h
    })
    return () => {
      disposed = true
      handle?.close()
    }
  })

  // The namespace is the join key the browser card registers against.
  installSettingsSection(ctx, JIWO_NS, Config, config, {})
}
