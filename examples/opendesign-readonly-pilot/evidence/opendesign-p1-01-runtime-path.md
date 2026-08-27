# P1-01 真实 DSH 调用路径证据

> 采集日期：2026-08-22。范围仅为本机单用户、loopback、非生产只读试点；不批准 UI、生产 Host/web、远程访问或写工具。

## 结论

P1-01 通过。真实调用链为：

`OpenWork main-process owner → DSH JSON-RPC demo loader → pilot gateway → dsh-tools ToolRuntime → dsh-mcp-client → OpenDesign readonly MCP adapter → loopback OpenDesign`

OpenWork 没有直接启动 MCP adapter。DSH gateway 通过 `ctx.tools.execute` 调用 DSH 注册表中的 `mcp__opendesign__*` 工具；OpenDesign 仍是唯一事实源。

## 固定产物

| 产物 | SHA-256 |
|---|---|
| `packages/examples/jsonrpc-demo/lib/bin.js` | `569c08372f3fb9770a044f5bb616dbcc0bf4d2bb46bdb70997cc78ebc70d9320` |
| `examples/opendesign-readonly-pilot/opendesign-readonly-runtime.cordis.yml` | `140e2438aa7a1c226aae7dc38c123fc42525d080b794910fa070189582122fdc` |
| `pnpm-lock.yaml` | `ada74f7f38897593d282c821f921a77cdb3e0b22a2fbdc3ef81dc3809b80b33e` |
| `examples/opendesign-readonly-pilot/server/opendesign-readonly-server.mjs` | `5b6ef437b6565828ea2deb9ac35f8ee9bbc403833d2e59a3683e4ba6ef57936b` |
| `examples/opendesign-readonly-pilot/server/opendesign-readonly-gateway.mjs` | `73aaa8832802eff3b0a7168af6125d723aea2abe2a1e3e7904cb345f960b573c` |

OpenWork 在启动前逐项计算并比较上述摘要。缺失或不匹配时返回 `ARTIFACT_MISMATCH`，且不 spawn 子进程。overlay 设置 `failOnStartupError: true`，只装载 system-prompt、tools、mcp-client 与本地 gateway；不装载模型、agent、console logger 或 Web host。

## 工具与网络边界

- 协议身份固定为 `opendesign-readonly/1`，server 固定为 `dsh-opendesign-readonly-pilot@1`；不匹配即拒绝。
- 启动后目录必须恰好为 `opendesign_list_design_systems` 与 `opendesign_get_design_system`；缺失、额外或出现写工具均拒绝。
- OpenDesign URL 只接受无凭证的 `http://127.0.0.1`、`http://localhost` 或 `http://[::1]`。
- list 结果不含 `body`；get 可含批准的 `body`；测试私有字段不跨越 adapter 白名单。
- gateway stderr 不记录 OpenDesign 正文或上游私有字段，协议错误只返回固定通用说明。

## 生命周期证明

OpenWork 的 `OpenDesignDshPilotClient` 位于 main-process 目录并独占子进程句柄。它覆盖：并发启动合并、调用取消转发、运行时异常退出时拒绝所有进行中请求、协议 shutdown、超时后 `SIGTERM`、最后 `SIGKILL`。renderer 没有进程句柄、绝对路径或 OpenDesign 凭证。

该 owner 尚未接入生产 UI 或生产开关；P1-02 才会把它注入双路径只读服务。原生 OpenWork IPC 未修改。

## 验证

- DSH 聚焦契约：20/20 通过，其中真实 runtime 用例完成 initialize、精确目录、list、get、写工具拒绝与 stderr 禁止字段扫描。
- OpenWork owner 单元测试：8/8 通过，覆盖固定产物、loopback、目录、并发启动、启动/停止竞态、取消、退出与关闭。
- 跨仓库真实进程冒烟：`{"ok":true,"running":true,"listHasBody":false,"detailHasBody":true,"privateFieldCrossed":false}`。

完整 Phase 1 尚未完成：P1-00 的失败分类/日志遮蔽、P1-02 服务、P1-03 typed IPC、P1-04 UI 和 P1-05 同源验收仍保持未勾选。
