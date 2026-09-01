# Agent Note: OpenDesign read-only baseline evidence

Status: implemented

English | [中文](2026-08-22-opendesign-readonly-baseline-evidence.zh.md)

## Problem

The OpenDesign read-only pilot had DSH-side contract and real-daemon evidence, but it had no repeatable comparison against the actual OpenWork renderer-to-IPC path. The DSH sampler alone could not prove old-path equivalence. OpenWork also collapsed missing resources into `null` and omitted several OpenDesign fields, so counting a resolved call as success would have produced a false baseline.

## Decision

The historical `jiwo-pilot` example is named `opendesign-readonly-pilot`. Its P0-05 collector runs three controlled phases sequentially against one caller-owned `OD_DATA_DIR`: OpenWork renderer-to-IPC, the DSH adapter, and an OpenWork fallback smoke after the DSH path stops. Separate reports preserve golden-object invariants, normalized list/get snapshots, latency, concurrency, resource scopes, error classification, and restart recovery. The comparison passes only when every required check succeeds and field differences are empty.

OpenWork honors an explicit `OD_DATA_DIR`, with an explicit constructor option retaining precedence. A source-tree evidence run may also opt into an ABI-compatible Node runtime without changing packaged runtime selection. The OpenWork client preserves the same allowlisted design-system fields as the DSH adapter, excludes `body` from list results, includes it in get results, and preserves a 404 as `NOT_FOUND` across renderer IPC.

Machine-readable JSON remains gitignored because paths, ports, timings, and process samples are run-specific. The controlled Markdown evidence records the fixed commits, command shape, result, metric scope, and release meaning.

## Alternatives considered

**Use OpenWork's default application data directory and point DSH at it afterwards.** Rejected because the location is platform- and mode-dependent, is not caller-controlled, and makes the same-source claim difficult to reproduce safely.

**Call `OpenDesignDaemonClient` directly from a Node benchmark.** Rejected because it skips the renderer and IPC boundaries that P0-05 measures.

**Treat `[]`, `null`, or a non-throwing call as success.** Rejected because those values were defensive fallbacks for unavailable, invalid, and not-found responses.

**Infer rollback from independent processes.** Rejected because a one-way old-path-to-DSH comparison would leave the documented fallback condition unmeasured. The collector therefore reopens the native IPC path after DSH exits.

**Run both daemon processes concurrently against one directory.** Rejected because concurrent writers or file watchers would make the comparison unsafe and timing-dependent even though this pilot is read-only.

## Verification

The fixed comparison used OpenWork `9e774879`, OpenDesign `0c7955de`, and DeepSeek Harness `89b38861`. Both paths completed 20/20 list reads, 20/20 get reads, and 20/20 concurrent reads. Normalized list/get differences were empty, errors remained classified, both recovery checks passed, and the post-DSH OpenWork fallback smoke succeeded. All 13 comparison checks passed as `P0-05-PASS`.

Sixteen pilot Vitest contracts and both client TypeScript projects pass. OpenWork's seven focused unit tests, package build, scoped lint and formatting pass. Its full suite has unrelated pre-existing failures, and its full typecheck has unrelated Workshop/Cline errors; these are recorded as verification limits rather than attributed to P0-05.

## Consequences

P0-05 no longer blocks read-only GO. The fixed evidence also prevents future collectors from weakening missing-field semantics or claiming fallback without a post-DSH native read.

The result is not an overall Phase 0 GO. P0-03/P0-04 owner boundaries, P0-07 privacy approval, and owner-frozen Phase 1 thresholds remain separate gates. OpenWork full-process-tree RSS and DSH adapter-only RSS have different scopes and cannot be subtracted or combined into a migration-overhead claim. A single-machine run informs candidate thresholds but does not establish production capacity.
