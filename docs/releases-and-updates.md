# 发布与更新维护

## 更新源

- 源码发布分支：`userSywang/lolPing` 的 `main`。
- 软件检查该仓库的正式 GitHub Release，不直接安装分支上的源码提交，不接受预发布版或降级。
- Windows 显式使用 GitHub provider；安装包的 `app-update.yml` 同样指向本项目。macOS 查询同一仓库的最新正式 Release。
- 版本号采用 `X.Y.Z`，标签采用 `vX.Y.Z`。项目地址、问题反馈、下载和更新说明链接都指向此仓库。
- 自动检查遵循现有开关：开启后启动约 10 秒检查一次，之后每 6 小时检查。下载和安装都需用户点击。
- 旧的 0.5.2/0.5.3/0.5.4 定制包曾关闭更新检查，需手动安装 v0.5.5 一次，之后继续沿用此更新源。

## 每次发版

1. 在短期开发分支修改、检查和审阅，将通过检查的代码合入 `main`。
2. 同步修改 `package.json` 和 `package-lock.json` 的正式版本号。
3. 在 `CHANGELOG.md` 增加 `## [X.Y.Z] - 日期`，说明功能、修复、升级注意事项和实际限制。旧版本记录继续保留。
4. 运行类型检查、测试、应用构建和网站构建；涉及输入辅助程序时构建并运行原生测试。先实际验证安装包。
5. 给 main 上对应提交打 `vX.Y.Z` 标签并推送。发布流程拒绝不在 main 历史上的提交、版本不一致及缺少更新说明的标签。
6. Release 工作流创建草稿，分别构建和验证 Windows/macOS，上传 `.exe`、`.blockmap`、`latest.yml` 和 arm64 `.dmg`。全部成功后公开正式 Release。
7. 公开后确认最新版本、说明、资产及 `latest.yml` 的版本、文件大小和 SHA-512 一致，再验证软件内手动检查。

命令示例（版本号替换为实际要发布的版本）：

```sh
git switch main
git pull --ff-only
npm ci
npm run typecheck
npm test -- --maxWorkers=1 --testTimeout=15000
npm run dist
git tag -a v0.5.6 -m "lolPing v0.5.6"
git push origin main v0.5.6
```

每次更新说明由 `tools/release-notes.mjs` 从 CHANGELOG 中准确提取；缺少、空白或非正式版本的说明会阻止发布。不要只上传 exe：缺少 `latest.yml` 时，软件无法完成更新检查。

## 失败与回退

任一构建失败时，Release 保持草稿，已安装客户端不会看到半成品。修复后重跑失败任务；已公开的版本不改标签或覆写安装包，发布更高的修复版本。若必须撤回故障版本，先停止其公开可见性并发布更高版本，不让自动更新降级。

本地快速构建可复用经过验证的同版本 Electron 和输入辅助程序；正式 CI 从源码构建辅助程序，独立验证两个平台。macOS 仍为实验性支持，实际使用问题请在本项目反馈。
