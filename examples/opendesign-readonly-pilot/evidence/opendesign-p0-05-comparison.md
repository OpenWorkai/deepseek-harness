# P0-05 OpenWork × DSH 同源只读对照证据

> 结论：**P0-05-PASS**。该结论只关闭真实旧路径对照阻塞，不等于 Phase 0 整体 GO。

## 固定输入

- OpenWork：`9e7748791f1088368d570c539b7cb88a8d17d945`
- OpenDesign：`0c7955de69f94680a27869df16ae54edc9a5cf96`（v0.11.1）
- DeepSeek Harness：`89b38861c2763168570d89234968c4a719148abd`
- 黄金对象：`agentic`
- 同源目录：调用方受控的同一个 `OD_DATA_DIR`
- 采样：每条路径 list 20 次、get 20 次、20 个并发 get、2 次预热；同机顺序运行
- 源码运行时：Node 22。OpenDesign 源码树的 native module ABI 与当前 Electron 不同，因此仅在受控采集时显式设置 `OPENWORK_OPENDESIGN_DAEMON_RUNTIME`；生产默认解析逻辑未改变。

机器可读 JSON 保存在本地 gitignored `evidence/p0-05-*.json`。下列命令可重复生成，不把临时路径当作长期证据：

```sh
node examples/opendesign-readonly-pilot/server/p0-05-collect.mjs \
  --openwork <openwork-repo> \
  --opendesign <open-design-repo> \
  --data-dir <controlled-od-data-dir> \
  --golden-id agentic \
  --node <node-22-runtime> \
  --reads 20 --concurrency 20 --warmup 2
```

## 结果

| 指标 | OpenWork renderer → IPC | DSH MCP 试点 |
|---|---:|---:|
| list 成功 | 20/20（100%） | 20/20（100%） |
| get 成功 | 20/20（100%） | 20/20（100%） |
| list p95 / p99 | 105.282 / 111.041 ms | 69.968 / 71.236 ms |
| get p95 / p99 | 80.544 / 122.325 ms | 67.121 / 68.464 ms |
| 20 并发成功 | 20/20（100%） | 20/20（100%） |
| 并发吞吐 | 19.944 ops/s | 21.550 ops/s |
| 重启到 ready | 2185.348 ms | 56.833 ms（适配器） |
| 重启到首读 | 2684.385 ms | 154.684 ms（适配器） |
| RSS 变化 | +306.813 MiB（完整 Electron 进程树） | +21.218 MiB（仅 MCP 适配器） |

两条路径的标准化 list/get 黄金对象逐字段完全一致，差异列表为空。list 均不含 `body`，get 均含 `body`；不存在对象均返回可归类的 `NOT_FOUND`，DSH 只发现两个只读工具。

DSH 路径退出后，又启动一次真实 OpenWork renderer → IPC 冒烟：list 1/1、get 1/1、并发 1/1、`NOT_FOUND` 分类与 daemon 重启后首读均成功，证明旧 IPC 路径没有被 DSH 试点替换或污染。

## 资源解释边界

两侧 RSS 采样范围不同，不能相减或合并成“迁移节省量”。OpenWork 数字包含 Electron 主进程、renderer、辅助进程和 OpenDesign daemon，且进程树在采样间可能完成懒加载；DSH 数字只含 MCP 适配器、不含上游 daemon。CPU 同样受启动与采样窗口影响，本轮只留原始证据，不建议据此冻结生产 CPU 阈值。

## 放行含义

P0-05 的 13 项比较检查全部通过，包括同源、字段一致、成功率、并发、错误分类、两侧恢复、精确只读工具集和 DSH 停止后的旧路径回退。

Phase 0 整体仍为 HOLD，直到：

1. P0-03/P0-04 owner 确认数据保留规则与“本机单用户 + loopback”权限边界；
2. P0-07 owner 批准模型字段白名单、日志禁入字段、遮蔽和浏览器持久化规则；
3. 业务、运维和安全 owner 冻结 `PHASE0.md` §7 的候选阈值。
