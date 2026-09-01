# OpenWork 只读接入 OpenDesign Phase 1：实现与验收清单

> 状态：**已授权实现，未批准生产发布**。本阶段只实施本机单用户、loopback 环境中的真实只读接线与 OpenWork UI 集成；任何写入、远程访问、多租户、资源级共享或生产 Host/web 组合都必须另行评审。
>
> 系统关系：**OpenWork（原生入口）→ OpenDesign（唯一事实源）← DSH overlay / adapter（配套设施）**。DSH 不拥有 OpenDesign 业务数据，OpenWork 原生 IPC 路径不得移除。

## 1. 冻结输入

Phase 1 不重新解释或放宽 Phase 0。以下文件是实施与验收的唯一批准来源：

- [`PHASE0.md` §5](PHASE0.md#5-候选切片及契约缺口)：list/get 输入、输出、授权和错误要求。
- [`PHASE0.md` §7](PHASE0.md#7-phase-1-阈值冻结表)：字段一致率、成功率、延迟、吞吐、资源、恢复和升级阈值。
- [`P0-07 隐私审批单`](evidence/opendesign-p0-07-owner-review.md)：字段白名单、日志允许/禁止字段和浏览器持久化方案 1。
- [`只读 GO 决策单`](evidence/opendesign-readonly-go-decision.md)：批准范围、事实源、回退路径和 owner 决议。
- [`P0-05 同源对照`](evidence/opendesign-p0-05-comparison.md) 与 [`P0-08 DSH 端到端证据`](evidence/opendesign-dsh-readonly-e2e.md)：真实基线和已验证的设施能力。

固定证据版本为 OpenWork `9e774879`、OpenDesign `0c7955de`（v0.11.1）和 DeepSeek Harness `e920aed`（取代冻结的 `89b38861`，新增只读 gateway `8a0508d` + IM loopback 金丝雀）。DSH 固定版本已实质变化：按本规则将 P0-08 在 `e920aed` 复验并重新冻结受影响阈值；OpenDesign 版本未变，P0-05 原生基线免重做。

## 2. 不可变实现范围

- 只允许 `opendesign_list_design_systems` 与 `opendesign_get_design_system`。
- list 只能返回 P0-07 批准的摘要字段且不得含 `body`；get 只能在摘要白名单上增加 `body`。适配层显式复制允许字段，所有未知字段默认丢弃。
- OpenDesign 与同一个 `OD_DATA_DIR` 始终是唯一事实源；缓存必须可丢弃，清除缓存不得影响事实源。
- list 摘要可进入可丢弃的本地回放缓存；get 的 `body` 只驻留当前会话内存，禁入浏览器持久态、日志和诊断负载。
- OpenWork renderer 不直接使用 Node.js、MCP 子进程、OpenDesign token 或绝对路径；跨进程调用只经过 typed IPC。
- OpenWork 原生 IPC 读路径保持可用。DSH 启动、发现、调用或恢复失败必须显示可分类错误，并允许用户切回原生路径；不得静默伪装成空结果。
- 既有写 IPC 的存在不代表本试点获准使用。试点代码、UI、测试和配置不得调用或暴露 create/chat/write 工具。

## 3. 实施顺序

### P1-00：隐私与失败语义预检

- [ ] 先写失败测试，证明持久缓存 schema 和 `put` 输入都拒绝 `body`；正文另存于进程/会话内存并在关闭、禁用或会话结束时清除。
- [ ] 先写失败测试，证明 list/get 的上游不可用、限流、超时、未认证、无权限、不存在和 schema 不兼容不会变成成功的空数组或 `null`。
- [ ] 先写失败测试，证明日志与错误 DTO 不含 P0-07 禁止字段；资源 id 只能记录不可逆摘要。
- [x] 修复当前 client 回放缓存允许可选 `body` 的冲突；在这些测试变绿前不得接入 OpenWork UI。

### P1-01：确定真实 DSH 调用路径

- [x] 使用 DSH 支持的插件组合或 SDK/协议，使 OpenWork 调用经过 DSH 工具设施后再到 OpenDesign；直接从 OpenWork 启动 MCP adapter 不能作为“经 DSH 接入”的完成证据。
- [x] 固定 DSH 可执行入口、overlay、依赖锁文件和 adapter 文件摘要；配置必须启用启动失败即报错，且只接受 loopback OpenDesign URL。
- [x] 启动后读取工具目录并断言恰好存在两个批准的只读工具；缺少工具、出现写工具或版本不匹配时拒绝启用试点路径。
- [x] 将 DSH 生命周期绑定到 OpenWork 主进程，覆盖启动、取消、退出和孤儿进程清理；renderer 不持有进程句柄。

受控证据：[`P1-01 真实 DSH 调用路径`](evidence/opendesign-p1-01-runtime-path.md)。实现只提供 main-process owner；试点激活与原生路径选择仍属于 P1-02，不代表 UI 或生产接线。

### P1-02：OpenWork 主进程只读服务

- [ ] 在 `src/process/agent/platforms/opendesign/` 内增加可注入、可测试的试点读服务，统一 DSH 与原生 IPC 两条读取实现。
- [ ] 服务返回显式来源、耗时和固定错误分类；list 的合法空结果与读取失败必须可区分。
- [ ] 默认保持原生路径；试点只通过非生产开关启用，关闭开关立即停止后续 DSH 调用并回到原生路径。
- [ ] 回退只切换读取路径，不复制、迁移或回写数据，也不修改 `OD_DATA_DIR`。

### P1-03：typed IPC 与安全观测

- [ ] 在 `src/common/adapter/ipcBridge/opendesign.ts` 定义 list/get 的显式白名单 DTO、来源和错误联合类型；不得用索引签名承接未知上游字段。
- [ ] 在 `src/process/bridge/opendesignDaemonBridge.ts` 注册试点读 provider；现有原生 provider 保持兼容，写 provider 不进入试点路由。
- [ ] 观测只记录 P0-07 允许字段；错误消息使用固定分类和通用说明，不拼接上游响应正文、提示词或 MCP 内容。
- [ ] IPC 单元测试覆盖允许字段、未知字段丢弃、禁止字段不泄漏、合法空列表、分类失败和回退来源。

### P1-04：OpenWork UI 集成

- [ ] 只在 `src/renderer/pages/art-design/OpenDesignSystemsPanel.tsx` 的设计系统只读目录接入试点服务；不改动创建、聊天、编辑或应用写入流程。
- [ ] UI 明确显示当前来源为原生路径或 DSH 试点，并为加载、合法空列表、分类失败、回退中和已回退提供互不混淆的状态。
- [ ] 选择摘要后才执行 get；正文只存在于当前 React/会话内存，关闭详情、禁用试点或卸载页面时释放。
- [ ] 新增用户可见文案全部使用 OpenWork i18n；使用现有 COSS UI、`CoderIcon` 和 `ow-*` token，不增加依赖或新的全局样式。
- [ ] renderer 测试证明失败不会显示为“没有设计系统”，且任何 UI 操作都无法触发试点写工具。

### P1-05：同源验收、回退与升级演练

- [ ] 对原生 IPC 与 DSH 试点路径运行同一 `OD_DATA_DIR` 和同一黄金用例，逐字段比较 list/get，并满足 [`PHASE0.md` §7](PHASE0.md#7-phase-1-阈值冻结表) 的全部冻结阈值。
- [ ] 注入七类批准故障，验证分类结果、UI 状态和日志遮蔽；已列故障不得静默退化为空工具集、空列表或 `null`。
- [ ] 停止 DSH 后验证原生路径恢复；分别重启 adapter 与 OpenDesign，验证首读恢复时间。
- [ ] 清除所有试点缓存后验证 `OD_DATA_DIR` 与原生读取结果不变；扫描浏览器持久态和日志，确认禁止字段零命中。
- [ ] 对一个后续固定 DSH 版本完成升级演练；契约、UI、持久化与回退回归失败必须为 0。
- [ ] 保存机器可读结果与人类可读摘要到 `evidence/`，记录固定版本、机器、采样范围、命令和时间；不得只引用 `/tmp` 结果。

## 4. 测试责任分层

| 层级 | 必须证明 |
|---|---|
| DSH client/server 单元与契约测试 | 精确工具目录、字段显式复制、七类故障、日志遮蔽、摘要持久缓存不含 `body`、会话正文清理 |
| OpenWork 主进程单元测试 | DSH 生命周期、分类错误、合法空结果、原生回退、无写调用、清理顺序 |
| OpenWork IPC/renderer 测试 | DTO 不泄漏、来源与失败状态、按需 get、正文不持久化、i18n UI、写入口不可达 |
| 同源端到端采集 | 相同 `OD_DATA_DIR` 下的字段一致率、成功率、延迟、并发/吞吐、资源、恢复与回退 |
| 固定版本升级演练 | 新固定版本上的契约、UI、持久化和回退回归失败为 0 |

所有行为变更先提交失败测试，再提交最小实现。DSH 与 OpenWork 各自运行聚焦测试、类型检查、lint 和文档检查；UI 变更另运行 OpenWork i18n 与 token 检查。

## 5. Phase 1 出口

只有以下条件全部成立，Phase 1 才能标记为“只读试点完成”：

- [ ] P1-00 至 P1-05 全部完成，并有受控证据链接。
- [ ] 两个批准工具的功能、字段、权限、错误、隐私和持久化要求全部通过。
- [ ] [`PHASE0.md` §7](PHASE0.md#7-phase-1-阈值冻结表) 全部冻结阈值通过，且没有事后放宽。
- [ ] OpenWork UI 可辨认试点来源、失败和回退状态；原生 IPC 保持可用。
- [ ] 固定版本升级演练通过，契约、UI、持久化和回退回归失败为 0。
- [ ] 没有新增写入、远程、多租户、资源级共享、生产 Host/web 接线或不可逆数据变更。

完成以上项目只证明受控只读试点可用，**不批准生产发布或扩大迁移范围**。生产接线、写工具或任何范围扩展都需要新的证据、阈值和 owner 决议。

## 6. 立即停止条件

出现以下任一情况时停止实现并把结论改回 HOLD：

- DSH 工具目录无法精确限制为批准的两个只读工具，或 OpenWork 实际绕过 DSH 直接调用 adapter 却仍声称完成 DSH 接入。
- 任一禁止字段进入日志、提示词、MCP 诊断内容或浏览器持久态，或正文无法在会话结束时清除。
- 任一批准故障被转成成功的空数组、`null` 或静态目录而没有显式失败/回退状态。
- DSH 停止后原生 IPC 无法读取同一事实源，或回退需要数据迁移、反向同步或 schema 变更。
- 任一冻结阈值未通过，或需要在看到结果后放宽阈值才能通过。
- 实现需要调用写工具、暴露非 loopback 地址、复制 OpenDesign 业务数据或移除原生读取路径。
