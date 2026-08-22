# OpenWork → DSH Phase 0：迁移证据与试点放行清单

> 当前结论：**HOLD——只读 GO 路径已清晰，但真实只读基线与 DSH 端到端验证尚未完成，不放行。**
>
> 证据对象已重对齐：从"即我 / Jiwo / Arkme records"改为 **OpenWork → OpenDesign design-systems**。OpenWork 是当前真实旧客户端，OpenDesign 是其本地设计系统引擎（HTTP API + `OD_DATA_DIR` 文件系统事实源）。即我 / Jiwo / Arkme 作为 DSH 迁移方向的**旁证**保留于 §4 参考，但不再作为本试点 GO 的证据对象。
>
> 候选切片改为**只读**两个工具：`opendesign_list_design_systems` / `opendesign_get_design_system`；写入（`opendesign_create_design_system`）另设第二道门，不在本次 GO 范围。
>
> 固定版本：OpenWork `2aef14e2`、OpenDesign `0c7955de`（v0.11.1）、DeepSeek Harness `4e6e0a1`。
>
> 证据截止：2026-08-22。

## 1. Phase 0 要回答的问题

Phase 0 只回答一个问题：是否有足够证据，让"列出设计系统 + 按 id 读取一个设计系统"进入**保留 OpenDesign 为唯一事实源、且可回退到 OpenWork 原生 IPC 路径**的只读试点。

Phase 0 不实施真实写入，不迁移账户，不复制数据库，不停用旧客户端，不把 DSH 的本地存储、schedule 或 goal 当成 OpenDesign 业务域替代品，也不批准全面迁移。

### 当前判断

| 判断 | 状态 | 依据 |
|---|---|---|
| OpenWork + OpenDesign 源码已定位并固定 | 已验证（A） | OpenWork `2aef14e2`、OpenDesign `0c7955de` 均在工作区；调用链可源码确认 |
| 候选只读工具的真实入口可确认 | 已验证（A） | `OpenDesignDaemonClient.getDesignSystem` → `GET /api/design-systems/:id`；`listDesignSystems` → `GET /api/design-systems` |
| 两条路径读同一事实源 | 已验证（设计） | 旧路径（OpenWork IPC）与试点路径（DSH overlay）都读 `OD_DATA_DIR`（`USER_DESIGN_SYSTEMS_DIR`）文件系统；无数据库复制 |
| 写入可被拒 / 隔离 | 设计可核（只读切片不含写） | `POST /api/design-systems` 存在但不在候选集；只读切片不暴露写工具 |
| 真实旧链路基线已知 | 未验证 | 尚未用真实 OpenWork + OpenDesign 跑基线 |
| DSH 能暴露同契约只读工具并端到端通 | 未验证 | P0-08 需重做：用真实 OpenDesign API 替换 records stub，验证发现 / 失败 / 重启 / 回退 |
| Phase 1 数值阈值已冻结 | 未完成 | 性能与恢复阈值待 P0-05 真实基线 |

## 2. 证据分级

任何结论必须标明证据等级，禁止用低等级证据替代真实 OpenDesign 证据。

| 等级 | 含义 | 可支持的结论 |
|---|---|---|
| A：真实 OpenWork / OpenDesign 证据 | 来自固定版本的 OpenWork / OpenDesign 源码、真实本地 HTTP API、本地 `OD_DATA_DIR` 数据、脱敏数据或等价预生产环境 | 可用于 Phase 1 放行与阈值制定。 |
| B：DSH 集成证据 | 来自固定 DSH 版本上的插件 / MCP / overlay、UI、重启、故障与升级验证 | 可证明 DSH 接入能力，不能证明 OpenDesign 业务等价。 |
| C：桩 / 采集器自检证据 | 来自当前 records 桩、合成数据和本机基准（含 `examples/jiwo-pilot/server` 现有资产） | 只能验证采集方法，不能作为真实成功率、延迟、容量、权限或持久性基线。 |
| D：假设 | 尚无可复核材料的判断 | 只能登记为待验证项，不能进入迁移收益或工期结论。 |

当前已具备 A 级（OpenWork / OpenDesign 源码与调用链）与 C 级（records 桩自检）证据；决定 Phase 1 真实基线的 A 级采集仍待 P0-05。

## 3. 出口合同

### GO（只读）：放行受控只读 Phase 1 试点

只有以下条件全部满足才能判定 GO（只读）：

- [ ] 候选只读切片的字段、错误语义已由 owner 确认（§5）。
- [ ] 旧路径与试点路径读取同一 OpenDesign 数据目录（`OD_DATA_DIR`），标准化结果字段一致率 100%。
- [ ] 未授权读取 / 写入 0 次。
- [ ] 故障可归类率 100%（见 §6 故障类别）。
- [ ] OpenDesign 重启后试点恢复正常；关闭 DSH overlay 后立即回到旧 IPC 路径。
- [ ] 两条路径读取同一事实源，不复制数据库。
- [ ] Phase 1 全部验收阈值已在实现前写成数值并冻结（§7，PENDING 替换为实测数字）。
- [ ] 写入不在 GO 范围；若 Phase 1 必须含写入，另设第二道门（§5 写入门 + P0-06）。

GO 只批准只读切片，OpenDesign 继续作为唯一事实源，OpenWork 原生 IPC 路径继续可用。

### HOLD：证据不足，继续 Phase 0

存在可补齐的缺口，但尚不能安全进入真实只读试点时判定 HOLD。当前状态属于 HOLD。

### NO-GO：停止当前切片或重新设计边界

出现以下任一情况应判定 NO-GO：

- 两条路径读取的不是同一事实源（试点复制了数据库）。
- 关闭 DSH overlay 后无法立即回到旧路径。
- 标准化字段一致率 < 100% 或故障不可归类为可归类结果。
- 敏感数据必须无筛选地进入模型上下文 / 日志 / 浏览器持久态。
- DSH 接入必须依赖 experimental/private 能力作为生产关键路径。

## 4. 证据工作流与交付物

| ID | 工作流 | 新状态 | 达到 GO 还需完成 | Owner |
|---|---|---|---|---|
| P0-01 | 可运行版本 / 源码定位 | 基本完成 | 在 PHASE0 写入 OpenWork / OpenDesign 两个仓库、commit、启动命令和责任人 | 待指定：OpenWork / OpenDesign owner |
| P0-02 | 功能与入口 | 可直接完成 | 固化上述真实调用链和两个候选 API（list / get） | 待指定：OpenWork / OpenDesign owner |
| P0-03 | 数据 | 部分可完成 | 固化字段、目录结构、删除 / 保留规则和黄金测试数据 | 待指定：数据 owner |
| P0-04 | 身份与权限 | 有条件完成 | 明确仅限本机单用户、loopback；不得宣称支持租户 / 资源级授权 | 待指定：身份 / 安全 owner |
| P0-05 | 旧链路基线 | 可立即采集 | 用真实 OpenWork + OpenDesign 跑成功率、延迟、并发、资源、重启 | 待指定：运维 owner |
| P0-06 | 写入安全 | 只读切片不阻塞 | 明确写工具不存在（只读切片）且调用被拒绝；写入另行放行 | 待指定：业务 owner |
| P0-07 | 隐私与模型上下文 | 仍需补齐 | 冻结模型字段白名单、日志禁入字段、遮蔽规则 | 待指定：隐私 / 安全 owner |
| P0-08 | DSH 可接入性 | 需重做部分证据 | 用真实 OpenDesign API 替换 records stub，验证发现、失败、重启、回退 | DSH 迁移 owner |

### P0-01 证据明细（OpenWork + OpenDesign 固定版本）

- **OpenWork `2aef14e2`**（`fix(unify): align unified main to buildable state`）——真实旧客户端（Electron / React）。
- **OpenDesign `0c7955de`（v0.11.1）**——本地设计系统引擎（daemon + HTTP API）。生产制品 / 启动命令待填入 §9 待办。
- **DeepSeek Harness `4e6e0a1`**（`fix(jiwo-pilot): align the pilot with Arkme record writes`）——DSH 底座；其自带 `examples/jiwo-pilot` 为 records 版，本试点不改 DSH 底座，只用其 overlay / plugin 机制注入 OpenDesign MCP。
- **旧"缺即我源码"硬阻塞解除**：真实旧路径即 OpenWork → OpenDesign，两者源码均在工作区（`/Users/myking/workspaces/claude-projects/openwork`、`/Users/myking/workspaces/claude-projects/open-design`），无需再猎取外部安装包或旧版 DMG。

### 真实调用链（源码可确认）

```
OpenWork 页面
  → Renderer Client
  → IPC Bridge                opendesignDaemonBridge.ts:45
                               (ipcBridge.opendesign.getDesignSystem / listDesignSystems)
  → OpenDesignDaemonClient    OpenDesignDaemonClient.ts:109
                               (getDesignSystem → GET /api/design-systems/:id
                                listDesignSystems → GET /api/design-systems)
  → OpenDesign 本地 HTTP API
       GET    /api/design-systems          static-resource.ts:389   (list)
       GET    /api/design-systems/:id      design-systems.ts:208    (get)
       POST   /api/design-systems          design-systems.ts:102    (create — 写，不在候选集)
       DELETE /api/design-systems/:id      static-resource.ts:825
       POST   /api/tools/design-systems/read  design-system-tool.ts:42
                                            (工具式读，authorizeToolRequest('design-systems:read'))
  → OD_DATA_DIR / USER_DESIGN_SYSTEMS_DIR  (文件系统事实源；id = 目录 slug)
```

- **数据模型**：`design-systems/index.ts:240` `UserDesignSystemInput` = `{ title?, summary?, category?, surface?, status?, artifactMode?, body?, sourceNotes?, provenance? }`。
- **列表响应剔除 `body`**（`static-resource.ts:393`：`systems.map(({ body, ...rest }) => rest)`）；单读含 `body`。这是基线"字段一致率 100%"必须统一规范化的关键点：列表与单读在 `body` 上天然差异，两条路径必须一致地规范化。
- **权限模型**：`design-system-tool.ts:44` 的 `authorizeToolRequest(req, res, 'design-systems:read')` 是 token / project 绑定的**本地**授权（scope `design-systems:read`），**不是**多租户 / 资源级授权。只读试点仅限本机单用户 + loopback。

### 即我 / Jiwo / Arkme（参考旁证，非本试点 GO 证据对象）

arkme-senx/arkme-dsh-plugin @8d62319 与 Arkme 0.1.1 桌面发布包静态验真见 `evidence/arkme-dsh-plugin@8d62319-inventory.md` 与 `evidence/arkme-desktop-0.1.1-provenance.md`。它们证明"即我已基于 DSH 重构"（strangler-fig 方向成立），但即我 records 不是本试点的旧路径；本试点旧路径是 OpenWork → OpenDesign。

## 5. 候选切片及契约缺口

候选切片改为"列出设计系统 + 按 id 读取一个设计系统"，因为它对齐真实 OpenDesign 公开 API，覆盖只读与界面重放，又不要求先迁移账户或主数据库，也不会触碰写入门。

### `opendesign_list_design_systems`（只读）

| 维度 | Phase 1 目标契约 | 当前证据 |
|---|---|---|
| 输入 | 无（或可选过滤）；由本机单用户会话隐含 | OpenWork IPC `listDesignSystems` → `GET /api/design-systems`（`static-resource.ts:389`） |
| 输出 | 设计系统摘要数组，**不含 `body`**（与列表响应一致）；字段白名单由隐私评审确认 | `listAllDesignSystems()` 返回摘要；列表路由显式剔除 `body` |
| 授权 | 本机 loopback 单用户；不宣称租户 / 资源级 | OpenDesign 为本地 daemon，无网络暴露；`design-system-tool` 的 `authorizeToolRequest` 仅为本地 token scope |
| 错误 | 至少区分上游不可用 / 限流 / 超时 / schema 不兼容 | 路由仅 `try/catch → 500`；需补充错误分类 |
| 审计 | 记录 request、actor、latency、result class，禁止记录正文 | 未实现 |

### `opendesign_get_design_system`（只读）

| 维度 | Phase 1 目标契约 | 当前证据 |
|---|---|---|
| 输入 | `id`，由本机单用户会话隐含 | OpenWork IPC `getDesignSystem(id)` → `GET /api/design-systems/:id`（`design-systems.ts:208`） |
| 输出 | 完整设计系统（含 `body`）；字段白名单由隐私评审确认 | `getDesignSystem` 返回 `{ id, name, description, category, body, packageInfo }` |
| 授权 | 本机 loopback 单用户 | 同列表 |
| 错误 | 区分不存在（404）、上游不可用、限流、超时、schema 不兼容 | 当前缺失项返回 `null`（客户端防御）；需映射为显式错误类别 |
| 审计 | 记录 request、actor、resource、latency、result class | 未实现 |

### 写入门（`opendesign_create_design_system`，第二道门，不在本次 GO）

- 入参对齐 `UserDesignSystemInput`（`title` / `summary` / `category` / `body` / ...）。
- **阻塞项（P0-06）**：OpenDesign `createUserDesignSystem` 自动分配唯一 slug，**不等于请求幂等**；重试可能创建第二个对象。因此写入仍需：宿主签发可信用户批准凭证、requestId / callId 幂等键、重试 / 并发 / 超时不能重复创建、actor / 时间 / 参数摘要 / 结果的审计、测试对象删除或补偿能力、回退旧路径后可见同一条新建数据。
- 当前 `POST /api/design-systems`（`design-systems.ts:102`）与 `ipcBridge.opendesign.createDesignSystem`（`opendesignDaemonBridge.ts:56`）存在，但未经上述安全闸门，故不在只读 GO 范围。

关闭 [DSH overlay](jiwo-pilot.cordis.yml) 只会阻止后续 DSH 调用并把流量切回 OpenWork 原生 IPC 路径；它不会撤销已写入 OpenDesign 事实源的数据，因此不能单独计为"写入回滚通过"。

## 6. 基线采集协议

### 必须比较的两条路径

1. **旧路径**：OpenWork → IPC Bridge → OpenDesignDaemonClient → OpenDesign HTTP API → `OD_DATA_DIR`。
2. **试点路径**：OpenWork → DSH overlay / plugin（包装同一 OpenDesign HTTP API）→ 同一 OpenDesign。

### 固定采集条件

- 相同 `OD_DATA_DIR`、相同黄金用例、相同机器。
- 报告标准化结果字段一致率：**列表剔除 `body`、单读含 `body`，两端必须一致规范化**。
- 故障可归类率 100%：至少覆盖未认证 / 无权限 / 不存在 / 限流 / 超时 / 上游不可用 / schema 不兼容。
- 关闭 DSH overlay 后立即回到旧路径（流量回退，非数据回滚）。
- OpenDesign 重启后试点恢复正常（记录重启恢复时间）。
- 两条路径读取同一事实源，不复制数据库（验证试点路径直接读 `OD_DATA_DIR`，而非镜像）。
- 把 §7 所有 PENDING 替换为实测后冻结的数字。

### 当前桩数据的正确定位

`examples/jiwo-pilot/server` 当前仍是 Jiwo / Arkme **records** 桩（P0-08 待重做）。其自带基线采集器只能验证采集方法，不能作为 OpenDesign 真实基线；契约测试 8/8 通过仅证明 records 契约形状，不能外推到 OpenDesign design-systems 契约或 Phase 0 GO。

机器可读基线应保存到受控证据目录并记录来源，不应只引用 `/tmp` 文件，因为临时文件不可审计、不可共享。

## 7. Phase 1 阈值冻结表

安全与一致性的硬阈值可以先冻结（只读）；依赖真实旧链路的阈值必须在 P0-05 完成后填写具体数字。任何 `PENDING` 都会阻止 GO。

| 类别 | Phase 1 阈值 | 状态 |
|---|---|---|
| 标准化结果字段一致率（列表剔除 body / 单读含 body，两端一致） | 100% | 已冻结 |
| 未授权读取或写入 | 0 次 | 已冻结 |
| 敏感字段进入日志、提示词或浏览器持久态 | 0 个未授权字段 | 已冻结 |
| 故障类型可观测率 | 已列故障类别 100% 返回可归类结果；不得静默空工具集 | 已冻结 |
| 关闭 DSH overlay 后回到旧路径时间 | ≤ 实测 ____ s（流量回退） | 阻塞 |
| 旧路径读成功率 | `PENDING：____%` | 阻塞 |
| 试点路径读成功率下限 | `PENDING：____%` | 阻塞 |
| 读 p95 / p99 上限 | `PENDING：____ ms / ____ ms` | 阻塞 |
| 容量下限与错误率 | `PENDING：____ 并发或 ____ ops/s，错误率 ≤ ____%` | 阻塞 |
| CPU / 内存增量上限 | `PENDING：CPU +____%，RSS +____ MiB` | 阻塞 |
| 故障恢复时间上限 | `PENDING：进程 ____ s；依赖 ____ s` | 阻塞 |
| DSH 固定版本升级回归 | 1 次演练，契约 / UI / 持久化回归失败 0 项 | 已冻结，待 Phase 1 执行 |

阈值必须由业务、运维和安全 owner 在看到旧路径基线后、实现真实适配器前签定；不得在试点结果出来后放宽。

## 8. 现有 DSH / stub 资产可采信范围

| 资产 | 已证明 | 尚未证明 |
|---|---|---|
| [桩后端](server/jiwo-stub-server.mjs) | Jiwo / Arkme records 的 JSON-RPC / MCP 形状、合成读写、顺序幂等和文件持久化可演示 | 与 OpenDesign design-systems 契约不一致（P0-08 待重做）；真实 OpenDesign API、权限、并发、容量、审计 |
| [契约测试](server/tests/jiwo.contract.test.mjs) | 8 个 records 契约测试覆盖工具清单、黄金读、基础错误、确认门、顺序去重、JSONL 写穿和 overlay 文本配置 | 不能外推到 OpenDesign design-systems 契约；真实 overlay 禁用演练、并发、超时不确定性、资源级授权 |
| [基线采集器](server/baseline-harness.mjs) | 单进程 MCP 请求、基础延迟、合成错误、固定并发采集方法可运行 | OpenDesign 直连基线、峰值容量、CPU / 内存、生产网络、多客户端和真实依赖恢复 |
| [client 脚手架](client/) | Host / client 双包方向已有草案 | 仍使用旧 `jiwo/tag_write` 事件草案，未接入宿主构建，类型 / UI 重放 / 权限展示 / 升级兼容均未验证；需重对齐为 design-systems 事件 |

因此，"records 桩契约测试通过"不能改写为"Phase 0 通过"，也不能作为 OpenDesign design-systems 真实业务试点的安全批准。

## 9. 最短收尾顺序

1. 在 PHASE0 写入 OpenWork / OpenDesign 仓库、commit、启动命令、责任人（P0-01）。
2. 固化真实调用链 + 两个候选只读 API（P0-02）。
3. 固化数据模型字段、目录结构、删除 / 保留规则、黄金测试数据（P0-03）。
4. 明确仅本机单用户 + loopback 权限边界，不宣称租户 / 资源级授权（P0-04）。
5. 用真实 OpenWork + OpenDesign 跑只读基线（P0-05）。
6. 用真实 OpenDesign API 替换 records stub，做 DSH 端到端发现 / 失败 / 重启 / 回退（P0-08）。
7. 冻结 §7 全部 PENDING 为实测数字。
8. 补齐隐私字段白名单 / 日志禁入字段 / 遮蔽规则（P0-07）。
9. 评审 → 只读 GO 或 HOLD。

## 10. 决策记录

| 字段 | 值 |
|---|---|
| 决策 | HOLD |
| 日期 | 2026-08-22 |
| 放行范围 | 无；继续 Phase 0 证据收集，目标为范围明确的"只读 GO" |
| 关键变化 | 证据对象从即我 / Jiwo / Arkme records 重对齐为 OpenWork → OpenDesign design-systems（只读）；旧"缺即我源码"硬阻塞解除（真实旧路径源码在工作区） |
| 已接受证据 | A 级：OpenWork `2aef14e2` + OpenDesign `0c7955de` 源码与调用链；DSH `4e6e0a1` 底座；即我 / Arkme DSH 重构旁证（参考） |
| 主要阻塞 | P0-05 真实只读基线未采；P0-08 DSH 端到端未用真实 OpenDesign API 验证；P0-07 隐私白名单未冻结；§7 性能 / 恢复阈值仍 PENDING |
| 下一次评审触发 | 真实只读基线 + DSH 端到端验证完成 |
| 全面迁移 / 写入 | 未批准；写入另设第二道门 |
