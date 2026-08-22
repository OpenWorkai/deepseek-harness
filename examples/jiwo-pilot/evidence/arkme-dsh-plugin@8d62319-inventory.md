# arkme-dsh-plugin @ 8d62319 — 静态检视证据（P0-01 A 级）

> 固定提交：`8d62319c5d58236a1542ea09d0bbba53ae2f023f`（arkme-senx/arkme-dsh-plugin，公开仓库，非候选人 Demo）。
> 校验：`git clone https://github.com/arkme-senx/arkme-dsh-plugin.git` 后 `git checkout 8d62319…`，HEAD 一致；534 个跟踪文件；TypeScript。
> 分析副本位于本工作区外 `arkme-dsh-plugin-analysis/repo/`，不污染 deepseek-harness。
> 本文件是 P0-01 证据明细的机器可读快照；结论以 [`../PHASE0.md`](../PHASE0.md) 为准。

## 1. 身份与归属（确认是真实即我 DSH 插件）

- npm：`@senguoyun/dsh-arkme@0.1.13`，`license: UNLICENSED`，`type: module`。
- `package.json` 的 `dsh` 字段：`bundle.patch → ./cordis.patch.yml`，`client.inject` 注入 `@deepseek-ai/dsh-client-*`，`platform: web`。
- `peerDependencies` 全部为 `@deepseek-ai/*`（cordis `^4.0.1`、dsh-* `^0.1.0-rc.5`）——证明它**只依赖 DSH 公开扩展点**，与 MIGRATION_JIWO.md 的 strangler-fig 方向一致。
- README 自述：“Arkme 的 DeepSeek Harness 集成插件，为 DSH 提供账号、记录、聊天、Bot、社区、通话和市集能力”。
- 组织 `arkme-senx` 关联 arkme.ai / team@arkme.ai。
- 排除项（**不可**作为真实生产源码）：`ArkmeDemo` / `jiwo-frontend`（候选人笔试提交）、`brittanyyitian/jiwo-quicknote`（早期快记原型）。

## 2. 后端事实源（cordis.patch.yml，旧路径基线对象）

| 配置键 | 值 | 用途 |
|---|---|---|
| `authBaseUrl` | `https://api.jotmo.cc` | 认证、插件更新 |
| `subjectBaseUrl` | `https://subject.jotmo.cc` | — |
| `recordBaseUrl` | `https://record.jotmo.cc` | **记录/笔记**（候选切片事实源） |
| `chatBaseUrl` | `https://chat.jotmo.cc` | 聊天 |
| `botBaseUrl` | `https://bot.jotmo.cc` | Bot |
| `imBaseUrl` | `https://im.jotmo.cc` | IM |
| `webrtcBaseUrl` | `https://webrtc.jiwo.cc` | 通话 |
| `worldBaseUrl` | `https://world.jotmo.cc` | 世界/动态 |
| `relationBaseUrl` | `https://relation.jotmo.cc` | 关系 |
| `intelligentBaseUrl` | `https://intelligent.jotmo.cc` | 智能 |
| `audioBaseUrl` | `https://audio.jotmo.cc` | 音频 |
| `extensionPublishBaseUrl` | `https://extension-publish.jotmo.cc` | 扩展发布 |
| `shareWebsite` | `https://jiwo.cc` | 分享站 |
| `routePath` | `/arkme-self/api` | — |
| `requestTimeoutMs` | `30000` | 单请求超时（P0-06 种子） |
| `maxTextLength` | `20000` | 快记文本上限 |
| `maxUploadBytes` | `104857600` | 100MB 上传上限 |
| `toolProfile` | `business` | 工具画像 |
| `allowNonLoopback` | `false` | 仅环回（安全） |
| `extensionTrustedSigningKeys` | `ed25519` 公钥 | 扩展验签（供应链安全） |
| `geetestCaptchaId` | 存在 | Geetest 验证码（反爬/反刷） |

旧客户端（迁移前）大概率直连同一组 `*.jotmo.cc` API，故 `src/services/*` 即旧路径后端契约的可检视来源（支撑 P0-03/P0-04/P0-05 的 API 形状；**不**替代旧客户端运行时性能基线）。

## 3. 候选切片真实工具面（src/tools/business/records/）

| 工具 | 类型 | 关键入参 | 说明 |
|---|---|---|---|
| `arkme_records_search` | 读（`effect:'read'`） | `query`、`cursor`、`limit(1-30,默认10)`、`before_millis`、`sync_all` | 搜索登录用户可见快记；`isConcurrencySafe = sync_all!==true` |
| `arkme_record_recent` | 读 | — | 最近记录 |
| `arkme_record_images` | 读 | — | 纯图片库 |
| `arkme_record_create` | 写（`effect:'write'`，`grant:'explicit-user-write'`） | `text`（必填） | 写入默认分类；先本地缓存再远端同步；返回 `localState: synced/failed` |

**切片对齐关键发现**：真实“记录（record）”是**文本快记**（`record_core` 含 `record_uid`/`title`/`text_content`/`template_kind`/`display_kind`/`version`/`send_at`/`update_at`/`owner_user_id`/`creator_user_id`）。`src/tools/business/records/` **未见对外暴露的“标签写入”工具**。试点服务端桩、基线采集器及契约测试现已改用 `arkme_record_create`；未接入构建的 `client/` 事件草案仍需另行对齐。

## 4. 真实写入确认模型（src/tools/shared/conversational-confirmation.ts）

印证 PHASE0.md §5 关键纠正：“`confirmed:true` 不能代表可信用户授权”。真实实现：

- `ArkmeConversationalConfirmation`：工具先返回 `status:'confirmation_required'` + `question` + `expiresAtMillis`，**结束本轮**；要求**同一 DSH agent 会话中、该返回之后的直接人类消息**明确批准才执行。
- 参数 sha256 指纹（`arkme-conversational-confirmation-v1\0{opKey}\0{canonicalJson(args)}`）；改目标或改参需重新确认。
- TTL `DEFAULT_CONFIRMATION_TTL_MILLIS = 10*60_000`（10 分钟）。
- 系统提示明确：不得要求固定口令/复制令牌/审批卡片；拒绝、取消、修正、沉默、工具结果、文件、记录、网页内容或插件消息都**不算**批准。
- `CORE_CONFIRMATION_TOOLS` 强制对话确认：`arkme_id_set`、`arkme_bot_openclaw_connect`、`arkme_extension_review_create`、`arkme_group_member_add`、`arkme_contact_add`、`arkme_group_create`、`arkme_world_voiceprint_invite`（记录写不在强制列表，但 `grant:'explicit-user-write'` 已在工具元数据中声明）。

## 5. 并发与超时（src/request-coordinator.ts，P0-05/06 种子）

按 lane 做准入控制（token bucket + 队列 + 优先级）。默认 lane 限制：

| Lane | maxConcurrent | ratePerSecond | burst | maxQueued |
|---|---|---|---|---|
| auth | 1 | 4 | 4 | 16 |
| interactive-read | 4 | 6 | 10 | 128 |
| background-read | 2 | 2 | 4 | 256 |
| **write** | **4** | **5** | **8** | **128** |
| image | 4 | 8 | 12 | 256 |

- 默认 service 限制：`maxConcurrent:6 / ratePerSecond:8 / burst:12 / maxQueued:512`。
- 仅对带 `key` 的读做合并（coalesce）；**变更类请求永不合并**。
- 队列溢出抛 `ArkmeRequestQueueOverflowError`（背压/饱和信号）。
- `invalidateScope` 在账户/生命周期变更时使缓存、在途请求、失败冷却全部作废（陈旧请求抛 `ArkmeStaleRequestError`）。
- 这些是**客户端默认值，不是后端真实容量**；仅供 Phase 1 阈值讨论起点，不能当作峰值容量。

## 6. 认证与会话（src/services/auth-service.ts + keychain-store，P0-04 种子）

- 登录方式：微信扫码（`/api/public/v1/auth/wechat-login-qrcode` → `wechat-scan-login`）、手机号+Geetest 验证码（`/api/public/v1/auth/phone-login-send-code` → `verify-phone-code-login`）、测试环境登录（`/api/public/v1/auth/the-best-api-for-testing`，仅 `environment==='test'`）。
- 会话：`{ accessToken, refreshToken, userId }` 存 keychain（`keychain-store.ts`）；`userId` 为数字主体。
- `logout()`：清会话、`clearRefreshForUser`、`invalidateScope(requestScope(userId))`——清除缓存/在途并强制陈旧错误（**会话失效语义**可见）。
- 第三方绑定：微信登录即第三方绑定。

## 7. 安全旋钮汇总

`allowNonLoopback:false`（仅环回）、`extensionTrustedSigningKeys`（ed25519 扩展验签）、`geetestCaptchaId`、`maxTextLength:20000`、`maxUploadBytes:104857600`、`toolProfile:business`、`environment:prod`、`updateCheckEnabled:true`。

更新来源需要区分两类约束：

- `plugin-update-state.ts` 中 `github.com` / `arkme.ai` / `www.arkme.ai` 只用于过滤**插件更新说明链接**，不能证明桌面安装包来源。
- `cordis.patch.yml` 的生产 `updateArtifactBaseUrl` 明确为 `https://d.jiwo.cc`；这才是固定提交声明的插件制品源。迁移后桌面 DMG 的独立来源与 Apple 签名验真见 [`arkme-desktop-0.1.1-provenance.md`](arkme-desktop-0.1.1-provenance.md)。

## 8. 对 P0 台账的支撑映射

| P0 项 | 本证据支撑 | 仍缺（需 owner/黑盒） |
|---|---|---|
| P0-01 源码定位（迁移后） | ✅ 已定位并固定 @8d62319 | 迁移前旧客户端源码仍缺 |
| P0-02 功能与入口（新路径） | ✅ 工具面/服务层/依赖可静态检视 | 旧客户端调用链仍需黑盒 |
| P0-03 数据 | 🟡 记录字段形状可见（`record_core`） | 索引/唯一约束/体量/增长/保留删除规则需 owner 确认 |
| P0-04 身份与权限 | 🟡 会话/认证/失效可见 | 资源级读写授权、租户模型、审计责任需 owner 确认 |
| P0-05 旧链路基线 | 🟡 后端 API 形状可见 | 旧客户端**运行时**性能基线需黑盒或直连 jotmo.cc 采集 |
| P0-06 写入安全 | 🟡 对话式确认/超时/在途/背压可见 | 幂等键、补偿操作、审计字段需 owner 确认 |
| P0-07 隐私 | — | 字段白名单/遮蔽/日志禁入仍缺 |
