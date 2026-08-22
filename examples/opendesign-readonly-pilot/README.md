# OpenWork → OpenDesign × DSH 只读试点

> Phase 0 决策：**HOLD**。P0-08 的服务端与 DSH 桥接已完成；P0-05 真实 OpenWork 旧路径基线、P0-07 owner 批准的隐私白名单及数值阈值仍未完成。
>
> 当前证据对象和运行契约均为 OpenWork → OpenDesign design-systems。Jiwo / Arkme 只保留为迁移方向旁证。

本试点通过 `dsh-mcp-client` 把本机 OpenDesign HTTP API 暴露为两个只读 MCP 工具。OpenDesign 和它的 `OD_DATA_DIR` 仍是唯一事实源；适配器不保存业务数据、不复制数据库、不暴露写工具。

## 已批准的契约

| 工具 | 输入 | 输出 | 边界 |
|---|---|---|---|
| `opendesign_list_design_systems` | 无 | 设计系统摘要数组 | 强制剔除 `body`、`provenance`、`projectId` 和未知字段 |
| `opendesign_get_design_system` | `id: string` | 单个设计系统，可含 `body` | 剔除 `provenance`、`projectId` 和未知字段 |

两个工具均标记为 `readOnlyHint:true`、`destructiveHint:false`。当前最小字段白名单为：

- list/get：`id`、`title`、`summary`、`category`、`swatches`、`surface`、`source`、`status`、`isEditable`、`createdAt`、`updatedAt`
- get 额外允许：`body`

该白名单是 P0-08 的最小实现，不代表 P0-07 已批准。隐私 / 安全 owner 未签字前，不得扩大字段。

适配器会显式分类 `INVALID_INPUT`、`UNAUTHORIZED`、`FORBIDDEN`、`NOT_FOUND`、`RATE_LIMITED`、`UPSTREAM_ERROR`、`UPSTREAM_TIMEOUT`、`UPSTREAM_UNAVAILABLE` 和 `SCHEMA_INCOMPATIBLE`。失败通过 MCP `isError:true` 返回，不允许静默退化为空工具集。

## 运行真实只读路径

先启动固定版本的 OpenDesign daemon：

```sh
cd <open-design-repo>
OD_DATA_DIR=<controlled-data-dir> \
  node apps/daemon/dist/cli.js --host 127.0.0.1 --port 7456 --no-open
```

再从 DeepSeek Harness 仓库根目录启动 DSH：

```sh
OPENDESIGN_BASE_URL=http://127.0.0.1:7456 \
  pnpm dsh web --patch "$PWD/examples/opendesign-readonly-pilot/opendesign-readonly-pilot.cordis.yml"
```

模型侧只能发现：

- `mcp__opendesign__opendesign_list_design_systems`
- `mcp__opendesign__opendesign_get_design_system`

`OPENDESIGN_BASE_URL` 只接受 loopback `http:` 地址。`failOnStartupError:true` 保证适配器启动或同步失败时 DSH 明确失败，而不是“启动成功但没有工具”。

## 验证

契约与真实 DSH 桥接测试：

```sh
pnpm exec vitest run --config examples/opendesign-readonly-pilot/vitest.config.mjs
```

当前覆盖：精确工具清单、list/get 字段白名单、写工具不可用、七类上游故障、真实 `dsh-mcp-client` 发现与执行、overlay 配置。

对已运行的真实 OpenDesign daemon 采集 DSH 路径样本：

```sh
OPENDESIGN_BASE_URL=http://127.0.0.1:7456 \
  node examples/opendesign-readonly-pilot/server/baseline-harness.mjs \
  --lists 100 --gets 200 --concurrency 50 --warmup 5 --json
```

采集器还会验证适配器重启后的首读。它**不测** OpenWork renderer / IPC、CPU / RSS 或完整旧路径，因此输出只能作为 P0-08 的 DSH 集成证据，不能冻结 P0-05 性能阈值。受控实测记录见 [`evidence/opendesign-dsh-readonly-e2e.md`](evidence/opendesign-dsh-readonly-e2e.md)。

## 回滚

1. 停止带 overlay 的 DSH，或从启动命令移除 `opendesign-readonly-pilot.cordis.yml`。
2. OpenWork 原生 IPC 路径继续读取同一个 OpenDesign daemon / `OD_DATA_DIR`。
3. 本试点没有 schema 变更、业务数据副本或写入，因此无需反向数据迁移。

这证明的是 overlay 的可撤销性。OpenWork 原生 UI 的人工回退演练仍属于 P0-05 / 放行验收。

## 客户端脚手架

`client/` 是尚未接入宿主构建的 Host + browser 草案：

- `src/events.ts`：`opendesign/list`、`opendesign/get` 回放事件
- `src/cache/opendesign-cache.ts`：可丢弃的本地回放缓存，非事实源
- `src/index.ts`：Host 缓存生命周期和 `opendesign-pilot` 设置命名空间
- `src/client/index.ts`：只读设置卡与 `opendesign-result` 回放节点
- `tsconfig.host.json` / `tsconfig.client.json`：分别校验 Host 与 browser 入口
- `tsconfig.json`：组合上述两个独立类型检查；不会把该包接入宿主构建

它没有 write 事件或写入 UI。该目录已作为依赖解析与独立类型检查的 workspace 成员，Host / browser 类型均受检；仍未加入生产 Host / web 构建与 Cordis 组合，实际事件生产、UI 回放和升级兼容仍需集成验证。

```sh
pnpm exec tsc -b examples/opendesign-readonly-pilot/client/tsconfig.json
```

## 文件地图

```text
examples/opendesign-readonly-pilot/
├── PHASE0.md
├── README.md
├── opendesign-readonly-pilot.cordis.yml
├── vitest.config.mjs
├── evidence/
│   └── opendesign-dsh-readonly-e2e.md
├── server/
│   ├── opendesign-readonly-server.mjs
│   ├── baseline-harness.mjs
│   └── tests/opendesign.contract.test.mjs
└── client/
    ├── package.json
    ├── tsconfig.host.json
    ├── tsconfig.client.json
    ├── tsconfig.json
    └── src/
        ├── events.ts
        ├── cache/opendesign-cache.ts
        ├── index.ts
        └── client/index.ts
```

## 仍阻塞只读 GO

- P0-01：补正式仓库 URL、启动责任人和 owner 签字
- P0-03 / P0-04：数据保留 / 删除与本机权限边界确认
- P0-05：真实 OpenWork 原生 IPC 与 DSH 试点路径的同条件对照基线
- P0-07：字段白名单、日志禁入字段和遮蔽规则获 owner 批准
- §7：按真实旧路径结果冻结成功率、延迟、并发、资源和恢复阈值

写入 `opendesign_create_design_system` 不属于本次 GO。没有可信批准、请求幂等、审计与补偿证据前，不得添加。
