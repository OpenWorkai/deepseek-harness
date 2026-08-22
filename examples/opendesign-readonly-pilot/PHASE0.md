# OpenWork → DSH Phase 0：迁移证据与试点放行清单

> 当前结论：**HOLD——P0-05 同源真实对照与 P0-08 DSH 只读端到端均已完成；P0-03/04 owner 边界确认、P0-07 隐私审批与 §7 候选阈值签署尚未完成，不放行。**
>
> 证据对象已重对齐：从"即我 / Jiwo / Arkme records"改为 **OpenWork → OpenDesign design-systems**。OpenWork 是当前真实旧客户端，OpenDesign 是其本地设计系统引擎（HTTP API + `OD_DATA_DIR` 文件系统事实源）。即我 / Jiwo / Arkme 作为 DSH 迁移方向的**旁证**保留于 §4 参考，但不再作为本试点 GO 的证据对象。
>
> 候选切片改为**只读**两个工具：`opendesign_list_design_systems` / `opendesign_get_design_system`；写入（`opendesign_create_design_system`）另设第二道门，不在本次 GO 范围。
>
> 固定版本：OpenWork `9e774879`、OpenDesign `0c7955de`（v0.11.1）、DeepSeek Harness `89b38861`；P0-05 / P0-08 实现位于当前 PR。
>
> 证据截止：2026-08-22。
>
> Owner 统一签署入口：[`evidence/opendesign-readonly-go-decision.md`](evidence/opendesign-readonly-go-decision.md)。签署完成前本文件保持 HOLD。

## 1. Phase 0 要回答的问题

Phase 0 只回答一个问题：是否有足够证据，让"列出设计系统 + 按 id 读取一个设计系统"进入**保留 OpenDesign 为唯一事实源、且可回退到 OpenWork 原生 IPC 路径**的只读试点。

Phase 0 不实施真实写入，不迁移账户，不复制数据库，不停用旧客户端，不把 DSH 的本地存储、schedule 或 goal 当成 OpenDesign 业务域替代品，也不批准全面迁移。

### 当前判断

| 判断 | 状态 | 依据 |
|---|---|---|
| OpenWork + OpenDesign 源码已定位并固定 | 已验证（A） | OpenWork `9e774879`、OpenDesign `0c7955de` 均在工作区；调用链与真实运行可确认 |
| 候选只读工具的真实入口可确认 | 已验证（A） | `OpenDesignDaemonClient.getDesignSystem` → `GET /api/design-systems/:id`；`listDesignSystems` → `GET /api/design-systems` |
| 两条路径读同一事实源 | 已验证（A+B） | 同机顺序实测旧路径与试点路径读取同一个显式 `OD_DATA_DIR`；标准化 list/get 字段差异均为空 |
| 写入可被拒 / 隔离 | 设计可核（只读切片不含写） | `POST /api/design-systems` 存在但不在候选集；只读切片不暴露写工具 |
| 真实旧链路基线已知 | 已验证（A） | P0-05：真实 Electron renderer → IPC 跑 20/20 list、20/20 get、20/20 并发、错误分类、daemon 重启与 DSH 停止后旧路径回退 |
| DSH 能暴露同契约只读工具并端到端通 | 已验证（B） | P0-08：真实 `dsh-mcp-client` 只发现 list/get；真实 OpenDesign 0.11.1 list/get、故障分类、适配器重启与 daemon 重启后再次读取均通过 |
| Phase 1 数值阈值已冻结 | 未完成 | §7 已填入 P0-05 实测与候选值，仍待业务 / 运维 / 安全 owner 签署 |

## 2. 证据分级

任何结论必须标明证据等级，禁止用低等级证据替代真实 OpenDesign 证据。

| 等级 | 含义 | 可支持的结论 |
|---|---|---|
| A：真实 OpenWork / OpenDesign 证据 | 来自固定版本的 OpenWork / OpenDesign 源码、真实本地 HTTP API、本地 `OD_DATA_DIR` 数据、脱敏数据或等价预生产环境 | 可用于 Phase 1 放行与阈值制定。 |
| B：DSH 集成证据 | 来自固定 DSH 版本上的插件 / MCP / overlay、UI、重启、故障与升级验证 | 可证明 DSH 接入能力，不能证明 OpenDesign 业务等价。 |
| C：桩 / 采集器自检证据 | 来自合成 OpenDesign HTTP fixture、契约测试和本机采样 | 只能验证契约与采集方法，不能替代 OpenWork 旧路径基线或 owner 的权限 / 隐私结论。 |
| D：假设 | 尚无可复核材料的判断 | 只能登记为待验证项，不能进入迁移收益或工期结论。 |

当前已具备 A 级（OpenWork / OpenDesign 源码、调用链与真实 renderer → IPC 基线）、B 级（真实 DSH bridge → OpenDesign API）与 C 级（合成故障 fixture）证据。剩余缺口是 owner 决议，不再是缺少可运行旧路径。

## 3. 出口合同

### GO（只读）：放行受控只读 Phase 1 试点

只有以下条件全部满足才能判定 GO（只读）：

- [ ] 候选只读切片的字段、错误语义已由 owner 确认（§5）。
- [x] 旧路径与试点路径读取同一 OpenDesign 数据目录（`OD_DATA_DIR`），标准化结果字段一致率 100%。
- [ ] 未授权读取 / 写入 0 次。
- [x] 故障可归类率 100%（真实路径覆盖 `NOT_FOUND`，P0-08 fixture 覆盖完整分类集）。
- [x] OpenDesign / 适配器重启后恢复正常；DSH 路径停止后旧 IPC 再次读取同一黄金对象成功。
- [x] 两条路径读取同一事实源，不复制数据库。
- [ ] Phase 1 全部验收阈值已由 owner 签署冻结（§7 已填入实测与候选数字）。
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
| P0-01 | 可运行版本 / 源码定位 | 技术完成 | 仓库、commit、daemon 启动命令与 Node 22 受控运行时已实测；仅待正式责任人 | 待指定：OpenWork / OpenDesign owner |
| P0-02 | 功能与入口 | 已完成 | 真实调用链、两个候选 API 与 list/get 字段语义均已实测 | 待指定：OpenWork / OpenDesign owner |
| P0-03 | 数据 | 部分可完成 | 固化字段、目录结构、删除 / 保留规则和黄金测试数据 | 待指定：数据 owner |
| P0-04 | 身份与权限 | 有条件完成 | 明确仅限本机单用户、loopback；不得宣称支持租户 / 资源级授权 | 待指定：身份 / 安全 owner |
| P0-05 | 旧链路基线 | 已完成（A+B） | 13 项比较检查全部通过；实测值已进入 §7，见受控证据 | 待指定：运维 owner 签阅 |
| P0-06 | 写入安全 | 只读切片不阻塞 | 明确写工具不存在（只读切片）且调用被拒绝；写入另行放行 | 待指定：业务 owner |
| P0-07 | 隐私与模型上下文 | 审批包已备 | owner 冻结模型字段白名单、日志禁入字段、遮蔽与浏览器持久化方案 | 待指定：隐私 / 安全 owner |
| P0-08 | DSH 可接入性 | 已完成（服务端 / bridge） | 已完成精确工具发现、真实 API list/get、故障分类、适配器 / daemon 重启后再读；P0-05 又验证停止 DSH 后旧 IPC 可读 | DSH 迁移 owner |

### P0-01 证据明细（OpenWork + OpenDesign 固定版本）

- **OpenWork `9e774879`**——真实旧客户端（Electron / React）；该固定版本保留 OpenDesign 完整只读字段、显式 `NOT_FOUND`，并支持受控 P0-05 数据目录 / 运行时输入。仓库：<https://github.com/OpenWorkai/openwork>。
- **OpenDesign `0c7955de`（v0.11.1）**——本地设计系统引擎（daemon + HTTP API），仓库：<https://github.com/OpenWorkai/open-design>。源码启动：`OD_DATA_DIR=<controlled-dir> node apps/daemon/dist/cli.js --host 127.0.0.1 --port 7456 --no-open`。
- **DeepSeek Harness `89b38861`**——当前只读试点与 P0-05 采集器；底座历史 commit `4e6e0a1` 仅用于追溯。
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
| 输出 | 完整设计系统（含 `body`）；字段白名单由隐私评审确认 | P0-05 已实测 OpenWork 与 DSH 返回相同白名单字段；list 不含 `body`，get 含 `body` |
| 授权 | 本机 loopback 单用户 | 同列表 |
| 错误 | 区分不存在（404）、上游不可用、限流、超时、schema 不兼容 | OpenWork 404 已显式保留为 `NOT_FOUND`；DSH 完整分类集契约测试通过 |
| 审计 | 记录 request、actor、resource、latency、result class | 未实现 |

### 写入门（`opendesign_create_design_system`，第二道门，不在本次 GO）

- 入参对齐 `UserDesignSystemInput`（`title` / `summary` / `category` / `body` / ...）。
- **阻塞项（P0-06）**：OpenDesign `createUserDesignSystem` 自动分配唯一 slug，**不等于请求幂等**；重试可能创建第二个对象。因此写入仍需：宿主签发可信用户批准凭证、requestId / callId 幂等键、重试 / 并发 / 超时不能重复创建、actor / 时间 / 参数摘要 / 结果的审计、测试对象删除或补偿能力、回退旧路径后可见同一条新建数据。
- 当前 `POST /api/design-systems`（`design-systems.ts:102`）与 `ipcBridge.opendesign.createDesignSystem`（`opendesignDaemonBridge.ts:56`）存在，但未经上述安全闸门，故不在只读 GO 范围。

关闭 [DSH overlay](opendesign-readonly-pilot.cordis.yml) 只会阻止后续 DSH 调用并把流量切回 OpenWork 原生 IPC 路径；它不会撤销已写入 OpenDesign 事实源的数据，因此不能单独计为"写入回滚通过"。

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
- 把 §7 实测候选值交由 owner 冻结；不得把单机采样自动提升为生产容量承诺。

### 当前 DSH 资产的正确定位

`examples/opendesign-readonly-pilot/server` 是 loopback-only OpenDesign 只读适配器，不包含活动的 Jiwo / Arkme records 桩。P0-05 采集器已把真实 OpenWork renderer / IPC 与真实 DSH bridge 置于同机、同源、顺序对照中；一次本机采样仍不能自动外推成生产容量阈值。

机器可读基线应保存到受控证据目录并记录来源，不应只引用 `/tmp` 文件，因为临时文件不可审计、不可共享。

## 7. Phase 1 阈值冻结表

安全与一致性的硬阈值已给出。性能 / 恢复项同时列出 P0-05 实测与建议候选值；候选值只有在业务、运维和安全 owner 签署后才算冻结。

| 类别 | Phase 1 阈值 | 状态 |
|---|---|---|
| 标准化结果字段一致率（列表剔除 body / 单读含 body，两端一致） | 100% | 已冻结 |
| 未授权读取或写入 | 0 次 | 已冻结 |
| 敏感字段进入日志、提示词或浏览器持久态 | 0 个未授权字段 | 已冻结 |
| 故障类型可观测率 | 已列故障类别 100% 返回可归类结果；不得静默空工具集 | 已冻结 |
| DSH 停止后旧路径恢复 | 实测回退冒烟成功；候选：旧路径 daemon ready + 首读 ≤ 3.0 s | 待 owner 冻结 |
| 旧路径读成功率 | 实测 100%；候选下限 100% | 待 owner 冻结 |
| 试点路径读成功率下限 | 实测 100%；候选下限 100% | 待 owner 冻结 |
| 读 p95 / p99 上限 | 两路径最差实测 105.282 / 122.325 ms；候选 ≤ 150 / 175 ms | 待 owner 冻结 |
| 容量下限与错误率 | 实测 20 并发、19.944 / 21.550 ops/s、错误率 0%；候选 ≥ 20 并发或 ≥ 18 ops/s，错误率 0% | 待 owner 冻结 |
| CPU / 内存增量上限 | DSH adapter 实测 RSS +21.218 MiB；候选 ≤ +32 MiB。CPU 与 OpenWork 完整进程树 RSS 因采样范围不同不冻结 | 阻塞：需 owner 接受范围或补生产采样 |
| 故障恢复时间上限 | 实测 DSH adapter 首读 154.684 ms、OpenDesign 依赖首读 2684.385 ms；候选 ≤ 250 ms / ≤ 3.0 s | 待 owner 冻结 |
| DSH 固定版本升级回归 | 1 次演练，契约 / UI / 持久化回归失败 0 项 | 已冻结，待 Phase 1 执行 |

阈值必须由业务、运维和安全 owner 在看到旧路径基线后、Phase 1 生产接线前签定；不得在试点结果出来后放宽。

## 8. 现有 DSH 资产可采信范围

| 资产 | 已证明 | 尚未证明 |
|---|---|---|
| [只读适配器](server/opendesign-readonly-server.mjs) | loopback-only 真实 OpenDesign API 转换；精确暴露 list/get；字段白名单；无业务存储、无写工具 | owner 尚未批准最终白名单；不证明 OpenWork 旧路径等价、资源 / 租户授权或生产容量 |
| [契约与 bridge 测试](server/tests/opendesign.contract.test.mjs) | 14 项测试覆盖工具清单、字段过滤、七类上游故障、写拒绝、overlay 及真实 `dsh-mcp-client` 执行 | 不证明 OpenWork UI 回退时间、长时稳定性或最终权限 / 隐私政策 |
| [P0-05 同源采集器](server/p0-05-collect.mjs) | 顺序运行真实 OpenWork renderer → IPC、DSH MCP 与停止 DSH 后旧 IPC 回退；输出字段差异、成功率、延迟、并发、资源范围和恢复 | 正式峰值容量、长时稳定性与 owner 阈值签署 |
| [client 脚手架](client/) | 已重对齐 `opendesign/list` / `opendesign/get`，仅有回放缓存和只读 UI，无 write 事件；Host / browser 独立类型检查通过 | 尚未接入生产宿主构建；实际事件生产、UI 重放、权限展示与升级兼容仍未验证 |
| [受控 P0-05 对照证据](evidence/opendesign-p0-05-comparison.md) | 13 项比较检查全部通过；同源字段一致、两侧 20/20、20 并发、恢复、错误分类与回退均成功 | 单机小样本不能单独承诺生产容量；资源采样范围不同 |
| [P0-07 owner 审批单](evidence/opendesign-p0-07-owner-review.md) | 把字段、日志和持久化选择压缩为可签署清单 | 尚未签署 |
| [只读 GO 决策单](evidence/opendesign-readonly-go-decision.md) | 汇总 P0-01、P0-03/04、P0-07 与 §7 的 owner 批准和最终决议 | 尚未签署；当前 HOLD |

因此，P0-05 / P0-08 完成仍不能改写为“Phase 0 通过”。只有 owner 边界确认、P0-07 审批与 §7 候选阈值冻结完成后，才可评审只读 GO。

## 9. 最短收尾顺序

1. 在 [`只读 GO 决策单`](evidence/opendesign-readonly-go-decision.md) 指定 OpenWork / OpenDesign / DSH / 数据 / 安全 / 运维 owner（P0-01）。
2. 在决策单固化黄金测试数据保留期限与删除责任人（P0-03）。
3. 由身份 / 安全 owner 在决策单确认仅本机单用户 + loopback 权限范围（P0-04）。
4. ~~用同一 `OD_DATA_DIR` 跑真实 OpenWork IPC 与 DSH 对照、回退和资源采样（P0-05）。~~ 已完成。
5. owner 通过决策单签署 [`P0-07 审批单`](evidence/opendesign-p0-07-owner-review.md) 的选择。
6. owner 在决策单冻结 §7 候选数字，并决定是否接受 adapter-only 资源范围或补生产采样。
7. 最终决策 owner 签署后，评审 → 只读 GO、继续 HOLD 或 NO-GO。

## 10. 决策记录

| 字段 | 值 |
|---|---|
| 决策 | HOLD |
| 日期 | 2026-08-22 |
| 放行范围 | 无；继续 Phase 0 证据收集，目标为范围明确的"只读 GO" |
| 关键变化 | P0-05 与 P0-08 均通过：真实同源对照、字段一致、20 并发、错误分类、恢复及停止 DSH 后旧 IPC 回退已验证；总体仍 HOLD |
| 已接受证据 | A 级：OpenWork `9e774879` + OpenDesign `0c7955de` 真实 renderer / IPC；B 级：DSH `89b38861` 精确 list/get、真实 API、错误分类与恢复；即我 / Arkme 仅作方向参考 |
| 主要阻塞 | P0-07 隐私白名单未获 owner 批准；P0-03/04 owner 边界未签；§7 候选阈值与资源采样口径未签 |
| 下一次评审触发 | P0-03/04/07 owner 签署 + §7 候选阈值冻结 |
| 全面迁移 / 写入 | 未批准；写入另设第二道门 |
