# dsh-im 只读 Telegram 金丝雀

[English](README.md) | 中文

此示例用于证明 `@xmanrui/dsh-im` Telegram 通道经过真实 DSH Host Connection RPC 的链路，但不会启用 OpenWork IM 切换。它只调用 `connection.status`；不会绑定凭证、重连机器人、发送消息、删除状态或暴露远程监听地址。

## 固定依赖

已验证的软件包为 `@xmanrui/dsh-im@3.0.7`，对应上游提交 `f4ded46278441641524642f02bb75297f0f5966b`。请安装到隔离的 profile 和 DSH home，避免该证明修改操作者的日常 DSH 配置：

```sh
CANARY_DSH_HOME="$(mktemp -d)"
DSH_HOME="$CANARY_DSH_HOME" pnpm dsh plugin --profile web add -w @xmanrui/dsh-im@3.0.7
```

## 启动真实 Host

将 Web Host 绑定到规范 IPv4 loopback 地址。探针会刻意拒绝 HTTPS、`localhost`、IPv6 loopback、局域网地址、URL 凭证、路径、查询和片段，从而让已评审的 transport 目标只有一种表示：

```sh
DSH_HOME="$CANARY_DSH_HOME" pnpm dsh web --host 127.0.0.1 --port 39173 --no-open
```

## 探测单机器人门

在另一个 shell 中运行只读状态探针：

```sh
node examples/dsh-im-readonly-canary/run-status-canary.mjs http://127.0.0.1:39173
```

只有当真实 Host 报告恰好一个已配置且已连接的 Telegram 机器人、遮蔽后的身份、`private-allowlist` 访问方式以及至少一个纯数字 Telegram 允许用户时，命令才会成功。输出仅包含无凭证摘要。零机器人、多个机器人、机器人断开、兼容模式机器人、开放访问策略、RPC 格式错误、响应不匹配、重定向或非 loopback 目标都会失败关闭。

## 非生产凭证边界

配置机器人是 dsh-im 中独立的 owner 操作。必须使用专用非生产 Telegram 机器人，不得让它同时活跃于任何现有桥；只批准预定金丝雀用户；不得把 token 粘贴到本示例、命令行、日志、源码控制或证据中。探针只接收 Host URL，且从不读取 token。

通过此门只证明状态可达性和单机器人策略，不授权消息收发、生产使用、远程访问、多机器人路由、凭证迁移或替换现有 IM 桥。
