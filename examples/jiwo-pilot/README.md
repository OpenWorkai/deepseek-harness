# Jiwo × DSH 试点（Phase 1 绞杀式迁移脚手架）

> 对应论证：[`MIGRATION_JIWO.md`](../../MIGRATION_JIWO.md) §5 / §9。
> 决策状态：**有条件批准验证，不批准全面迁移**。本目录是一个低风险、可回滚的端到端试点脚手架，保留即我（此处用桩后端代替）为唯一事实源。

## 1. 已批准的切片（本试点覆盖）

「检索一条笔记 + 经确认写入一个标签」：

- `jiwo_read_note` —— 只读，绝不改写；缺失笔记返回**错误**而非静默空结果。
- `jiwo_write_tag` —— 幂等、需显式确认的写入；写入落到即我后端（桩：`server/.jiwo-data.jsonl`）。

`storage-domain` 在本试点**仅用于本地缓存**已检索的笔记，绝不承载权威个人数据、不做数据迁移（§1/§5）。

## 2. 工具契约

| 工具 | 入参 | 行为 | 错误/边界 |
|---|---|---|---|
| `jiwo_read_note` | `noteId: string` | 返回 `{id,title,body,tags,updatedAt}` | 笔记不存在 → `isError:true` + "not found"，**不返回空对象** |
| `jiwo_write_tag` | `noteId`, `tag`, `confirmed:boolean` | 追加标签；已存在则 no-op（幂等） | `confirmed!==true` → 拒绝；笔记不存在 → 拒绝；空 tag → 拒绝 |

**幂等性**：同一 `(noteId, tag)` 重复调用，`tags` 不产生重复记录，两次均返回成功（`changed:false` 第二次）。
**确认门**：`confirmed` 必须由 harness 在取得用户显式确认后才置 `true`；桩本身不做交互，只校验该布尔值。
**错误可见性**：所有失败都通过 MCP `isError` + 文本返回，绝不静默退化为空工具集（满足 §6 可运维性）。

## 3. 运行（从源码）

```sh
# 在 DSH 仓库根目录
pnpm install
pnpm build
pnpm dsh web --patch "$PWD/examples/jiwo-pilot/jiwo-pilot.cordis.yml"
```

- `node` 需在 `PATH` 上（`dsh-mcp-client` 以 `command: node` 拉起桩服务，沿用 `examples/mcp-memory` 的约定）。
- 工具以 `mcp__jiwo__jiwo_read_note` / `mcp__jiwo__jiwo_write_tag` 暴露给模型。
- `failOnStartupError: true`：**必须**。禁止「启动成功但无工具」的假成功；桩连不上或同步失败则插件激活直接报错。
- 可选覆盖数据文件：`JIWO_DATA_FILE=/abs/path.jsonl dsh web --patch ...`（默认 `examples/jiwo-pilot/.jiwo-data.jsonl`，已被 `.gitignore` 忽略）。

## 4. 契约与回滚测试

```sh
pnpm exec vitest run --config examples/jiwo-pilot/vitest.config.mjs
```

覆盖 §6 验收门槛的可机检部分：工具清单形状、黄金读取字段级一致、错误可见性、确认门、幂等写入、持久化（写入落到 JSONL 事实源）、回滚代理（写入后读路径完好、无迁移产物）、overlay 配置契约（`failOnStartupError:true` + `stdio`）。

> 回滚代理：桩是纯工具桥，不删除/迁移任何数据，这是「禁用 overlay 即可回到旧路径」安全的前提。完整的 DSH 禁用 overlay 演练为手动（见 §6）。

## 5. 回滚步骤（§6）

1. 停止 `dsh web`（或去掉 `--patch` 中的 `jiwo-pilot.cordis.yml`）。
2. 旧即我客户端继续使用同一即我后端 —— **试点期不做不可逆 schema 变更，不删除旧客户端或原始数据**，因此无需反向数据迁移。
3. 重新启用：重新带上 `--patch` 即可，桩数据文件保持不变。

## 6. Phase 0 证据缺口（全面迁移前置，当前工作区缺失）

本试点用桩后端代替即我，因此以下证据仍缺，须补齐后才能评估全面迁移：

- [ ] 即我源码位置、可运行版本、功能/入口/依赖清单
- [ ] 数据字典（实体/字段/关系/索引/敏感等级/保留删除规则）
- [ ] 账户与权限模型（主体/租户/设备/登录态/刷新/注销/第三方绑定）
- [ ] 候选链路的真实基线（成功率、错误类型、p50/p95、峰值并发、恢复时间）
- [ ] 选定切片（读笔记+确认写标签）的字段级输入/输出、权限、错误契约与回滚步骤（本目录已先写出桩版）

## 7. 客户端插件脚手架（未接入宿主构建）

`client/` 是按 cookbook 写的 Host + browser 双包脚手架，目前**未**注册进 `pnpm-workspace.yaml` / `tsconfig.host.json` / `tsconfig.client.json`，因此不会进入宿主构建、不影响任何门禁。接入步骤：

1. 在 `pnpm-workspace.yaml` 加入 `examples/jiwo-pilot/client`。
2. 在 `tsconfig.host.json` / `tsconfig.client.json` 加入该包。
3. 在 cordis profile 增加一条 `@deepseek-ai/dsh-jiwo-pilot` 的 `insert`（与 `jiwo-pilot.cordis.yml` 的 MCP overlay 共存）。

脚手架内容：

- `client/src/events.ts` —— `jiwo/read`、`jiwo/tag_write` 事件契约（producer-owned，渲染重放节点用）。
- `client/src/cache/jiwo-cache.ts` —— **本地缓存** `storage-domain` 域（cache ONLY，非个人数据表）。
- `client/src/index.ts` —— Host 半：缓存生命周期 + 设置命名空间 `jiwo-pilot`。
- `client/src/client/index.ts` —— browser 半：设置卡 + 可重放对话节点（读 `jiwo/read`/`jiwo/tag_write` 渲染业务结果）。

> 接入时请以实际安装的 `@deepseek-ai/dsh-client-runtime/client` 类型为准，核对 `ConversationNodeDefinition` 的 reducer 方法名（`update`/`reduce`）。

## 8. 文件地图

```
examples/jiwo-pilot/
├── README.md                      # 本文件
├── jiwo-pilot.cordis.yml          # #673 overlay（dsh-mcp-client, failOnStartupError:true）
├── vitest.config.mjs              # #676 作用域隔离的 vitest 配置
├── server/
│   ├── jiwo-stub-server.mjs       # #675 无依赖 stdio MCP 桩后端（读 + 幂等确认写）
│   └── tests/
│       └── jiwo.contract.test.mjs # #676 契约 + 回滚测试（8 项）
└── client/                        # #677 客户端插件脚手架（未接入构建）
    ├── package.json
    └── src/
        ├── events.ts
        ├── cache/jiwo-cache.ts
        ├── index.ts                # Host 半
        └── client/index.ts         # browser 半
```

## 9. 替换真实即我后端

桩与真实后端的唯一差别在 `jiwo-stub-server.mjs` 的两个 handler：把内存/JSONL 读写换成对即我 API 的 HTTP 调用，保持相同工具契约即可。`jiwo_read_note` 仍只读、`jiwo_write_tag` 仍幂等且需 `confirmed`。overlay 的 `command`/`args` 指向真实即我 MCP server 后，其余不变。
