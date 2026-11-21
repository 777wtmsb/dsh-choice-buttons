# dsh-choice-buttons

把助手回答末尾的 `A. …` / `1. …` 选项列表，渲染成一行可点击的字母胶囊：点一下就把那一行选项原文当成你的消息发出去。

纯客户端插件，不调用模型、不联网、不写磁盘，只在页面上多渲染一行按钮。

## 行为

- 只在**含选项的那一轮回答**末尾出现，位置在该条回答下方。
- 识别最后一段「连续递增」的选项行，序列可以从 `A` 或 `1` 开始，至少 2 条：
  - 字母：`A.` `B.` `C.`（到 `H`）
  - 数字：`1.` `2.` `3.`（到 99）
  - 允许 Markdown 列表前缀（`- `）与加粗（`**A.**`），分隔符支持 `.`、`、`、`．`、`)`、`）`
- 按钮上只显示字母/数字；完整选项文字放在 `title` 里，鼠标悬停可见。
- 点击后：把 `字母. 选项原文` 写进输入框并提交，等同于你手动输入那一行再回车；这组按钮随即消失。
- 选项少于 2 条、或序列不从 `A` / `1` 开始（比如只有 `C.`）时不渲染，避免把普通正文误当选项。

## 安装

从 GitHub 直接安装（无需 npm）：

```
plugin_manager install_bundle  github:777wtmsb/dsh-choice-buttons
```

等价的手工方式：在 profile 目录执行 `pnpm add github:777wtmsb/dsh-choice-buttons`，并在 profile 的 `package.json` 里把 `dsh-choice-buttons` 加进 `dsh.profile.bundles`。

> npm 包暂未发布：npm 现在要求首次发布必须走 staged publishing 且批准环节强制 2FA，而新账号只支持硬件 FIDO2 安全密钥（TOTP 已停止开通）。等有硬件钥匙后才会补发 `npm i dsh-choice-buttons` 这条路。

安装后**重启 DSH**（宿主半边需要加载一次）；之后只改 `client.js` 的话，页面 `Ctrl+R` 即可生效。

## 卸载

移除插件包，并从 profile 的 `dsh.profile.bundles` 里删掉 `dsh-choice-buttons` 这一项，然后重启 DSH。

## 兼容性

- 渲染位置是会话里的「回答尾部」插槽（`conversation.chat.turnTail`），依赖 DSH Web UI 的会话快照结构；DSH 大版本升级后如果按钮不出现，先检查这里。
- 按钮只显示字母/数字，没有可见文案；无障碍标签 `aria-label` 目前是中文硬编码，未接 Client locale 服务（试过 `ctx.locale.register` + `locale: NS`，会触发 React `#311` 错误，已回退）。
- 只在 Web UI（含桌面端与手机端 Web）可用；纯终端界面不渲染客户端插件。

## 开发

```bash
# 语法检查
node --check client.js

# 打包预览
pnpm pack --dry-run
```

`client.js` 是纯 ESM 客户端模块（`window.__ModuleLoader__.load({...})`），无构建步骤。

## License

MIT
