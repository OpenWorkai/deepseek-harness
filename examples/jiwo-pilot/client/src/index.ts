// Host half of the OpenWork -> OpenDesign read-only pilot plugin.
//
// SCAFFOLD — independently type-checked, but not yet composed into the host
// build. To load it in production, add an `opendesign-pilot` entry to the host
// Cordis profile and include the package in the host/web build graph.
//
// Responsibilities (per MIGRATION_JIWO.md §5 Phase 1):
//   - own the local replay cache lifecycle (storage-domain, cache ONLY)
//   - register the settings namespace that the browser card binds to
// The tool execution itself is performed by the dsh-mcp-client overlay
// (jiwo-pilot.cordis.yml). A composed bridge would observe list/get results and
// emit the opendesign/list + opendesign/get session events.
import type { Context } from '@deepseek-ai/cordis'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import { openOpenDesignCache } from './cache/opendesign-cache.js'

export const OPENDESIGN_NS = settingsNamespace('opendesign-pilot')
export const inject = ['storageDomain']

export type Config = {
  endpoint?: string
}
export const Config: z<Config> = z.object({
  endpoint: z.string().default('http://127.0.0.1:7456'),
})

export function apply(ctx: Context, config: Config) {
  ctx.effect(async () => {
    const handle = await openOpenDesignCache(ctx)
    return async () => { await handle.close() }
  }, 'opendesign-pilot: read cache')

  let source = () => config
  installSettingsSection(ctx, OPENDESIGN_NS, Config, config, {
    setSource: (current) => {
      source = current
    },
    onChange: () => {
      void source()
    },
  })
}
