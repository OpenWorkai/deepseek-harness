# OpenWork → OpenDesign × DSH Read-only Pilot

English | [中文](README.zh.md)

> Phase 0 decision: **HOLD**. The real same-source P0-05 comparison and the P0-08 DSH bridge are complete; P0-03/04 owner boundary approval, P0-07 privacy approval, and sign-off on the §7 candidate thresholds remain outstanding.
>
> The evidence target and runtime contract are now OpenWork → OpenDesign design-systems. Jiwo / Arkme remain only as supporting evidence for the migration direction.

This pilot exposes the local OpenDesign HTTP API as two read-only MCP tools through `dsh-mcp-client`. OpenDesign and its `OD_DATA_DIR` remain the source of truth; the adapter does not persist business data, copy the database, or expose write tools.

## Approved Contract

| Tool | Input | Output | Boundary |
|---|---|---|---|
| `opendesign_list_design_systems` | None | Array of design-system summaries | Always removes `body`, `provenance`, `projectId`, and unknown fields |
| `opendesign_get_design_system` | `id: string` | One design system, optionally including `body` | Removes `provenance`, `projectId`, and unknown fields |

Both tools declare `readOnlyHint:true` and `destructiveHint:false`. The current minimum field allowlist is:

- list/get: `id`, `title`, `summary`, `category`, `swatches`, `surface`, `source`, `status`, `isEditable`, `createdAt`, `updatedAt`
- get additionally allows: `body`

This allowlist is the minimum P0-08 implementation; it is not evidence that P0-07 has been approved. Fields must not be expanded until the privacy / security owner signs off.

The adapter explicitly classifies `INVALID_INPUT`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `RATE_LIMITED`, `UPSTREAM_ERROR`, `UPSTREAM_TIMEOUT`, `UPSTREAM_UNAVAILABLE`, and `SCHEMA_INCOMPATIBLE`. Failures return MCP `isError:true`; silently degrading to an empty tool set is prohibited.

## Run the Real Read-only Path

Start the pinned OpenDesign daemon first:

```sh
cd <open-design-repo>
OD_DATA_DIR=<controlled-data-dir> \
  node apps/daemon/dist/cli.js --host 127.0.0.1 --port 7456 --no-open
```

Then start DSH from the DeepSeek Harness repository root:

```sh
OPENDESIGN_BASE_URL=http://127.0.0.1:7456 \
  pnpm dsh web --patch "$PWD/examples/opendesign-readonly-pilot/opendesign-readonly-pilot.cordis.yml"
```

The model can discover only:

- `mcp__opendesign__opendesign_list_design_systems`
- `mcp__opendesign__opendesign_get_design_system`

`OPENDESIGN_BASE_URL` accepts only loopback `http:` addresses. `failOnStartupError:true` ensures that adapter startup or synchronization failure makes DSH fail explicitly instead of appearing healthy with no tools.

## Verification

Contract and real DSH bridge tests:

```sh
pnpm exec vitest run --config examples/opendesign-readonly-pilot/vitest.config.mjs
```

Current coverage includes the exact tool inventory, list/get field allowlists, write-tool absence, seven upstream failure classes, real `dsh-mcp-client` discovery and execution, and the overlay configuration.

Collect DSH-path samples against a running real OpenDesign daemon:

```sh
OPENDESIGN_BASE_URL=http://127.0.0.1:7456 \
  node examples/opendesign-readonly-pilot/server/baseline-harness.mjs \
  --lists 100 --gets 200 --concurrency 50 --warmup 5 --json
```

This single-path command is a quick adapter check. The complete P0-05 run uses [`server/p0-05-collect.mjs`](server/p0-05-collect.mjs) to execute the real OpenWork renderer → IPC path, the DSH MCP path, and the legacy-path fallback after DSH stops. See the controlled [`P0-05 comparison evidence`](evidence/opendesign-p0-05-comparison.md).

## Rollback

1. Stop DSH with the overlay, or remove `opendesign-readonly-pilot.cordis.yml` from the launch command.
2. The native OpenWork IPC path continues reading the same OpenDesign daemon / `OD_DATA_DIR`.
3. This pilot has no schema changes, business-data copies, or writes, so no reverse data migration is required.

P0-05 automatically verified that the legacy IPC path can list/get from the same `OD_DATA_DIR` after the DSH path stops. The manual traffic-switch drill after production Host integration remains a Phase 1 acceptance item.

## Client Scaffold

`client/` is a Host + browser draft that is not wired into the production build:

- `src/events.ts`: `opendesign/list` and `opendesign/get` replay events
- `src/cache/opendesign-cache.ts`: disposable local replay cache, not a source of truth
- `src/index.ts`: Host cache lifecycle and the `opendesign-pilot` settings namespace
- `src/client/index.ts`: read-only settings card and `opendesign-result` replay node
- `tsconfig.host.json` / `tsconfig.client.json`: validate the Host and browser entry points separately
- `tsconfig.json`: combines the two independent type checks without wiring this package into the Host build

It has no write events or write UI. The directory is a workspace member for dependency resolution and independent type checking, so both Host and browser types are checked. It is still not integrated into the production Host / web build or Cordis composition; actual event production, UI replay, and upgrade compatibility remain integration work.

```sh
pnpm exec tsc -b examples/opendesign-readonly-pilot/client/tsconfig.json
```

## File Map

```text
examples/opendesign-readonly-pilot/
├── PHASE0.md
├── README.md
├── README.zh.md
├── opendesign-readonly-pilot.cordis.yml
├── vitest.config.mjs
├── evidence/
│   ├── opendesign-dsh-readonly-e2e.md
│   ├── opendesign-p0-05-comparison.md
│   └── opendesign-p0-07-owner-review.md
├── server/
│   ├── opendesign-readonly-server.mjs
│   ├── baseline-harness.mjs
│   ├── p0-05-collect.mjs
│   └── tests/opendesign.contract.test.mjs
└── client/
    ├── package.json
    ├── tsconfig.host.json
    ├── tsconfig.client.json
    ├── tsconfig.json
    └── src/
        ├── events.ts
        ├── cache/opendesign-cache.ts
        ├── index.ts
        └── client/index.ts
```

## Remaining Read-only GO Blockers

- P0-01: record the formal startup owner and owner sign-off
- P0-03 / P0-04: obtain owner sign-off on data retention / deletion and the local authorization boundary
- P0-07: obtain owner approval for the field allowlist, log-deny fields, and masking rules
- §7: freeze the populated candidate thresholds for success rate, latency, concurrency, resources, and recovery

The `opendesign_create_design_system` write operation is outside this GO decision. Do not add it without credible approval plus evidence for request idempotency, auditability, and compensation.
