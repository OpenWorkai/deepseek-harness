// Scoped vitest config for the Jiwo pilot.
//
// Run with:
//   pnpm exec vitest run --config examples/jiwo-pilot/vitest.config.mjs
//
// Deliberately isolated from the monorepo's root vitest suite (examples/ is
// not a workspace package and must not affect `pnpm test` or CI). The pilot
// tests speak real JSON-RPC to the spawned stub server, so they need no
// build step and no extra dependencies.
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  test: {
    root,
    environment: 'node',
    include: ['server/tests/**/*.test.mjs'],
    testTimeout: 20000,
    pool: 'forks',
  },
})
