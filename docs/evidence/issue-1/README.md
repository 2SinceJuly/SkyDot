# Issue #1 聊天输入区验证证据

关联任务：<https://github.com/2SinceJuly/SkyDot/issues/1>。

2026-11-16，在 macOS 系统 Chrome 中打开隔离的
`/tests/e2e/mobile-chat-harness.html`，渲染真实 `ChatView`、
`ConversationDock` 和 `MessageInput`，使用测试工作区和模拟 API。
未连接真实模型或投递聊天消息。

改前基准为 `b0bd808c26d410eadf3c78f2c5c318dc2962356f`。
运行时聚焦 textarea 的 computed outline 为 `solid 2px`，同时外层
`focus-within` 提供边框与光环，复现了双框。新增焦点回归检查在改前的
桌面/移动、明暗四种组合均因 `outline-style: solid` 失败。
改后 textarea 为 `outline-style: none`，整体面板保留 accent 焦点，
工具栏按钮仍有独立的键盘焦点。

| 场景 | 改前 | 改后 |
| --- | --- | --- |
| 桌面 1440×900 默认 | [截图](before-desktop.png) | [截图](after-desktop.png) |
| 桌面 1440×900 聚焦 | [截图](before-focus.png) | [截图](after-focus.png) |
| 桌面 1440×900 深色聚焦 | [截图](before-dark.png) | [截图](after-dark.png) |
| 移动 390×844 浅色聚焦 | [截图](before-mobile.png) | [截图](after-mobile.png) |
| 移动 390×844 深色聚焦 | [截图](before-mobile-dark.png) | [截图](after-mobile-dark.png) |

## 自动验证

`web/tests/e2e/composer.spec.ts` 覆盖：

- 桌面/移动、浅色/深色的局部焦点规则、按钮焦点、空输入禁用状态。
- 30 行文本的 144px 高度上限、内部滚动、输入与工具栏不重叠。
- 页面无横向溢出、主操作 44px 触控目标，面板距视口底部不超过 16px。
- 草稿写入现有会话 store、模拟中文输入法候选确认不发送、Shift+Enter 换行。
- 图片选择、粘贴、拖拽、移除；发送失败保留输入和图片。
- 发送成功清空输入、运行中显示停止按钮并调用停止 API。

本地运行：

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm --prefix web run test:e2e -- composer.spec.ts mobile-chat.spec.ts --workers=1
```

已有移动端回归测试最初因 `MainComputerApprovals` 的 `computer-main`
请求未被 fixture 拦截，收到真实后端 401 并跳到登录页。本次为该请求补充
`sessionId: null` 的隔离响应，随后 16 项浏览器检查全部通过。
没有修改或放宽既有断言。

## 验证边界

浏览器使用模拟 API，不能证明真实模型、文件服务或停止执行链路可用。
草稿测试验证当前会话 store，不表示草稿跨刷新持久化。
中文输入法采用 composition 事件模拟；没有用物理手机软键盘或原生输入法手动确认。
后续消息队列业务逻辑保持原状，本轮未逐项重测队列编辑、重排和投递。
没有验证 Electron 专属行为。尚未独立验收。
