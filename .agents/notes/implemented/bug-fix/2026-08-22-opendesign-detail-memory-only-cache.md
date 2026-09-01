# Agent Note: Keep OpenDesign detail bodies out of persistent replay storage

Status: implemented

English | [中文](2026-08-22-opendesign-detail-memory-only-cache.zh.md)

## Problem

The OpenDesign pilot's replay-cache schema accepted the optional `body` field used by detail reads. Loading the Host scaffold could therefore persist design-system bodies even though the signed privacy decision permits durable replay storage only for list summaries. The domain and table names also used characters rejected by `storage-domain`, so the same scaffold failed before opening its cache.

## Decision

The persisted `opendesign_read_cache` domain contains only the approved list-summary fields and uses the valid `design_systems` table name. Its schema is strict, and the cache handle parses each record before writing it, so a runtime caller cannot smuggle `body` or another unknown field through a TypeScript cast or untyped boundary.

Full design-system details use a separate in-memory cache keyed by the branded design-system id. This cache has an explicit `clear()` operation and no storage-domain dependency. The Phase 1 composition must call `clear()` when its session, pilot path, or owning lifecycle ends.

## Alternatives considered

**Accept detail values and delete `body` before persistence.** Rejected because a blacklist can miss later sensitive fields and silently turns a caller error into an apparently successful write.

**Persist encrypted bodies.** Rejected because the signed Phase 0 decision selected summary-only persistence; encryption would still create a durable body copy and needs a separate retention and access decision.

**Remove replay storage entirely.** Rejected because disposable list-summary replay remains approved and useful without duplicating the OpenDesign fact source.

## Verification

The scoped cache tests prove that a record containing `body` is rejected before storage, approved summary fields persist without `body`, and an in-memory detail body disappears after `clear()`. The pilot's independent Host and browser type checks cover the exported cache types.

## Consequences

Persistent replay can reconstruct the list directory but cannot reconstruct a detail body after session teardown. A caller must fetch the detail from OpenDesign again, which preserves OpenDesign as the only durable fact source. Future summary fields require an explicit schema and privacy review before persistence.
