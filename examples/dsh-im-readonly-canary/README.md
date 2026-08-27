# dsh-im read-only Telegram canary

English | [中文](README.zh.md)

This example proves the real DSH Host Connection RPC path for the `@xmanrui/dsh-im` Telegram channel without enabling an OpenWork IM cutover. It only calls `connection.status`; it does not bind credentials, reconnect a bot, send a message, delete state, or expose a remote listener.

## Pinned dependency

The verified package is `@xmanrui/dsh-im@3.0.7`, corresponding to upstream commit `f4ded46278441641524642f02bb75297f0f5966b`. Install it into an isolated profile and home so the proof does not mutate an operator's normal DSH configuration:

```sh
CANARY_DSH_HOME="$(mktemp -d)"
DSH_HOME="$CANARY_DSH_HOME" pnpm dsh plugin --profile web add -w @xmanrui/dsh-im@3.0.7
```

## Start the real Host

Bind the Web Host to canonical IPv4 loopback. The probe intentionally rejects HTTPS, `localhost`, IPv6 loopback, LAN addresses, URL credentials, paths, queries, and fragments so the reviewed transport target has one representation:

```sh
DSH_HOME="$CANARY_DSH_HOME" pnpm dsh web --host 127.0.0.1 --port 39173 --no-open
```

## Probe the single-bot gate

In another shell, run the status-only probe:

```sh
node examples/dsh-im-readonly-canary/run-status-canary.mjs http://127.0.0.1:39173
```

The command succeeds only when the real Host reports exactly one configured and connected Telegram bot, a masked identity, `private-allowlist` access, and at least one numeric allowed Telegram user. Its output is a credential-free summary. Zero bots, multiple bots, a disconnected bot, a compatibility-mode bot, an open access policy, malformed RPC, response mismatch, redirect, or non-loopback target fails closed.

## Non-production credential boundary

Provisioning is a separate owner action in dsh-im. Use a dedicated non-production Telegram bot that is not simultaneously active in any existing bridge, approve only the intended canary user, and never paste its token into this example, a command line, logs, source control, or evidence. The probe accepts only the Host URL and never reads a token.

Passing this gate proves status reachability and the one-bot policy only. It does not authorize message send/receive, production use, remote access, multi-bot routing, credential migration, or replacement of an existing IM bridge.
