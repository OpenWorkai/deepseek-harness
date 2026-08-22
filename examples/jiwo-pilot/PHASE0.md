# 即我 → DSH 试点 · Phase 0 证据台账（Evidence Ledger）

> 配套文档：`MIGRATION_JIWO.md`（复核决策 + 分阶段验证方案）、`README.md`（pilot 树与缺口说明）、`server/jiwo-stub-server.mjs`（即我后端桩）、`server/baseline-harness.mjs`（基线采集器）、`server/tests/jiwo.contract.test.mjs`（契约/回滚测试）。
>
> 本文件追踪 Phase 0 的六道证据闸门（§5）、八项验收门槛（§6）的**数值阈值框架**、所选切片的字段级契约、基线方法论，以及四类必须由用户提供的即我专有材料。
>
> **Phase 0 出口条件（MIGRATION_JIWO.md §5 末段）**：每个未知项都有证据或明确责任人，且试点验收阈值已用数值写定；否则不估算全面迁移工期。

---

## 0. 进度速览（snapshot）

| §5 闸门 | 状态 | 说明 |
|---|---|---|
| (1) 即我源码 + 功能/入口/依赖清单 | 🔴 阻塞 | 需要材料 #1 |
| (2) 数据字典 | 🔴 阻塞 | 需要材料 #2 |
| (3) 账户与权限模型 | 🔴 阻塞 | 需要材料 #3 |
| (4) 候选切片基线 | 🟡 方法论就绪 / 真实数值阻塞 | 参考基线已采集；真实数值需要材料 #4 |
| (5) 低风险垂直切片 | 🟢 已选定 | `jiwo_read_note` + `jiwo_write_tag`（即我后端仍为唯一事实源） |
| (6) 字段级契约 | 🟢 已起草 | 见 §3；契约由 stub + 契约测试兑现，待真实后端对齐 |

| §6 验收门 | 数值阈值 | 状态 |
|---|---|---|
| 正确性 / 数据安全 / 写入安全 / 持久性 / 可运维性 / 性能 / 回滚 / 升级 | 见 §2（全部标 `PENDING`） | 框架已立，阈值待材料 #4 校准 |

**四类阻塞材料（必须由用户提供）**：源码清单 · 数据字典 · 权限模型 · 真实端点。详见 §5。

---

## 1. §5 六道证据闸门 — 逐项追踪

### 闸门 (1)：即我当前源码与可运行版本，功能/入口/外部依赖清单
- **状态**：🔴 阻塞（需材料 #1）
- **交付物**：仓库路径、可运行版本标签、功能清单（feature inventory）、入口清单（entry points，如服务启动脚本 / API 网关）、外部依赖清单（DB / 缓存 / 对象存储 / 第三方 API）。
- **责任人**：用户（仅用户掌握即我源码位置）。
- **未提供前的处理**：pilot 用 `jiwo-stub-server.mjs` 作为即我后端的 drop-in 占位；不对功能等价性作任何声称。

### 闸门 (2)：数据字典
- **状态**：🔴 阻塞（需材料 #2）
- **交付物**：实体、字段、关系、索引、数据量、增长率、敏感等级、保留与删除规则。
- **责任人**：用户 / 即我数据 owner。
- **未提供前的处理**：pilot 仅操作 `note{ id, title, body, tags[], updatedAt }` 这一最小子集（见 `SEED_NOTES`），不触碰任何关系数据。

### 闸门 (3)：账户与权限模型
- **状态**：🔴 阻塞（需材料 #3）
- **交付物**：主体（subject）、租户（tenant）、设备、登录态、刷新、注销、第三方绑定、授权检查点（auth checkpoints）。
- **责任人**：用户 / 即我账户 owner。
- **未提供前的处理**：pilot 一期不迁移登录或主数据库；DSH `authorization` 仅承接凭证交互缝（见 MIGRATION_JIWO.md §2 复核结论）。契约不施加任何账户级权限检查（见 §3「权限」列）。

### 闸门 (4)：候选切片当前基线
- **状态**：🟡 方法论 + 参考基线已就绪；**真实数值阻塞**（需材料 #4）
- **已交付**：
  - 基线采集器 `server/baseline-harness.mjs`（讲真实 JSON-RPC 2.0 给实现即我工具契约的 MCP server）。
  - **STUB 参考基线**已采集（默认配置，见 §4 + `/tmp/jiwo-baseline.json`）。
- **待交付**：把 `JIWO_SERVER_CMD` 指向真实即我端点后重跑，得到生产保真度基线，用以校准 §2 阈值。
- 基线需覆盖的六个量（MIGRATION_JIWO.md §5 闸门(4) 原文）：成功率、错误类型、p50/p95 延迟、峰值并发、资源占用、恢复时间。本 harness 已覆盖前五项（资源占用以 `opsPerSec` + `elapsedMs` 近似，真实端点需补 CPU/内存采样）。

### 闸门 (5)：选定低风险完整垂直切片
- **状态**：🟢 已选定并落地（见 MIGRATION_JIWO.md §9 第三步）
- **切片**：「检索一条笔记 + 经确认写入一个标签 + 一个 UI 结果节点」。
- **即我后端在 pilot 期仍为唯一事实源**；写入落点即我（stub 中为 JSONL 文件），DSH 不做账户/主库替换。
- **工具实现**：`jiwo_read_note`（只读）+ `jiwo_write_tag`（幂等、需 `confirmed:true` 显式确认）。

### 闸门 (6)：字段级 I/O / 权限 / 错误 / 回滚契约
- **状态**：🟢 已起草（见 §3）；契约由 stub 与 `jiwo.contract.test.mjs`（8 项通过）兑现。
- **待办**：真实后端接入后，用同一组契约测试断言真实端点行为一致（§3 契约是 stub 与真实实现的共同约定）。

---

## 2. §6 八项验收门槛 — 数值阈值框架（实现前写定）

> **原则（MIGRATION_JIWO.md §6「性能」项明示）**：具体容许退化比例 / 阈值**必须在实现前确定**，不能在结果出来后调整。下方阈值目前全部标 `PENDING`，待材料 #4（真实基线）采集后填实际数值；`STUB` 列为参考基线占位，仅用于校验 harness 逻辑，**不代表生产可接受值**。

| 门槛 | 验收判据（来自 §6） | 数值阈值（PENDING → 真实基线校准） | STUB 参考 |
|---|---|---|---|
| **正确性** | 黄金数据集字段、排序、分页、错误码、权限决定全部一致；允许差异须有书面产品决策 | 字段一致率 ≥ 100%（允许差异逐项书面化）；排序/分页差异 = 0 | reads 200/200=100% |
| **数据安全** | 未授权主体无法通过 tool/MCP/UI/重放事件取数；敏感值不进日志/提示词/浏览器持久态 | 未授权访问 = 0 例；敏感字段泄露 = 0 例（需真实权限模型定义「敏感」） | 不涉及（无账户层） |
| **写入安全** | 所有写可幂等重试；超时后能判断是否已提交；重复调用不生成重复业务记录 | 幂等：重复 `jiwo_write_tag` 同 tag → 0 新增记录；超时判定覆盖率 = 100% | 同 tag 幂等：no-op ✔ |
| **持久性** | DSH / MCP / 即我分别重启后，已确认写入仍存在；UI 与会话投影可从事件重建 | 重启后已确认写入存在率 = 100%；事件重建一致率 = 100% | recover 重启后 persisted=true ✔ |
| **可运维性** | 工具发现失败 / 认证过期 / 后端不可用 / schema 不匹配都有可观测错误，不静默退化成空工具集 | 错误可见率（`isError:true`）= 100%（5 类错误均须 VISIBLE） | 5/5 错误类型 10/10 VISIBLE ✔ |
| **性能** | 用 Phase 0 同负载比较新旧链路；容许退化比例实现前定 | 读 p95 ≤ 真实基线 × (1+容许退化%)；写 p95 同理；**容许退化% PENDING** | read p95=0 / write p95=1 ms（无真实基线，不可外推） |
| **回滚** | 禁用 Jiwo overlay 即回旧路径；试点期不做不可逆 schema 变更，不删旧客户端/原始数据 | 回滚演练 = 100% 通过；旧客户端在禁用 overlay 后仍可读同一事实源 | overlay `failOnStartupError:true` 已验证 |
| **升级** | 至少一次 DSH 版本升级演练；插件/client/overlay/持久化数据全过回归 | 升级演练 = 100% 通过；回归失败 = 0 | 未执行（Phase 2 前） |

**阈值填写流程（待材料 #4 到位后）**：
1. `JIWO_SERVER_CMD=<真实即我端点启动命令> node examples/jiwo-pilot/server/baseline-harness.mjs --json > /tmp/jiwo-real-baseline.json`
2. 用真实 `latency.readMs.p95` / `latency.writeMs.p95` / `concurrency.opsPerSec` / `recovery.*` 填上表「数值阈值」列，并将「性能」容许退化% 定为明确数值（如 ≤ 120% 即不退化超过 20%）。
3. 将填定后的阈值作为 Phase 1 出口判据（MIGRATION_JIWO.md §5 Phase 1 出口条件）。

---

## 3. 切片字段级契约（闸门 6 的交付物草稿）

> 这是 stub 与真实即我后端**共同遵守**的契约。stub 已实现并通过 `jiwo.contract.test.mjs`；真实端点接入后须用同一组测试断言一致性。

### 工具 1：`jiwo_read_note`（只读，永不写）

| 维度 | 约定 |
|---|---|
| **输入** | `noteId: string`（必填，如 `"note-1"`） |
| **输出** | `content[0].text` = 笔记 JSON（`id, title, body, tags[], updatedAt`）；`structuredContent.note` = 同对象 |
| **权限** | pilot 期不施加账户级检查；只读，无副作用 |
| **错误** | 笔记不存在 → `toolError('note not found: <id>')`，`isError:true`，**无** `structuredContent` |
| **回滚** | 无写操作，天然可回滚（无状态变更） |

### 工具 2：`jiwo_write_tag`（幂等、确认门控写）

| 维度 | 约定 |
|---|---|
| **输入** | `noteId: string`（必填）、`tag: string`（必填，非空）、`confirmed: boolean`（必填，仅在用户显式确认后置 `true`） |
| **输出** | `content[0].text` = 人类可读结果；`structuredContent = { noteId, tags[], changed: boolean }` |
| **幂等** | 已存在的 tag → `changed=false`，no-op，不新增记录；每次写入写穿（write-through）到事实源 |
| **权限** | pilot 期不施加账户级检查；但 `confirmed` 是**写入安全闸门**（§6 写入安全） |
| **错误** | ① `confirmed !== true` → 拒绝写；② 笔记不存在 → 拒绝；③ `tag` 为空/空白 → 拒绝。三者均 `isError:true` |
| **回滚** | 仅追加 tag；回滚 = 删除该 tag（或禁用 overlay 回到旧路径，旧客户端仍读同一事实源，无需反向数据迁移） |

### 契约测试覆盖（`jiwo.contract.test.mjs`，8 项通过）
工具数 = 2；输入 schema 正确；黄金读；错误可见性（5 类）；确认门控；幂等写；持久性（写穿）；回滚代理；overlay 配置（`failOnStartupError:true` + `transport: stdio`）。

---

## 4. 基线方法论（闸门 4 的交付物）

### 采集器
`examples/jiwo-pilot/server/baseline-harness.mjs` — 讲真实 JSON-RPC 2.0（newline-delimited）给实现即我契约的 MCP server。

**CLI 旗标**：`--reads`（默认 200）、`--writes`（默认 100）、`--concurrency`（默认 200）、`--warmup`（默认 5）、`--json`。
**环境变量**：
- `JIWO_SERVER_CMD`：自定义端点启动命令（经 `['sh','-c',cmd]` 运行）。**不设则用 in-repo stub**。
- `JIWO_DATA_FILE`：隔离的临时 JSONL 存储（默认 `os.tmpdir()` 下随机文件，绝不改写提交的 gitignored 文件）。
- `KEEP_DATA=1`：保留临时数据文件以便人工检查（否则跑完自动 `unlink`）。

**关键修复**（已验证）：`waitReady()` 先阻塞在 server 的 stderr `ready` 信号，再发 `initialize`；仅在整段超时后才回退到 initialize 轮询。这避免了「快速重启后 client 在 stub 的 `loadAll()` 完成前就读取 → 误判持久化失败」的竞态（首跑 `persistedWriteAfterRestart=false`，修复后 `true`）。

### 参考基线（STUB，默认配置，2026-08-22 采集）
> ⚠️ **仅为方法论校验，不是生产基线**。真实数值需 `JIWO_SERVER_CMD` 重采。

```
=== Jiwo → DSH Pilot · Phase 0 Baseline (reference) ===
server : in-repo stub (jiwo-stub-server.mjs)   [isStubReference: true]
· Golden success rate
  read  : 200/200  (100%)
  write : 100/100  (100%)
· Error visibility (each must surface isError:true)
  missing_note_read       10/10  VISIBLE
  unconfirmed_write       10/10  VISIBLE
  missing_confirmed_write 10/10  VISIBLE
  empty_tag_write         10/10  VISIBLE
  missing_note_write      10/10  VISIBLE
· Latency (ms, warmup-excluded)
  read  : p50=0  p95=0  max=1
  write : p50=0  p95=1  max=2
· Peak concurrency (single client process)
  inFlight=200  ok=200  err=0  22222.2 ops/s  (100%)
  note: Single-client-process concurrency; not multi-client peak load.
· Restart recovery + persistence
  restart→ready=68ms  restart→firstRead=68ms
  readyAfterRestart=true  persistedWriteAfterRestart=true
```

完整机器可读对象见 `/tmp/jiwo-baseline.json`。

### 重跑命令
```bash
# 参考基线（stub）
node examples/jiwo-pilot/server/baseline-harness.mjs --json > /tmp/jiwo-baseline.json

# 真实基线（材料 #4 到位后）
JIWO_SERVER_CMD="<真实即我端点启动命令>" \
  node examples/jiwo-pilot/server/baseline-harness.mjs --json > /tmp/jiwo-real-baseline.json
```

---

## 5. 必须由用户提供的四类即我专有材料（阻塞项）

> 这些材料只有用户能供给（源码位置、数据 schema、账户体系、生产端点），无法由 pilot 自证。提供后闸门 (1)(2)(3)(4) 解除阻塞，§2 阈值进入「可填定」状态。

| # | 材料 | 解除的阻塞 | 形式建议 |
|---|---|---|---|
| **#1** | 即我源码位置 + 可运行版本标签 + 功能/入口/外部依赖清单 | 闸门 (1) | 仓库路径 + 启动命令 + 一份清单（或让我 clone 后自行梳理，但需授权访问） |
| **#2** | 数据字典：实体、字段、关系、索引、数据量、增长率、敏感等级、保留/删除规则 | 闸门 (2) | 导出 schema / DDL / 样例数据（脱敏） |
| **#3** | 账户与权限模型：主体、租户、设备、登录态、刷新、注销、第三方绑定、授权检查点 | 闸门 (3) | 一段说明 + 关键接口/中间件清单 |
| **#4** | 真实即我端点（可启动为 MCP / 或我能包一层 MCP 的即我服务）启动命令 | 闸门 (4) 真实数值 + §2 阈值校准 | `JIWO_SERVER_CMD` 可用的 shell 命令；或提供即我 API 规范由我写 MCP adapter |

**阶段性建议**：若 #4 暂时无法给出，可先提供 #1/#2/#3 以解锁功能/数据/权限分析；性能与持久性门槛的阈值则等真实端点到位后补采。无论如何，提交全面迁移工期估算**前**必须集齐全部四类（§8 工期重估要求）。

---

## 6. 下一步（Phase 0 收尾 → Phase 1 入口）

1. **用户供给 §5 四类材料** → 解除 (1)(2)(3)(4) 阻塞。
2. **重跑真实基线** → 填定 §2 数值阈值（含性能容许退化%）。
3. **Phase 1 准备**：固定 DSH 提交 + 依赖锁；用原生插件或 MCP（`failOnStartupError:true`）暴露 `jiwo_read_note`；加 `jiwo_write_tag` 确认门控写；最小 client 插件展示可重放结果；同一组黄金用例新旧对比；注入故障 + 真实回滚演练。
4. **Phase 1 出口**：功能与权限契约全过、零不可解释数据差异、回滚演练通过，且指标达 §2 阈值。

---

*本台账随材料到位持续更新；每次阈值填定或契约变更都在此留痕。*
