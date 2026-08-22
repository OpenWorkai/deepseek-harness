// Scoped vitest config for the OpenWork -> OpenDesign read-only pilot.
//
// Run with:
//   pnpm exec vitest run --config examples/jiwo-pilot/vitest.config.mjs
//
// Deliberately isolated from the monorepo's root vitest suite (examples/ is
// not a workspace package and must not affect `pnpm test` or CI). The pilot
// tests speak real JSON-RPC to the adapter and also exercise the real
// dsh-mcp-client bridge, so they need no build step or extra dependencies.
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    root,
    environment: 'node',
    include: ['server/tests/**/*.test.mjs'],
    testTimeout: 20000,
    pool: 'forks',
  },
})
