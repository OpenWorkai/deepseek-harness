# Agent Note：OpenDesign 只读基线证据

Status: implemented

[English](2026-08-22-opendesign-readonly-baseline-evidence.md) | 中文

## 问题

OpenDesign 只读试点已经具备 DSH 侧约定测试和真实 daemon 证据，但没有可重复的真实 OpenWork renderer 到 IPC 路径对照。单独的 DSH 采样器不能证明旧路径等价。OpenWork 还会把不存在对象折叠为 `null` 并遗漏多个 OpenDesign 字段，因此把调用正常返回直接计为成功会产生假基线。

## 决策

历史 `jiwo-pilot` 示例已命名为 `opendesign-readonly-pilot`。它的 P0-05 采集器针对调用方拥有的同一个 `OD_DATA_DIR`，顺序运行三个受控阶段：OpenWork renderer 到 IPC、DSH 适配器、DSH 路径停止后的 OpenWork 回退冒烟。独立报告保留黄金对象不变量、标准化 list/get 快照、延迟、并发、资源范围、错误分类与重启恢复。只有全部必需检查通过且字段差异为空时，对照才会通过。

OpenWork 接受显式 `OD_DATA_DIR`，而显式构造参数仍具有更高优先级。源码证据采集也可选择 ABI 兼容的 Node 运行时，不改变打包运行时选择。OpenWork 客户端保留与 DSH 适配器相同的白名单字段；list 剔除 `body`，get 包含 `body`，并把 404 作为 `NOT_FOUND` 保留到 renderer IPC。

机器可读 JSON 继续被 gitignore，因为路径、端口、时序与进程样本会随运行变化。受控 Markdown 证据记录固定 commit、命令形状、结果、指标范围和放行含义。

## 曾考虑的替代方案

**使用 OpenWork 默认应用数据目录，之后再让 DSH 指向该目录。** 拒绝，因为该位置随平台和运行模式变化，不受调用方控制，也难以安全复现同源结论。

**从 Node 基准脚本直接调用 `OpenDesignDaemonClient`。** 拒绝，因为这会绕过 P0-05 要测量的 renderer 和 IPC 边界。

**把 `[]`、`null` 或未抛异常的调用视为成功。** 拒绝，因为这些值曾是上游不可用、响应无效和对象不存在时的防御性回退。

**根据进程独立性推断回退。** 拒绝，因为只做旧路径到 DSH 的单向对照，会让文档中的回退条件未被测量。因此采集器会在 DSH 退出后重新打开原生 IPC 路径。

**让两个 daemon 进程同时读取一个目录。** 拒绝，因为即使本试点只读，并发写入方或文件监视器仍会让对照不安全且受时序影响。

## 验证

固定对照使用 OpenWork `9e774879`、OpenDesign `0c7955de` 与 DeepSeek Harness `89b38861`。两条路径均完成 20/20 list、20/20 get 和 20/20 并发读取。标准化 list/get 差异为空，错误保持可分类，两侧恢复检查通过，DSH 停止后的 OpenWork 回退冒烟成功。13 项比较检查全部通过，结果为 `P0-05-PASS`。

16 项试点 Vitest 契约与两个客户端 TypeScript 项目通过。OpenWork 的 7 项聚焦单元测试、打包构建、范围 lint 与格式检查通过。它的全量测试存在与本次无关的既有失败，全量类型检查存在与本次无关的 Workshop/Cline 错误；这些被记录为验证边界，不归因于 P0-05。

## 后果

P0-05 不再阻塞只读 GO。固定证据也能防止后续采集器弱化缺失字段语义，或在没有 DSH 停止后原生读取证据时宣称可回退。

该结果不等于 Phase 0 整体 GO。P0-03/P0-04 owner 边界、P0-07 隐私审批与 owner 冻结的 Phase 1 阈值仍是独立门槛。OpenWork 完整进程树 RSS 与 DSH adapter-only RSS 的范围不同，不能相减或合并成迁移开销结论。一次单机采样可用于提出候选阈值，但不能建立生产容量承诺。
