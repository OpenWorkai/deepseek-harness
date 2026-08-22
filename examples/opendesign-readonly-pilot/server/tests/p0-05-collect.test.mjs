import { expect, test } from 'vitest'
import { compareReports } from '../p0-05-collect.mjs'

function report(sample) {
  return {
    meta: { goldenId: 'agentic', dataDir: '/controlled/opendesign' },
    sample,
    golden: { list: { successRate: 100 }, get: { successRate: 100 } },
    concurrency: { successRate: 100 },
    resources: { rssDeltaMiB: 1 },
    latency: { listMs: { p95: 1, p99: 2 }, getMs: { p95: 2, p99: 3 } },
  }
}

test('marks aligned, classified read-only evidence as P0-05-PASS', () => {
  const sample = {
    listGolden: { id: 'agentic', title: 'Agentic' },
    getGolden: { id: 'agentic', title: 'Agentic', body: '# Agentic' },
  }
  const openWork = {
    ...report(sample),
    errors: { notFound: { classified: true } },
    recovery: { restarted: true, firstReadSucceeded: true },
  }
  const dsh = {
    ...report(sample),
    discovery: { exactReadOnlySet: true },
    errors: { notFound: { classified: true }, missingId: { classified: true } },
    recovery: { readyAfterRestart: true, firstReadSucceeded: true },
  }

  expect(compareReports(openWork, dsh, {}, openWork)).toMatchObject({
    decision: 'P0-05-PASS',
    goEligible: true,
    checks: { fallbackAfterDshSucceeded: true },
    differences: { list: [], get: [] },
  })
})

test('preserves field gaps and unclassified legacy null errors as HOLD evidence', () => {
  const openWork = {
    ...report({
      listGolden: { id: 'agentic' },
      getGolden: { id: 'agentic', body: '# Agentic' },
    }),
    errors: { notFound: { classified: false } },
    recovery: { restarted: true, firstReadSucceeded: true },
  }
  const dsh = {
    ...report({
      listGolden: { id: 'agentic', title: 'Agentic' },
      getGolden: { id: 'agentic', title: 'Agentic', body: '# Agentic' },
    }),
    discovery: { exactReadOnlySet: true },
    errors: { notFound: { classified: true } },
    recovery: { readyAfterRestart: true, firstReadSucceeded: true },
  }

  const comparison = compareReports(openWork, dsh)

  expect(comparison.decision).toBe('P0-05-HOLD')
  expect(comparison.checks.openWorkErrorsClassified).toBe(false)
  expect(comparison.checks.fallbackAfterDshSucceeded).toBe(false)
  expect(comparison.differences.list).toEqual([{ key: 'title', openWork: null, dsh: 'Agentic' }])
  expect(comparison.differences.get).toEqual([{ key: 'title', openWork: null, dsh: 'Agentic' }])
})
