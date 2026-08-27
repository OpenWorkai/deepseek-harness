# Agent Note: Route OpenWork read-only calls through a DSH-owned gateway

Status: implemented

English | [中文](2026-08-22-opendesign-readonly-dsh-gateway.zh.md)

## Problem

The OpenDesign pilot had a verified MCP adapter and a DSH-side tool runtime, but OpenWork still lacked a deterministic process protocol for invoking those tools. Starting the adapter directly from OpenWork would bypass DSH and could not prove the approved OpenWork → DSH → OpenDesign path. Driving the ordinary agent loop would make a read depend on model selection and tool choice, while enabling the DSH Web host would exceed the signed local, non-production boundary.

## Decision

The pilot uses the supported DSH loader composition with `dsh-tools` and `dsh-mcp-client`, plus a pilot-local stdio gateway plugin. The gateway exposes a small JSON-lines JSON-RPC protocol for initialization, exact tool discovery, tool calls, cancellation, and shutdown. It maps the two approved public names to the DSH tool registry and executes them through `ctx.tools.execute`; it never starts or calls the OpenDesign adapter directly on OpenWork's behalf.

The isolated Cordis config loads no model, agent, console logger, or Web host. MCP startup failures are fatal, and OpenWork verifies the hashes of the runtime entry, config, lockfile, adapter, and gateway before spawn. OpenWork also rejects non-loopback OpenDesign URLs and refuses startup unless the runtime identity and complete catalog exactly match the signed two-tool contract.

OpenWork owns the child process in its main-process client. That owner coalesces concurrent starts, forwards cancellation, rejects in-flight requests on process exit, attempts protocol shutdown, and escalates through `SIGTERM` and `SIGKILL`. The renderer receives neither a process handle nor a DSH path. Activation and native-path selection remain Phase 1 service work; this decision does not connect a production Host, Web surface, or UI.

## Alternatives considered

**Start the MCP adapter directly from OpenWork.** Rejected because this bypasses the DSH tool facilities and cannot satisfy P1-01.

**Invoke the read through a DSH agent session.** Rejected because model inference and autonomous tool selection would make a deterministic application read depend on prompt and provider behavior.

**Expose the DSH Web host to OpenWork.** Rejected because the signed scope excludes production Host/web integration and remote access.

## Verification

The contract suite spawns the real DSH JSON-RPC demo loader, initializes the gateway, asserts the exact two-tool catalog, executes list and get through `ctx.tools.execute`, rejects a write tool, and scans stderr for prohibited detail and private fixture values. OpenWork unit tests cover artifact verification before spawn, loopback enforcement, exact catalog rejection, concurrent startup ownership, cancellation, process exit, and shutdown. A cross-repository smoke run used the real OpenWork owner, DSH runtime, MCP adapter, and a loopback OpenDesign fixture; list omitted `body`, while get returned it.

## Consequences

The pilot gains a deterministic DSH-owned read path without making DSH a data source. OpenDesign remains the sole fact source, and the native OpenWork IPC path is unchanged. The gateway deliberately exposes only the two approved read tools and generic protocol errors; richer failure classification, source selection, typed IPC, and UI state belong to the later Phase 1 slices and must not silently turn failures into empty success values.
