# P0-08 OpenDesign × DSH 只读端到端证据

## 范围与固定版本

- 日期：2026-08-22
- OpenDesign：`0c7955de`，daemon 报告 `0.11.1`
- DeepSeek Harness：基于 `4b8c69d` 的 P0-08 工作树
- 上游：真实本机 OpenDesign daemon，loopback HTTP，隔离临时 `OD_DATA_DIR`
- 适配器：`server/opendesign-readonly-server.mjs`
- 黄金对象：内置 design system `agentic`

本记录只证明 DSH → MCP 适配器 → 真实 OpenDesign HTTP API 的只读路径，不代表 OpenWork 原生 IPC 基线。

## 自动契约与 DSH 桥接

命令：

```sh
pnpm exec vitest run --config examples/jiwo-pilot/vitest.config.mjs
```

结果：1 个文件、14 项测试全部通过。覆盖：

- 真实 `dsh-mcp-client` 只发现并执行 list/get 两个工具
- list 不含 `body`；get 可含 `body`
- `provenance`、`projectId`、未知字段均未跨过适配器白名单
- create / 未知工具返回 `UNKNOWN_TOOL`
- 401、403、404、429、超时、上游不可用、schema 不兼容均返回可分类 `isError`
- overlay 使用 stdio、`serverName:opendesign`、`failOnStartupError:true`

客户端脚手架也完成了独立 Host / browser 类型检查：

```sh
pnpm exec tsc -b examples/jiwo-pilot/client/tsconfig.json
```

该检查验证当前 package API 的类型兼容性，不代表已接入生产 Host / web 构建或完成 UI 组合验证。

## 真实 OpenDesign daemon 采样

受控运行参数：20 次 list、20 次 get、20 个并发 get、2 次预热。结果：

| 指标 | 结果 |
|---|---:|
| list 成功率 | 20/20，100% |
| get 成功率 | 20/20，100% |
| 20 并发 get | 20/20，100% |
| list p95 | 85.935 ms |
| get p95 | 78.542 ms |
| 并发吞吐 | 20.61 ops/s |
| 适配器重启至 ready | 58.800 ms |
| 适配器重启至首读成功 | 148.827 ms |

采样中的缺 id、对象不存在、写工具调用均按预期分类。停止并重新启动真实 OpenDesign daemon 后，使用同一隔离数据目录再次运行 2 次 list、2 次 get 和 2 并发 get，全部成功；适配器重启后首读也成功。

## 环境异常与处理

默认 shell 的 Node 25 无法加载当前 OpenDesign 工作树中按 `NODE_MODULE_VERSION 127` 编译的 `better-sqlite3`。未修改依赖或源码，改用本机现有 Node 22.22.2 启动该固定工作树后验证通过。该 ABI 状态属于可运行环境证据，不得解读为 OpenDesign 正式 Node 版本支持声明；OpenDesign `package.json` 当前声明 `node: ~24`，正式基线需在锁定的支持环境重新采集。

## 结论与未覆盖项

P0-08 服务端 / DSH 桥接可判为**已完成**：真实 API、精确只读工具集、错误可见性、适配器恢复和 daemon 重启后的再次读取都有证据。

以下仍未覆盖，不能据此判定只读 GO：

- OpenWork renderer → IPC → `OpenDesignDaemonClient` 的旧路径性能与字段对照
- OpenWork UI 中移除 overlay 后的人工回退时间
- CPU / RSS、峰值容量和长时间稳定性
- owner 批准的最终隐私字段白名单
- 支持 Node 运行时下的正式可重复性能基线
