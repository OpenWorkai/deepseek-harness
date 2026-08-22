# 即我 → DSH Phase 0：迁移证据与试点放行清单

> 当前结论：**HOLD——DSH 侧验证方法已具备，真实即我证据尚不足，不放行 Phase 1。**
>
> Phase 0 的产物是一次 `GO / HOLD / NO-GO` 试点决策，不是全面迁移批准，也不是全面迁移工期估算。
>
> 证据截止：2026-08-22。真实即我 DSH 插件源码已定位并固定到 `arkme-senx/arkme-dsh-plugin @ 8d62319c5d58236a1542ea09d0bbba53ae2f023f`；迁移后桌面包 `Arkme 0.1.1` 已完成来源、哈希、Apple Developer ID 与公证静态校验（均为 **A 级证据**，见 §4 P0-01 证据明细）。迁移前两年旧客户端完整源码或旧版安装包仍未取得，因此旧路径性能基线继续阻塞。
>
> 关联材料：[迁移论证](../../MIGRATION_JIWO.md) · [试点说明](README.md) · [基线采集器](server/baseline-harness.mjs) · [契约测试](server/tests/jiwo.contract.test.mjs) · [桩后端](server/jiwo-stub-server.mjs) · [DSH overlay](jiwo-pilot.cordis.yml)

## 1. Phase 0 要回答的问题

Phase 0 只回答一个问题：是否有足够证据，让“检索一条记录 + 用户明确要求后创建一条文本快记 + UI 展示结果”进入保留即我事实源的可回滚试点。

Phase 0 不实施真实业务写入，不迁移账户，不迁移主数据库，不停用旧客户端，不把 DSH 的本地存储、schedule 或 goal 当成即我业务域替代品，也不批准全面迁移。

### 当前判断

| 判断 | 状态 | 依据 |
|---|---|---|
| DSH 能通过 MCP 暴露两个试点工具 | 已验证（DSH/stub） | 桩后端、overlay 和契约测试可运行。 |
| 试点工具的基础字段形状可表达 | 已验证（stub） | 服务端桩已重对齐为 `jiwo_read_note` 与 `arkme_record_create`；8/8 契约测试通过。 |
| 真实即我能满足同一契约 | 部分可核（A） | 源码已固定 @8d62319；`records/search`、`record/create` 等真实工具与后端 `/api/v1/records/*` 契约可见；字段级与资源级授权待即我 owner 确认。 |
| 真实即我权限边界可安全映射 | 部分可核（A） | 会话/授权/失效模型可见（微信/手机号登录、keychain 会话、`invalidateScope`）；资源级读写授权与租户模型待即我 owner 确认。 |
| 真实旧链路的性能与可靠性基线已知 | 未验证 | 当前只有本机桩的采集器自检数据。 |
| 写入能业务回滚 | 未验证 | 关闭 overlay 只能停止新调用，不能撤销已创建的快记。 |
| Phase 1 数值阈值已冻结 | 未完成 | 硬性安全阈值可先固定，性能与恢复阈值仍缺真实基线。 |

## 2. 证据分级

任何结论必须标明证据等级，禁止用低等级证据替代真实即我证据。

| 等级 | 含义 | 可支持的结论 |
|---|---|---|
| A：真实即我证据 | 来自已固定版本的即我源码、真实接口、脱敏数据、旧客户端或等价预生产环境 | 可用于 Phase 1 放行与阈值制定。 |
| B：DSH 集成证据 | 来自固定 DSH 版本上的插件、MCP、UI、重启、故障与升级验证 | 可证明 DSH 接入能力，不能证明即我业务等价。 |
| C：桩证据 | 来自当前 JSONL 桩、合成数据和本机基准 | 只能验证契约与采集方法，不能作为真实成功率、延迟、容量、权限或持久性基线。 |
| D：假设 | 尚无可复核材料的判断 | 只能登记为待验证项，不能进入迁移收益或工期结论。 |

当前已具备 B/C 级证据，缺少决定 Phase 1 的 A 级证据。

## 3. Phase 0 出口合同

### GO：放行受控 Phase 1 试点

只有以下条件全部满足才能判定 GO：

- [ ] 即我源码或等价可运行服务已定位，并固定版本、启动方式和责任人。
- [ ] 候选切片的真实入口、依赖、数据流和旧客户端行为已画清。
- [ ] 记录检索与文本快记创建的字段、约束、排序、并发和错误语义已由即我 owner 确认。
- [ ] 主体、租户、资源级授权、会话失效和审计责任已明确。
- [ ] 旧即我直连路径的成功率、延迟、并发、资源和恢复基线已按统一方法采集。
- [ ] Phase 1 的全部验收阈值已在实现前写成数值并冻结。
- [ ] 写入确认使用宿主可信批准凭证，而不是模型可自行填写的布尔值。
- [ ] 业务回滚能撤销试点写入或把写入限制在可丢弃测试记录；关闭 overlay 只作为流量回退。
- [ ] 黄金数据、故障用例、审计字段、脱敏方案和日志禁入字段已确定。
- [ ] Phase 1 owner、即我 owner、安全 owner 和回滚执行人已实名确认。

GO 只批准一个受控切片，旧即我后端继续作为唯一事实源，旧客户端继续可用。

### HOLD：证据不足，继续 Phase 0

存在可补齐的缺口，但尚不能安全进入真实写入试点时判定 HOLD。当前状态属于 HOLD。

### NO-GO：停止当前切片或重新设计边界

出现以下任一情况应判定 NO-GO：

- 即我事实源无法提供资源级授权、幂等约束或可审计写入。
- 写入结果在超时后无法判定，且没有幂等键、查询确认或补偿操作。
- 候选切片必须先迁移账户、主数据库或不可逆 schema 才能运行。
- 敏感数据必须无筛选地进入模型上下文、日志或浏览器持久状态。
- DSH 接入必须依赖 experimental/private 能力作为生产关键路径。
- 旧路径无法与试点并存，或失败后不能在预定恢复时间内切回。

## 4. 证据工作流与交付物

| ID | 工作流 | 必须取得的 A 级证据 | 完成判据 | Owner | 状态 |
|---|---|---|---|---|---|
| P0-01 | 可运行版本 / 源码定位 | **迁移后**即我 DSH 插件源码：仓库 `arkme-senx/arkme-dsh-plugin`、commit `8d62319c5d58236a1542ea09d0bbba53ae2f023f`、npm `@senguoyun/dsh-arkme@0.1.13`；发布包 `Arkme 0.1.1` 已从受信 `d.jiwo.cc` 来源下载并完成哈希、Developer ID、公证和架构静态校验。**迁移前**两年旧客户端完整源码及旧版安装包：未发现公开来源，仍需仓库权限或 owner 提供的旧版安装包。 | 迁移后源码与发布包可复核；迁移前版本仍需定位 | 待指定：即我代码 owner | 部分完成（迁移后源码/发布包已定位；迁移前版本仍阻塞） |
| P0-02 | 功能与入口 | 候选功能入口、调用链、外部服务、旧客户端路径 | 读与写从入口到事实源均可追踪 | 待指定：即我代码 owner | 阻塞 |
| P0-03 | 数据 | 实体、字段、关系、索引、唯一约束、体量、增长、敏感等级、保留和删除规则 | 试点涉及的每个字段均有来源与约束 | 待指定：数据 owner | 阻塞 |
| P0-04 | 身份与权限 | 主体、租户、资源所有权、会话、刷新、注销、吊销、第三方绑定、授权检查点 | 每个工具调用能回答“谁对什么执行什么” | 待指定：身份/安全 owner | 阻塞 |
| P0-05 | 旧链路基线 | 固定数据集和负载下的正确性、成功率、错误、延迟、容量、CPU、内存与恢复数据 | 原始结果、命令、环境和时间戳可复现 | 待指定：运维 owner | 阻塞 |
| P0-06 | 写入安全 | 唯一约束、幂等键、超时判定、审计、补偿操作或可丢弃测试数据策略 | 重复、并发、超时和回滚均有确定结果 | 待指定：业务 owner | 阻塞 |
| P0-07 | 隐私与模型上下文 | 可发送字段白名单、遮蔽规则、token 上限、日志规则、审计与撤回策略 | 未列入白名单的字段不会进入模型或浏览器持久态 | 待指定：隐私/安全 owner | 阻塞 |
| P0-08 | DSH 可接入性 | 固定版本上的 MCP 启动失败、工具发现、事件重放、重启和版本升级结果 | 失败可见，UI 可重建，升级回归可执行 | DSH 迁移 owner | 部分完成 |

### P0-01 证据明细（arkme-dsh-plugin @ 8d62319）

> 证据等级 **A**：来自固定提交 `8d62319c5d58236a1542ea09d0bbba53ae2f023f` 的真实即我 DSH 插件源码（公开仓库，非候选人 Demo）。克隆校验：`git clone` 后 `git checkout 8d62319…`，HEAD 一致；534 个跟踪文件；TypeScript。
> 完整源码静态检视见 [`evidence/arkme-dsh-plugin@8d62319-inventory.md`](evidence/arkme-dsh-plugin@8d62319-inventory.md)；迁移后桌面发布包的只读验真见 [`evidence/arkme-desktop-0.1.1-provenance.md`](evidence/arkme-desktop-0.1.1-provenance.md)。

- **身份与归属**：npm `@senguoyun/dsh-arkme@0.1.13`，组织 `arkme-senx`（关联 arkme.ai / team@arkme.ai）；README 自述为“Arkme 的 DeepSeek Harness 集成插件”。`cordis.patch.yml` 经 DSH 公开扩展点注入（`@deepseek-ai/dsh-*` rc.5 peer 依赖），**证明即我确实基于 DSH 重构**——与 MIGRATION_JIWO.md 的 strangler-fig 方向一致。
- **排除项（不可作为真实生产源码）**：`ArkmeDemo` / `jiwo-frontend`（候选人笔试提交）、`brittanyyitian/jiwo-quicknote`（早期快记原型）。
- **后端事实源（旧路径基线对象）**：`cordis.patch.yml` 暴露一组 `*.jotmo.cc` / `*.jiwo.cc` 微服务——`record.jotmo.cc`（记录/笔记）、`api.jotmo.cc`（认证/更新）、`chat` / `im` / `bot` / `world` / `relation` / `intelligent` / `audio` / `webrtc` / `extension-publish`。旧客户端（迁移前）大概率直连同一组 API，故 `src/services/*` 即是旧路径后端契约的可检视来源（支撑 P0-03/P0-04/P0-05 的 API 形状；**不**替代旧客户端运行时性能基线）。
- **候选切片真实工具面**：`src/tools/business/records/` 提供 `arkme_records_search`（读，query/cursor/limit/before_millis/sync_all）、`arkme_record_recent`、`arkme_record_images`、`arkme_record_create`（写，text，`grant:'explicit-user-write'`）。真实“记录”是文本快记（title/text_content/version/template_kind），未见对外暴露的“标签写入”工具；服务端桩与采集器已改用 `arkme_record_create`。未接入宿主构建的 `client/` 草案仍使用 `jiwo/tag_write` 事件，必须在启用前另行对齐。
- **迁移后发布包验真**：固定提交的生产配置明确 `updateArtifactBaseUrl: https://d.jiwo.cc`；公开发布公告同时给出该 DMG 与插件仓库。下载对象 `Arkme-cn-universal.dmg` 为 386,033,785 bytes，SHA-256 `c153bd0e9a2671b90b3acfb7fc76ff17192d7d5d023e70e3c8f8218d8b7b7fe4`；DMG 校验有效，应用签名主体 `Developer ID Application: Senqisi (Wuhan) Technology Co., Ltd. (T6NSNA8LDZ)`，Gatekeeper 接受且公证票据有效，bundle id `com.senx.arkme.harness`，版本 `0.1.1`，`x86_64/arm64`。这只证明**迁移后新路径发布物**，不能替代 P0-05 的迁移前旧路径基线。
- **可信用户批准（印证 §5 关键纠正）**：`src/tools/shared/conversational-confirmation.ts` 实现**对话式确认**——要求同一 agent 在工具返回 `confirmation_required` 后的**后续直接人类消息**明确批准；对参数做 sha256 指纹，改参需重新确认；TTL 10 分钟。它**不接受模型自行填写的布尔值**，直接印证“`confirmed:true` 不能代表可信用户授权”。
- **并发与超时（P0-05/06 种子）**：`src/request-coordinator.ts` 按 lane（auth/interactive-read/background-read/write/image）做准入控制，默认写 lane `maxConcurrent:4 / ratePerSecond:5 / burst:8 / maxQueued:128`；`requestTimeoutMs:30000`（cordis.patch.yml）；队列溢出抛 `ArkmeRequestQueueOverflowError`（背压信号）。这些是客户端默认值，**不是**后端真实容量，仅供阈值讨论起点。
- **认证与会话（P0-04 种子）**：`src/services/auth-service.ts` 支持微信扫码、手机号+Geetest 验证码、测试环境登录；会话（access/refresh token + userId）存 keychain；`logout()` 调 `invalidateScope` 清除缓存/在途请求并强制陈旧错误（会话失效语义）。
- **关键安全旋钮**：`allowNonLoopback:false`（仅环回）、`extensionTrustedSigningKeys`（ed25519 扩展验签）、`geetestCaptchaId`、`maxTextLength:20000`、`maxUploadBytes:104857600`。

不得把 owner 写成笼统的"用户"。Phase 0 收尾前必须填写能决定对应边界并执行回滚的具体责任人。

## 5. 候选切片及契约缺口

候选切片改为“读记录 + 用户明确要求后创建文本快记 + UI 结果节点”，因为它对齐真实公开工具面，同时覆盖只读、受控写入、事实源持久化和界面重放，又不要求先迁移账户或主数据库。

### `jiwo_read_note`

| 维度 | Phase 1 目标契约 | 当前证据 |
|---|---|---|
| 输入 | `noteId`，以及由可信会话注入的 actor/tenant 上下文 | stub 只有 `noteId`。 |
| 输出 | 最小必要字段；字段白名单由隐私评审确认 | stub 返回 `id/title/body/tags/updatedAt`。 |
| 授权 | 即我事实源按 actor、tenant、note 做资源级读取检查 | 未实现、未验证。 |
| 错误 | 至少区分未认证、无权限、不存在、限流、超时、上游不可用和 schema 不兼容 | stub 只覆盖不存在及通用工具错误。 |
| 审计 | 记录 request、actor、tenant、resource、decision、latency、result class，禁止记录正文和凭证 | 未实现。 |

### `arkme_record_create`

| 维度 | Phase 1 目标契约 | 当前证据 |
|---|---|---|
| 输入 | `text`，以及由宿主/工具运行时绑定当前人类请求、actor、action、expiry 的批准上下文；幂等身份不暴露为业务文本 | stub 为 `text/confirmed`；真实公开 schema 只有 `text`，授权由 `grant:'explicit-user-write'` 与会话确认机制承担。 |
| 确认 | 模型不能自行构造有效批准；批准过期、换主体或换参数后必须失效 | `confirmed: true` 只是结构占位，不是安全控制。 |
| 授权 | 即我事实源再次执行资源级写权限检查，不能信任 DSH 侧单独判断 | 未实现、未验证。 |
| 幂等 | 同一逻辑操作在重复、并发和重试下最多产生一次业务变化 | stub 只按同会话相同文本做顺序去重；真实实现是 callId 派生 recordUid，两者都尚未覆盖并发与超时不确定性。 |
| 超时 | 通过幂等键或查询接口确定已提交/未提交，禁止返回不明状态后盲重试 | 未实现、未验证。 |
| 回滚 | 提供删除试点快记的补偿操作；若做不到，只能使用隔离且可丢弃的测试账号/记录 | 当前没有补偿工具。 |
| 审计 | 记录批准者、执行者、幂等键、before/after 摘要和补偿结果 | 未实现。 |

关闭 [DSH overlay](jiwo-pilot.cordis.yml) 只会阻止后续 DSH 调用并把流量切回旧路径；它不会撤销已经写入即我事实源的数据，因此不能单独计为“写入回滚通过”。

## 6. 基线采集协议

### 必须比较的两条路径

1. **旧路径基线**：旧即我客户端或服务直接调用真实即我事实源，不经过 DSH/MCP。
2. **试点路径结果**：Phase 1 实现完成后，用同一数据集和负载经 DSH/MCP 调用真实即我事实源。

只有第一条路径属于 Phase 0 的生产保真基线。当前 [基线采集器](server/baseline-harness.mjs) 直接测量 MCP 工具契约，适合作为采集器自检和后续试点路径测量，但不能代替旧路径基线；若即我当前不是 MCP 服务，应先用其原生 API/客户端建立旧路径采集器，再在 Phase 1 比较适配层增量。

### 固定采集条件

- 固定即我版本、数据快照、机器规格、网络位置、依赖版本和测试时段。
- 读写分别预热，至少进行多轮独立运行并保留每轮原始样本，不只保留汇总值。
- 报告成功率、业务错误分类、p50/p95/p99、最大延迟和超时率。
- 用递增并发做容量曲线，记录饱和点；单次 `concurrency=200` 不是“峰值并发”。
- 同步采集服务端 CPU、RSS/heap、数据库连接、I/O 和下游限流；`opsPerSec` 与 `elapsedMs` 不是资源占用。
- 分别测量冷启动、进程重启、依赖重启、认证过期和网络恢复到首次成功请求的时间。
- 写入负载只使用隔离测试租户或可补偿数据，并在结束后做逐项对账。

### 当前桩数据的正确定位

当前本机桩曾得到 100% 合成成功率、亚毫秒级计时结果和单进程并发结果。这些数据只说明采集脚本能运行；0–1 ms 结果受本地进程、合成数据和毫秒取整影响，既不能作为真实阈值，也不能证明生产性能。

机器可读基线应保存到受控构件或证据目录并记录来源，不应只引用 `/tmp` 文件，因为临时文件不可审计、不可共享，也不能作为长期决策证据。

## 7. Phase 1 阈值冻结表

安全与一致性的硬阈值可以先冻结；依赖真实旧链路的阈值必须在 P0-05 完成后填写具体数字。任何 `PENDING` 都会阻止 GO。

| 类别 | Phase 1 阈值 | 状态 |
|---|---|---|
| 黄金用例字段与权限决定一致率 | 100%；书面批准的产品差异单独列出，不计作意外差异 | 已冻结 |
| 未授权读取或写入 | 0 次 | 已冻结 |
| 敏感字段进入日志、提示词或浏览器持久态 | 0 个未授权字段 | 已冻结 |
| 重复或并发请求导致的重复业务变化 | 0 次 | 已冻结 |
| 超时后无法判定写入结果 | 0 次 | 已冻结 |
| 故障类型可观测率 | 已列故障类别 100% 返回可归类结果；不得静默空工具集 | 已冻结 |
| 补偿后数据对账一致率 | 100%，试点残留写入 0 条 | 已冻结 |
| 旧路径读成功率 | `PENDING：____%` | 阻塞 |
| 试点路径读成功率下限 | `PENDING：____%` | 阻塞 |
| 旧路径/试点路径写成功率 | `PENDING：____% / ____%` | 阻塞 |
| 读 p95 / p99 上限 | `PENDING：____ ms / ____ ms` | 阻塞 |
| 写 p95 / p99 上限 | `PENDING：____ ms / ____ ms` | 阻塞 |
| 容量下限与错误率 | `PENDING：____ 并发或 ____ ops/s，错误率 ≤ ____%` | 阻塞 |
| CPU / 内存增量上限 | `PENDING：CPU +____%，RSS +____ MiB` | 阻塞 |
| 故障恢复时间上限 | `PENDING：进程 ____ s；依赖 ____ s；认证 ____ s` | 阻塞 |
| 流量切回旧路径时间 | `PENDING：≤ ____ min` | 阻塞 |
| DSH 固定版本升级回归 | 1 次演练，契约/UI/持久化回归失败 0 项 | 已冻结，待 Phase 1 执行 |

阈值必须由业务、运维和安全 owner 在看到旧路径基线后、实现真实适配器前签定；不得在试点结果出来后放宽。

## 8. 现有 DSH/stub 资产的可采信范围

| 资产 | 已证明 | 尚未证明 |
|---|---|---|
| [桩后端](server/jiwo-stub-server.mjs) | JSON-RPC/MCP 形状、合成读写、顺序幂等和文件持久化可演示 | 真实即我 API、权限、事务、并发、容量、审计和补偿。 |
| [契约测试](server/tests/jiwo.contract.test.mjs) | 8 个 stub 契约测试覆盖 `jiwo_read_note` / `arkme_record_create` 工具清单、黄金读、基础错误、布尔确认、顺序去重、JSONL 写穿和 overlay 文本配置 | 真正的 overlay 禁用演练、callId 幂等、并发、超时不确定性、资源级授权和业务写回滚。 |
| [基线采集器](server/baseline-harness.mjs) | 单进程 MCP 请求、基础延迟、合成错误、固定并发和进程重启采集方法可运行 | 旧即我直连基线、峰值容量、CPU/内存、生产网络、多客户端和真实依赖恢复。 |
| [client 脚手架](client/) | Host/client 双包方向已有草案 | 尚未进入宿主构建，类型、UI 重放、权限展示和升级兼容均未验证。 |

因此，“stub 契约测试通过”不能改写为“Phase 0 通过”，也不能作为真实业务试点的安全批准。

## 9. 最短收尾顺序

1. 由即我 owner 提供迁移前旧客户端源码仓库或可验真的旧版安装包，并成功运行候选旧链路。
2. 由即我代码、数据、身份和安全 owner 填完 P0-01 至 P0-07。
3. 先采旧路径基线，再冻结第 7 节所有 `PENDING` 数值。
4. 把写契约从可伪造的 `confirmed` 布尔值升级为可信批准凭证，并补齐 actor/tenant、幂等键、审计和补偿语义。
5. 评审黄金数据、故障矩阵、日志禁入字段和回滚演练步骤。
6. 记录 GO、HOLD 或 NO-GO；只有 GO 才进入真实 Phase 1 适配实现。

## 10. 决策记录

| 字段 | 值 |
|---|---|
| 决策 | HOLD |
| 日期 | 2026-08-22 |
| 放行范围 | 无；继续 Phase 0 证据收集 |
| 已接受证据 | DSH/stub 的工具契约、采集方法、脚手架方向；**A 级** arkme-dsh-plugin @8d62319 源码与后端契约静态检视；**A 级** Arkme 0.1.1 迁移后桌面发布包来源、SHA-256、Developer ID 与 Apple 公证静态验真 |
| 主要阻塞 | 迁移后源码与发布包已定位；**迁移前**旧客户端完整源码或旧版安装包仍缺，故旧路径性能基线不能由当前 Arkme 0.1.1 代替；P0-02（旧客户端路径）至 P0-07 的字段/权限/审计/隐私 owner 确认仍缺；未接入构建的 `client/` 事件仍待从 `jiwo/tag_write` 对齐；第 7 节性能与恢复阈值仍 PENDING。 |
| 下一次评审触发 | 即我可运行版本、数据/权限材料和旧路径基线到位 |
| 全面迁移决定 | 未批准，且不在本文件决策范围内 |
