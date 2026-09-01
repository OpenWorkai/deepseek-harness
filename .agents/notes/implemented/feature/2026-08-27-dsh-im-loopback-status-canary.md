# Agent Note: Canonical loopback status proof for dsh-im

Status: implemented

English | [中文](2026-08-27-dsh-im-loopback-status-canary.zh.md)

## Problem

OpenWork needed evidence that a future dsh-im adapter could reach the real DSH Host without weakening the signed local-only, read-only boundary. Package-level mocks could not prove the Connection RPC wire envelope, Host authority enforcement, or a safe readiness condition for one non-production Telegram bot.

## Decision

Add a runnable example that calls only `/telegram/connection.status` through the real DSH Connection RPC envelope. The transport accepts only the canonical `http://127.0.0.1:<port>` origin, refuses redirects, correlates the response `rpcId`, rejects malformed envelopes, and performs no retry. A separate assertion fails closed unless the status reports exactly one configured and connected bot with a masked identity, `private-allowlist` access, and at least one numeric allowed user. Its returned summary excludes credentials and unmasked identity data.

The example pins `@xmanrui/dsh-im@3.0.7`, corresponding to upstream commit `f4ded46278441641524642f02bb75297f0f5966b`, and documents an isolated `DSH_HOME`. Credential provisioning remains an explicit owner action through dsh-im and must use a dedicated non-production bot. The probe never accepts or reads a token.

## Alternatives considered

**Call dsh-im controller code directly.** This would bypass the DSH Host and fail to prove the Connection RPC carrier or loopback authority.

**Accept every loopback spelling and HTTPS.** Multiple target representations complicate review and can interact differently with proxy and URL handling. One canonical origin keeps the facility contract narrow.

**Exercise send and receive in the same change.** Message traffic introduces external side effects, credential handling, update deduplication, and cutover semantics. Those require a separately approved non-production canary after status readiness.

## Verification

Thirteen focused tests cover the exact request envelope, cancellation, canonical target validation, HTTP and JSON failures, response correlation, safe summary projection, and failure for zero, multiple, disconnected, or compatibility-mode bots. An isolated real DSH Web Host with `@xmanrui/dsh-im@3.0.7` returned the expected disconnected zero-bot status; a forged non-loopback `Host` header was rejected with HTTP 403; the single-bot assertion failed closed as designed because no credential was provisioned.

## Consequences

The repository now has a reproducible transport and readiness proof without activating an IM replacement. A live Telegram canary still requires an owner-provisioned dedicated non-production bot. Passing this status gate does not authorize message traffic, production use, remote access, multi-bot routing, or replacement of an existing bridge.
