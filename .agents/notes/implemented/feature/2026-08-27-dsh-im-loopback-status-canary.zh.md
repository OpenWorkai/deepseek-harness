# Agent Note: dsh-im 规范 loopback 状态证明

Status: implemented

[English](2026-08-27-dsh-im-loopback-status-canary.md) | 中文

## 问题

OpenWork 需要证明未来的 dsh-im adapter 可以抵达真实 DSH Host，同时不削弱已签署的仅本机、只读边界。仅有软件包级 mock 无法证明 Connection RPC 线协议、Host authority 强制执行，也无法为单个非生产 Telegram 机器人给出安全的就绪条件。

## 决策

新增一个可运行示例，仅通过真实 DSH Connection RPC 信封调用 `/telegram/connection.status`。transport 只接受规范的 `http://127.0.0.1:<port>` origin，拒绝重定向，校验响应 `rpcId`，拒绝格式错误的信封，并且不重试。独立断言采用失败关闭：只有状态报告恰好一个已配置且已连接的机器人、遮蔽身份、`private-allowlist` 访问方式以及至少一个纯数字允许用户时才通过。返回摘要排除凭证和未遮蔽身份数据。

示例固定 `@xmanrui/dsh-im@3.0.7`，对应上游提交 `f4ded46278441641524642f02bb75297f0f5966b`，并记录隔离 `DSH_HOME` 的方式。凭证配置仍是通过 dsh-im 完成的显式 owner 操作，且必须使用专用非生产机器人。探针从不接收或读取 token。

## 已考虑的替代方案

**直接调用 dsh-im controller 代码。** 这会绕过 DSH Host，无法证明 Connection RPC carrier 或 loopback authority。

**接受所有 loopback 写法和 HTTPS。** 多种目标表示会增加评审复杂度，也可能与代理和 URL 处理产生不同交互。单一规范 origin 能让设施合同保持狭窄。

**在同一改动中测试消息收发。** 消息流量会引入外部副作用、凭证处理、更新去重和切换语义。这些内容应在状态就绪后，通过另行批准的非生产金丝雀完成。

## 验证

十三项聚焦测试覆盖精确请求信封、取消、规范目标校验、HTTP 和 JSON 失败、响应关联、安全摘要投影，以及零机器人、多个机器人、断开机器人或兼容模式机器人失败。隔离的真实 DSH Web Host 搭载 `@xmanrui/dsh-im@3.0.7` 后返回预期的断开且零机器人状态；伪造非 loopback `Host` 头被 HTTP 403 拒绝；由于没有配置凭证，单机器人断言按设计失败关闭。

## 后果

仓库现在具备可复现的 transport 和就绪证明，但不会激活 IM 替换。真实 Telegram 金丝雀仍需要 owner 配置一个专用非生产机器人。通过此状态门不授权消息流量、生产使用、远程访问、多机器人路由或替换现有桥。
