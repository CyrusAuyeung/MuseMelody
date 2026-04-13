# MuseMelody

MuseMelody 是一个面向“既有乐谱 -> 即兴旋律 / 和声生成”的网页 demo，当前版本已经部署到 Cloudflare Pages，可用于展示项目方向、前后端交互流程，以及后续接入深度学习模型或 AI API 的整体形态。

这个仓库目前聚焦三个目标：

- 用网页形式展示乐谱生成类项目的可交互体验
- 提前打通前端、接口、试听预览的基本链路
- 为后续接入 Python 乐谱解析、旋律生成模型、音频生成服务预留稳定接口

## 项目背景

MuseMelody 的核心想法是：

1. 输入已有乐谱、lead sheet、MusicXML、MIDI，或者乐谱图片扫描件。
2. 将乐谱内容转换成模型可以处理的数据格式。
3. 基于深度学习模型、卷积网络识别结果或外部 AI API，生成新的即兴旋律与和声片段。
4. 在网页端完成结果预览、试听、参数调节与后续导出。

当前仓库提供的是可运行的 demo 版本，重点在网页交互和接口结构，不是最终模型系统。

## 当前已实现

- 已部署的 Cloudflare Pages 前端页面
- 可交互的生成工作台
- 风格、长度、创造性、和声密度等控制项
- Cloudflare Pages Functions 后端占位接口
- mock 旋律 / 和声数据返回
- 基于浏览器 Web Audio 的试听 demo

## 当前未实现

- 正式的卷积网络乐谱识别流程
- Python 数据预处理服务
- 真正的旋律生成模型推理
- 音频文件导出、MIDI 导出、MusicXML 导出
- 用户系统、作品存档、历史记录

## 技术结构

### 前端

- 原生 HTML / CSS / JavaScript
- 单页交互式工作台
- 浏览器内 Web Audio 简单试听

### 后端

- Cloudflare Pages Functions
- 当前接口路径：`/api/generate`
- 当前返回 mock 数据，后续可以替换为真实模型服务代理

### 部署

- GitHub 仓库托管
- Cloudflare Pages 自动部署
- 可绑定自定义域名

## 目录结构

```text
public/
  index.html        前端主页面
  styles.css        页面样式
  app.js            页面交互、请求逻辑、试听逻辑
functions/
  api/
    generate.js     Cloudflare Pages Function，返回 demo 数据
package.json        项目脚本与依赖
wrangler.toml       Wrangler 配置
```

## 本地运行

### 1. 安装依赖

```bash
npm install
```

### 2. 启动本地开发环境

```bash
npm run dev
```

启动后，Wrangler 会在本地提供：

- 静态页面
- Cloudflare Pages Functions
- `/api/generate` 本地接口

## 部署方式

本项目适合使用 GitHub + Cloudflare Pages 的方式部署。

### Cloudflare Pages 推荐配置

- Framework preset: `None`
- Build command: 留空
- Build output directory: `public`

Cloudflare 会自动识别 `functions` 目录，并将 [functions/api/generate.js](functions/api/generate.js) 作为 Pages Function 发布。

### 命令行部署

如果已经配置 Wrangler 账号，也可以直接执行：

```bash
npm run deploy
```

当前脚本定义见 [package.json](package.json)。

## 页面功能说明

当前 demo 页面支持以下交互：

1. 上传乐谱文件占位
2. 输入乐谱 / 场景描述
3. 选择输入格式
4. 选择生成风格
5. 调节小节长度、创造性、和声密度
6. 选择输出目标
7. 请求后端生成 demo 数据
8. 查看和声、旋律片段与波形预览
9. 点击试听 demo 片段

主页面代码在 [public/index.html](public/index.html)、[public/styles.css](public/styles.css)、[public/app.js](public/app.js)。

## API 约定

当前后端接口为：

### `POST /api/generate`

请求体示例：

```json
{
  "prompt": "根据一段钢琴 lead sheet 生成 8 小节 neo-soul 风格即兴旋律",
  "inputType": "musicxml",
  "style": "neo-soul",
  "outputMode": "score",
  "bars": 8,
  "temperature": 0.64,
  "density": 0.58,
  "fileName": "demo.musicxml"
}
```

返回体结构示例：

```json
{
  "requestId": "mm-xxxxxx",
  "title": "neo-soul generated sketch",
  "overview": "...",
  "bpm": 96,
  "harmony": ["Cmaj9", "Dm9", "G13", "Em7"],
  "phrases": [
    {
      "bar": 1,
      "contour": "lift",
      "notes": [
        { "pitch": "C4", "duration": 0.5 },
        { "pitch": "E4", "duration": 0.5 }
      ],
      "motif": "C4/0.5 · E4/0.5"
    }
  ],
  "waveform": [0.24, 0.46, 0.31],
  "nextSteps": [
    "把乐谱图片或 MusicXML 解析结果传给 Python 预处理服务。"
  ]
}
```

接口实现位置见 [functions/api/generate.js](functions/api/generate.js)。

## 后续接真实模型的推荐路线

### 路线一：Cloudflare 仅做前端 + API 网关

适合情况：

- 真正的模型运行在 Python 服务中
- 需要 CUDA、PyTorch、TensorFlow 或其他较重依赖
- 需要处理文件上传、乐谱解析、音频生成

建议做法：

1. 前端继续留在 Cloudflare Pages。
2. `functions/api/generate.js` 改为代理接口。
3. Cloudflare Function 调用外部 Python 服务。
4. Python 服务返回标准化 JSON，前端保持不变。

### 路线二：外部 AI API 生成

适合情况：

- 短期内先做功能展示
- 用第三方生成服务替代自训模型

建议做法：

1. 保留当前页面交互。
2. 在 `functions/api/generate.js` 中接入外部 API。
3. 将外部响应整理为当前页面所需结构。

## 下一步建议

如果你要把这个项目继续推进成可汇报、可答辩、可继续开发的版本，优先级建议如下：

1. 接入真实的乐谱解析服务
2. 明确统一的旋律生成返回格式
3. 补上 MIDI / MusicXML 导出
4. 增加作品保存与历史记录
5. 增加更完整的项目介绍页和团队说明

## 说明

当前仓库是 demo 与前端交互骨架，不代表最终模型效果。它的价值主要在于：

- 已经完成展示层和交互层
- 已经有可以上线的站点结构
- 已经把后续模型接入点提前定好

后续无论你接的是卷积网络乐谱识别、深度学习旋律生成，还是 AI API，都可以沿着现有接口继续扩展。
