# MuseMelody

MuseMelody 是一个面向公开用户的 AI 旋律续写与乐谱生成网站。

当前站点已经不是早期的静态 demo，而是一个包含产品首页、内嵌成熟服务界面、同域名 API 和可构建前端工作台的完整网页项目。

## 当前状态

当前线上站点由两部分组成：

1. 首页
   负责产品展示、功能介绍、结果说明、FAQ，以及直接承载核心服务入口。

2. 成熟服务界面
   真实的旋律生成工作台已经嵌入首页，同时保留独立构建产物在 `public/studio/` 下，供站点内部复用。

## 当前功能

网站当前支持：

- 输入既有旋律
- 上传乐谱图片进行占位识别
- 手动键盘录入音高与时值
- 选择风格、音色、速度与长度
- 生成新的旋律片段
- 试听原旋律、生成旋律与合并结果
- 导出 MIDI 文件

## 项目结构

```text
public/
  index.html              产品首页
  styles.css              首页样式
  studio/                 成熟服务的构建产物
functions/
  api/
    score/parse.js        乐谱图片解析接口（当前为可运行占位流程）
    improv/generate.js    旋律生成接口
    midi/export.js        MIDI 导出接口
program/
  Musemelody/
    frontend/             真实服务前端源码（Vite + React）
    backend/              原始 Python/FastAPI 版本参考
    inspiration-muse.jsx  原始主组件来源
scripts/
  build-studio.mjs        将成熟服务构建并注入首页的脚本
package.json
wrangler.toml
```

## 运行方式

### 1. 安装根项目依赖

```bash
npm install
```

### 2. 安装成熟服务前端依赖

```bash
cd program/Musemelody/frontend
npm install
```

### 3. 构建成熟服务

```bash
cd ../../..
npm run build:studio
```

这个命令会做两件事：

1. 构建 `program/Musemelody/frontend`
2. 将产物复制到 `public/studio/`
3. 自动把嵌入脚本注入 `public/index.html`

### 4. 本地启动 Cloudflare Pages

```bash
npm run dev
```

如果你希望本地先自动重建成熟服务再启动站点，也可以使用：

```bash
npm run build:studio
npm run dev
```

## 当前 API

网站当前实际使用的接口为：

### `POST /api/score/parse`

接收上传图片，返回识别到的音符数据。

当前是可运行占位流程，返回示例旋律，用于打通前后端链路。

### `POST /api/improv/generate`

输入：

- `notes`
- `style`
- `bars`
- `tempo`

输出：

- `analysis`
- `improvisation`

当前生成逻辑是规则式 / Markov 风格的可运行实现，适合在网页中展示完整服务流程。

### `POST /api/midi/export`

输入音符列表与速度，返回 MIDI 文件下载流。

## 部署方式

当前项目适合部署到 Cloudflare Pages。

推荐配置：

- Framework preset: `None`
- Build command: 留空
- Build output directory: `public`

注意：

每次更新 `program/Musemelody/frontend` 后，最好先执行：

```bash
npm run build:studio
```

然后再提交和部署，这样首页中嵌入的成熟服务脚本才会更新。

## 代码说明

### 首页相关

- [public/index.html](public/index.html)
- [public/styles.css](public/styles.css)

### 成熟服务源码

- [program/Musemelody/frontend/src/InspirationMuse.jsx](program/Musemelody/frontend/src/InspirationMuse.jsx)
- [program/Musemelody/frontend/src/App.jsx](program/Musemelody/frontend/src/App.jsx)
- [program/Musemelody/frontend/src/embed.jsx](program/Musemelody/frontend/src/embed.jsx)
- [program/Musemelody/frontend/vite.config.js](program/Musemelody/frontend/vite.config.js)

### 站内 API

- [functions/api/score/parse.js](functions/api/score/parse.js)
- [functions/api/improv/generate.js](functions/api/improv/generate.js)
- [functions/api/midi/export.js](functions/api/midi/export.js)

## 后续可继续优化的方向

1. 将当前乐谱图片识别占位流程替换为真实 OMR 模型
2. 将当前规则式生成替换为真实深度学习推理服务
3. 为成熟服务增加历史记录、模板库、结果版本比较与导出状态反馈
4. 进一步统一首页和服务界面的设计语言

## 说明

仓库中 `program/Musemelody/backend/` 仍保留原始 Python/FastAPI 版本，主要作为参考实现。

当前线上版本实际运行的是：

- Cloudflare Pages 静态前端
- Cloudflare Functions API
- 嵌入首页的成熟服务构建产物
