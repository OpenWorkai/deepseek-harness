# Agent Note: 禁止 OpenDesign 详情正文进入持久回放存储

Status: implemented

[English](2026-08-22-opendesign-detail-memory-only-cache.md) | 中文

## Problem

OpenDesign 试点的回放缓存 schema 接受详情读取使用的可选 `body` 字段，因此 Host 脚手架可能持久化设计系统正文，但已签署的隐私决议只允许 list 摘要进入持久回放存储。domain 与 table 名还使用了 `storage-domain` 拒绝的字符，使同一脚手架在打开缓存前就会失败。

## Decision

持久化的 `opendesign_read_cache` domain 只包含已批准的 list 摘要字段，并使用有效的 `design_systems` table 名。schema 采用严格模式，缓存 handle 在写入前解析每条记录，因此运行时调用方不能通过 TypeScript 类型转换或无类型边界夹带 `body` 或其他未知字段。

完整设计系统详情使用按品牌化设计系统 id 索引的独立内存缓存。该缓存提供显式 `clear()` 操作且不依赖 storage-domain。Phase 1 组合必须在会话、试点路径或所属生命周期结束时调用 `clear()`。

## Alternatives considered

**接受详情值并在持久化前删除 `body`。** 拒绝，因为黑名单可能遗漏后续敏感字段，并把调用方错误静默转换为看似成功的写入。

**持久化加密正文。** 拒绝，因为已签署的 Phase 0 决议选择仅持久化摘要；加密仍会创建正文的持久副本，并需要另行决定保留期与访问权限。

**完全移除回放存储。** 拒绝，因为可丢弃的 list 摘要回放已经获批，并且不会复制 OpenDesign 事实源。

## Verification

聚焦缓存测试证明：含 `body` 的记录在存储前被拒绝，批准的摘要字段可在不含 `body` 的情况下持久化，内存详情正文在 `clear()` 后消失。试点独立的 Host 与 browser 类型检查覆盖导出的缓存类型。

## Consequences

持久回放可以重建设计系统列表，但不能在会话清理后重建详情正文。调用方必须再次从 OpenDesign 读取详情，从而保持 OpenDesign 为唯一持久事实源。未来摘要字段必须经过显式 schema 与隐私评审后才能持久化。
