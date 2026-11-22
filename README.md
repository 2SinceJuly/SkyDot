# SkyDot

<img align="right" src="assets/skydot-icon.svg" width="70" alt="SkyDot 标志" />

**面向个人与小团队的自托管 Personal Agent**

长期承接用户委托并持续办事，而不只是改代码。

[在线体验 · skydot.eu.cc](https://skydot.eu.cc/)　·　[自己部署](#自己部署)

https://github.com/user-attachments/assets/eb7f2240-451d-4ad1-a717-c2e28cea7e8e

在 SkyDot 里，你把工作交给一个有名字、有职责的 AI 助手，叫作 **Dot**。它可以沿用工作区里的文件和偏好，按约定的时间继续做事。需要几个人分工时，你也可以把多个 Dot 拉进同一个群，在一条时间线上看分工、进度和交付物。

[![SkyDot 桌面工作台，点击打开在线演示](docs/screenshots/desktop-light-chat.png)](https://skydot.eu.cc/)

## 先看一次发布评审

打开[在线演示](https://skydot.eu.cc/)，进入「SkyDot v1.2 发布冲刺群」。群里的委托很具体：周五下午四点前，准备好这次发布的评审报告。

1. **小点排议程。** 它先把任务分给知微和筑码，也把「周五四点以后不排评审」留进了时间表。
2. **两个 Dot 分头核查。** 知微看架构、记忆与权限，筑码看构建、测试和桌面端安全。两份结论都回到原来的群里，可以顺着消息查看依据。
3. **你确认交付。** 小点把两份结论和仍待解决的问题写成《发布就绪评估报告》。你可以先看报告，再决定是否批准写入工作区。

在线站使用预置数据，可以直接体验这些交互。要让 Dot 处理自己的文件、调用模型或按时执行任务，可以在自己的机器上部署。

## 自己用时，可以交给它什么

| 你的委托 | 在 SkyDot 里怎么做 |
| --- | --- |
| “每周五把本周的项目记录整理成周报。” | 把资料放进工作区，创建每周执行的定时任务。在运行历史里看每次的结果，需要时可以暂停或立即运行。 |
| “下次写这份报告，还是沿用这个格式。” | 把格式偏好保存在工作区记忆里。同一工作区的新会话可以复用它，你可以查看来源、修订或忘记这条记忆。 |
| “请负责架构和测试的两个助手各给一份意见。” | 为 Dot 配置职责、模型和工具，在群聊中点名。管理员可为委派设置执行权限和调用预算。 |

单个 Dot 对话和普通定时任务可以独立使用。自托管时，原生群聊需开启 `SKYDOT_BOT_GROUPS=true`，允许 Dot 互相委派还需开启 `SKYDOT_BOT_HANDOFFS=true`。个人 Goal 有独立的实验开关，详见[目标与定时任务](docs/personal-agent/goals-and-tasks.md)。

## 自己部署

准备 **Node.js 22.19 或更高版本**和 npm。第一次可以直接使用本机 Runner，选择容器隔离时再安装 Docker。

```bash
git clone https://github.com/2SinceJuly/SkyDot.git
cd SkyDot
npm install
npm --prefix web install
npm --prefix container/agent-runner install
npm run build:all
npm start
```

打开 <http://127.0.0.1:3000>，创建第一个管理员。要开始真实对话，在引导或设置中配置模型 Provider，然后打开 SkyDot 发出第一条委托。也可以先跳过配置，浏览本机工作台。

<details>
<summary>开发、桌面端与运维命令</summary>

- **本地开发**用 `npm run dev:all` 同时启动 Backend 和 Web，开发页面在 <http://127.0.0.1:5173>。
- **Electron 桌面端**可连接已启动的 Backend，再运行 `npm run desktop:dev`。连接远程服务时设置 `SKYDOT_SERVER_URL`。
- **容器执行**的默认镜像是 `2sincejuly/skydot-agent:latest`。要从当前源码构建，运行 `docker build --pull -t 2sincejuly/skydot-agent:latest container`。
- **数据与备份**：数据库、会话、工作区与敏感配置默认保存在 `data/`。用 `make backup` 创建备份，用 `make restore FILE=...` 从备份恢复。
- **模型协议**接入兼容 OpenAI Completions 的接口时，在 Provider 的自定义环境变量里设置 `SKYDOT_MODEL_API=openai-completions`。
- **本机免登录演示**仅适用于回环地址。运行条件与配置见[本地 Demo 说明](DEMO.md)。

</details>

## 系统架构

[![SkyDot 五层架构，展示接入、主服务、执行、能力与协作、存储与观测](assets/skydot-system.svg)](assets/skydot-system.svg)

一条消息从 Web、桌面端或 IM 进入 Node.js 主服务。主服务验证身份，找到对应的工作区和会话，再由队列把任务交给 Host 或 Docker Runner。Pi Agent 只获得这个 Dot 已启用的能力，执行进度和结果沿会话回到工作台。

**会话**保存各自的对话上下文，**工作区**决定哪些文件和长期记忆可以复用。加入同一个群聊，也不会自动获得其他成员的私人工作区权限。图中的 Cloudflare Workers 与 Durable Objects 属于默认关闭的实验路径。[架构详解](docs/personal-agent/architecture.md) · [权限矩阵](docs/ACL-MATRIX.md) · [云端运行验收](docs/personal-agent/cloudflare-real-acceptance.md)

## 文档与贡献

| 想了解什么 | 从这里开始 |
| --- | --- |
| 定时任务、个人目标与审批 | [Goals and Tasks](docs/personal-agent/goals-and-tasks.md) |
| 记忆的来源、版本与工作区边界 | [Workspace Memory](docs/workspace-memory-v2.md) |
| 接口、认证与资源 | [HTTP API](docs/API.md) |
| 参与开发或报告问题 | [工程协作指南](CLAUDE.md) · [界面规范](DESIGN.md) · [安全问题报告](SECURITY.md) |

也可以从仓库[下载横屏介绍视频（MP4，约 9.4 MiB）](assets/skydot-intro.mp4?raw=1)。

SkyDot 由 [2SinceJuly](https://github.com/2SinceJuly) 维护，以 [MIT 许可证](LICENSE) 开源。
