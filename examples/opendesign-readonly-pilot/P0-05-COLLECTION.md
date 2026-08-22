# P0-05 OpenWork × DSH 同源只读基线采集方案

## 目标

P0-05 在同一台机器、同一个 `OD_DATA_DIR` 和同一个黄金对象上，顺序采集以下两条真实路径：

1. OpenWork renderer → IPC → `OpenDesignDaemonClient` → OpenDesign。
2. DSH MCP overlay → OpenDesign 只读适配器 → OpenDesign。

采集结果用于判断两条路径的标准化字段是否完全一致，并为成功率、延迟、并发、资源增量和恢复时间提供冻结阈值的输入。采集器不得把空数组、`null` 或未抛异常当作成功；每次 list/get 都必须命中黄金对象并满足字段约定。

## 非目标

- 不放行写工具，不调用 `POST /api/design-systems`。
- 不复制、迁移或清空 `OD_DATA_DIR`。
- 不把一次开发机采样直接视为生产容量结论。
- 不替代 P0-07 的隐私字段白名单和日志规则审批。

## 输入约定

- OpenWork、OpenDesign 和 DSH 使用已记录的固定 commit。
- `OD_DATA_DIR` 指向调用方准备的受控目录；脚本只读其中的数据。
- `OPENDESIGN_GOLDEN_ID` 指向 list 中必然存在、get 可读取的对象。
- OpenWork 通过 `OPENWORK_OPENDESIGN_DAEMON_BIN` 使用同一 OpenDesign daemon 构建。
- 源码工作树采集通过 `OPENWORK_OPENDESIGN_DAEMON_RUNTIME` 显式固定与该构建 ABI 兼容的 Node；生产默认运行时不被改写。
- 两条路径不得同时启动指向该目录的 daemon；OpenWork 采集完全退出后才能启动 DSH 侧 daemon。

## 机器可读报告

采集命令在 pilot 的 `evidence/` 目录写入三个 gitignored JSON：

- `p0-05-openwork.json`：旧路径成功率、延迟、并发、进程树资源样本、daemon 重启和黄金字段快照。
- `p0-05-dsh.json`：试点路径对应指标、适配器资源样本和黄金字段快照。
- `p0-05-comparison.json`：固定版本、输入目录、字段差异、阈值输入和只读 GO 资格判断。

报告必须保留不一致结果。采集成功不等于 GO；`goEligible:false` 是有效证据，不得通过删字段或把缺失值归一为空字符串来制造一致。

## 验收约定

- 两条路径的 list/get 成功率均为 100%。
- list 黄金对象不含 `body`；get 黄金对象可含 `body`。
- 标准化字段逐字段一致率为 100%，缺失字段与空字符串不同。
- 并发调用全部命中同一黄金对象。
- OpenWork 停止并重启 OpenDesign daemon 后，首个 get 再次成功。
- DSH 适配器重启和 OpenDesign daemon 重启分别可恢复。
- 报告中不存在写工具调用或业务数据副本。

P0-05 通过后仍维持 HOLD，直到 P0-07 获 owner 批准且 `PHASE0.md` §7 的全部 `PENDING` 数值由 owner 冻结。
