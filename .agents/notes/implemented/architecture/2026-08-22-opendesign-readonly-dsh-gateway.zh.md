# Agent Note: 通过 DSH 所属网关传递 OpenWork 只读调用

Status: implemented

[English](2026-08-22-opendesign-readonly-dsh-gateway.md) | 中文

## Problem

OpenDesign 试点已经具备验证过的 MCP 适配器与 DSH 侧工具运行时，但 OpenWork 仍缺少调用这些工具的确定性进程协议。由 OpenWork 直接启动适配器会绕过 DSH，无法证明已批准的 OpenWork → DSH → OpenDesign 路径。通过常规 agent loop（智能体循环）驱动读取会让一次读取依赖模型选择与工具选择，而启用 DSH Web host 又会超出已签署的本机非生产边界。

## Decision

试点使用受支持的 DSH loader 组合、`dsh-tools`、`dsh-mcp-client`，以及试点本地的 stdio 网关插件。网关为初始化、精确工具发现、工具调用、取消和关闭提供精简的 JSON lines JSON-RPC 协议。它把两个已批准的公开名称映射到 DSH 工具注册表，并通过 `ctx.tools.execute` 执行；它绝不会代表 OpenWork 直接启动或调用 OpenDesign 适配器。

隔离的 Cordis 配置不加载模型、agent、console logger 或 Web host。MCP 启动失败会快速失败，OpenWork 在 spawn 前校验运行时入口、配置、锁文件、适配器与网关的 hash。OpenWork 还会拒绝非 loopback 的 OpenDesign URL；除非运行时身份与完整工具目录精确匹配已签署的双工具约定，否则拒绝启动。

OpenWork 在主进程 client 中拥有子进程。该 owner 会合并并发启动、转发取消、在进程退出时拒绝进行中的请求、尝试协议关闭，并依次升级到 `SIGTERM` 与 `SIGKILL`。renderer 既不会得到进程句柄，也不会得到 DSH 路径。激活与原生路径选择仍属于 Phase 1 服务工作；本决策不连接生产 Host、Web 表面或 UI。

## Alternatives considered

**由 OpenWork 直接启动 MCP 适配器。** 拒绝，因为这会绕过 DSH 工具设施，不能满足 P1-01。

**通过 DSH agent 会话调用读取。** 拒绝，因为模型推理与自主工具选择会让确定性的应用读取依赖提示词和提供方行为。

**向 OpenWork 暴露 DSH Web host。** 拒绝，因为已签署范围排除了生产 Host/web 集成与远程访问。

## Verification

约定测试套件会启动真实的 DSH JSON-RPC demo loader、初始化网关、断言精确的双工具目录、通过 `ctx.tools.execute` 执行 list 与 get、拒绝写工具，并扫描 stderr 是否出现禁止的详情与私有 fixture 值。OpenWork 单元测试覆盖 spawn 前产物校验、loopback 强制、精确目录拒绝、并发启动所有权、取消、进程退出与关闭。跨仓库冒烟运行使用真实 OpenWork owner、DSH 运行时、MCP 适配器与 loopback OpenDesign fixture；list 不含 `body`，get 返回 `body`。

## Consequences

试点获得确定性的 DSH 所属读取路径，同时不把 DSH 变为数据源。OpenDesign 保持唯一事实源，原生 OpenWork IPC 路径不变。网关刻意只暴露两个已批准的只读工具和通用协议错误；更细的失败分类、来源选择、typed IPC 与 UI 状态属于后续 Phase 1 切片，并且不得把失败静默转换为空成功值。
