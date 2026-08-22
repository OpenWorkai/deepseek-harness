# Arkme Desktop 0.1.1 发布包来源与 Apple 签名证据（P0-01 A 级）

> 校验日期：2026-08-22。
> 范围：只证明**迁移后** Arkme/即我 DSH 桌面发布包的来源与静态完整性；不证明迁移前两年旧客户端源码、行为或性能，不解除 P0-05。

## 1. 来源链

1. 固定提交 `arkme-senx/arkme-dsh-plugin@8d62319c5d58236a1542ea09d0bbba53ae2f023f` 的 `cordis.patch.yml` 明确声明生产 `updateArtifactBaseUrl: https://d.jiwo.cc`。
2. 发布者 `wolfhts` 在 2026-08-21 的迁移发布公告中，把以下三个对象放在同一发布段落：
   - macOS：`https://d.jiwo.cc/app/arkme/prod/macos/Arkme-cn-universal.dmg`
   - Windows：`https://d.jiwo.cc/app/arkme/prod/windows/arkme-cn-0.1.1-x64.exe`
   - 插件源码：`https://github.com/arkme-senx/arkme-dsh-plugin`
3. `https://www.jiwo.cc/download` 官方下载页提供 macOS DMG 与 Windows EXE 下载动作；`d.jiwo.cc` 的 TLS 证书 SAN 覆盖 `*.jiwo.cc` 与 `jiwo.cc`。
4. `arkme.ai` / `www.arkme.ai` 在插件源码中只属于更新说明 URL 白名单；该白名单不是桌面安装包来源证明。真正的固定生产制品源是 `d.jiwo.cc`。

## 2. 下载对象

| 字段 | 值 |
|---|---|
| URL | `https://d.jiwo.cc/app/arkme/prod/macos/Arkme-cn-universal.dmg` |
| HTTP | `200 OK`，`Server: AliyunOSS` |
| Content-Length | `386033785` bytes |
| Last-Modified | `Fri, 21 Aug 2026 12:55:54 GMT` |
| ETag | `"7A9ECAF0CEA65E7C73C498F9218CCE83"` |
| SHA-256 | `c153bd0e9a2671b90b3acfb7fc76ff17192d7d5d023e70e3c8f8218d8b7b7fe4` |
| 本地受控副本 | `.artifacts/jiwo-phase0/Arkme-cn-universal.dmg`（根 `.gitignore` 已排除 `.artifacts/`，不提交二进制） |

`hdiutil verify` 结论：`checksum ... is VALID`；镜像格式为只读 zlib 压缩 UDIF，内部为 APFS。

## 3. 应用静态验真

镜像仅以 `-readonly -nobrowse -noautoopen` 挂载；未启动应用。完成检查后已卸载卷。

| 检查 | 结果 |
|---|---|
| `codesign --verify --deep --strict` | `valid on disk`；`satisfies its Designated Requirement` |
| 签名主体 | `Developer ID Application: Senqisi (Wuhan) Technology Co., Ltd. (T6NSNA8LDZ)` |
| Team ID | `T6NSNA8LDZ` |
| 签名时间戳 | `Aug 21, 2026 at 8:09:03 AM` |
| Hardened Runtime | 已启用（codesign flag `runtime`） |
| Gatekeeper | `accepted`；`source=Notarized Developer ID` |
| 公证票据 | `stapled`；`xcrun stapler validate` 成功 |
| Bundle ID | `com.senx.arkme.harness` |
| 版本 | `CFBundleShortVersionString=0.1.1`；`CFBundleVersion=0.1.1` |
| 最低 macOS | `12.0` |
| 架构 | Universal：`x86_64 arm64` |

## 4. 可支持与不可支持的结论

可支持：

- `d.jiwo.cc` 是固定插件生产配置与公开迁移发布公告共同指向的受信制品域名。
- 当前 DMG 是由与即我 App Store 开发主体一致的森奇思（武汉）科技有限公司 Developer ID 签名、经 Apple 公证的 Arkme 0.1.1 Universal 应用。
- 该发布物可作为迁移后新路径的安装、启动、工具发现与恢复验证对象。

不可支持：

- 不能把 Arkme 0.1.1 当作迁移前旧客户端；它的 bundle id 含 `.harness`，且发布公告明确其为 DSH 重构初版。
- 不能据此填入旧路径成功率、延迟、容量、CPU、内存或恢复阈值。
- P0-05 仍需要即我 owner 提供迁移前旧版安装包/版本号，或提供旧客户端源码及可复现启动方式；仅在取得旧版后才能做同机、同网、同数据集黑盒基线。
