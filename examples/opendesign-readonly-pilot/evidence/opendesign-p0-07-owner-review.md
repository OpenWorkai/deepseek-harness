# P0-07 隐私与上下文白名单审批单

> 状态：**待 owner 签署**。这是把 P0-07 从开放问题压缩为批准 / 驳回的一页式输入，不代表已获批准。

## 适用范围

只适用于 `opendesign_list_design_systems` 与 `opendesign_get_design_system` 的本机单用户、loopback 只读试点。写工具、远程访问、多租户和资源级共享均不在范围内。

## 建议批准的模型字段

| 路径 | 允许字段 | 禁止字段 |
|---|---|---|
| list | `id`、`title`、`summary`、`category`、`swatches`、`surface`、`source`、`status`、`isEditable`、`createdAt`、`updatedAt` | `body`、`provenance`、`projectId` 及所有未知字段 |
| get | list 白名单 + `body` | `provenance`、`projectId` 及所有未知字段 |

适配器采用“显式复制已知字段”而不是删除黑名单字段；上游新增字段不会自动进入模型上下文。

## 建议批准的日志规则

允许记录：工具名、请求时间、耗时、结果类别、HTTP 状态、错误代码、固定版本、重试次数，以及经过不可逆摘要处理的资源 id。

禁止记录：`body`、`summary`、完整 `id`、`provenance`、`projectId`、本地绝对路径、Authorization / token / cookie、原始响应、提示词和 MCP `content` / `structuredContent` 正文。

错误消息只使用固定分类和通用描述；不得拼接上游响应正文。诊断需要正文时必须另走短期、访问受控且有到期时间的支持流程。

## 浏览器与本地持久化

- OpenDesign 的 `OD_DATA_DIR` 是唯一事实源；不得创建可独立恢复业务事实的副本。
- 当前 `client/` 仍是未接入生产构建的脚手架。接入前必须由 owner 在以下两项中选择其一：
  1. **建议**：回放缓存仅保存 list 摘要，不持久化 get 的 `body`；正文只在当前会话内存中使用。
  2. 明确批准加密的本地正文缓存，并补充保留时间、清理触发、访问边界和用户清除入口。
- 缓存必须可丢弃；清除缓存不得影响 `OD_DATA_DIR`。

## Owner 决议

- [ ] 批准上述模型字段白名单
- [ ] 批准上述日志允许 / 禁止规则
- [ ] 选择浏览器持久化方案 1
- [ ] 选择浏览器持久化方案 2，并附保留 / 清理规则
- [ ] 确认只读试点仅限本机单用户 + loopback

| 角色 | 姓名 / 账号 | 决议 | 日期 |
|---|---|---|---|
| 数据 owner |  |  |  |
| 隐私 / 安全 owner |  |  |  |
| OpenWork / OpenDesign owner |  |  |  |
