# MuseMelody

MuseMelody 是一个面向公开用户的 AI 旋律续写与乐谱生成网站。

它让用户从已有乐谱、MIDI、MusicXML 或文字描述出发，快速生成新的旋律片段、和声建议与试听结果，并在同一界面内完成输入、生成、试听和导出。

## 产品概览

MuseMelody 当前围绕一个核心使用场景展开：

给出一段已有旋律，然后继续把它写下去。

这使它适合：

- 作曲与编曲中的灵感延展
- 基于已有主题的发展和续写
- 生成多个版本并快速比较
- 在网页中直接试听和导出结果

## 当前体验

当前线上版本已经具备完整的产品路径：

1. 输入旋律
   可以通过乐谱图片、键盘录入、预设旋律或文字描述开始。

2. 调整参数
   可以设置风格、音色、速度和生成长度。

3. 生成结果
   会返回新的旋律片段、和声建议和节奏信息。

4. 试听与导出
   可以试听原旋律、生成旋律或合并结果，并导出 MIDI 文件。

## 核心能力

- 旋律续写与即兴生成
- 和声方向建议
- 乐谱图片输入占位识别
- 网页内即时试听
- MIDI 导出
- 单页内嵌成熟工作台体验

## 当前网站结构

当前站点由两部分组成：

### 1. 产品首页

文件位置：

- [public/index.html](public/index.html)
- [public/styles.css](public/styles.css)

职责：

- 对外展示产品价值
- 提供用户导向的产品说明
- 承载成熟服务的嵌入入口
- 展示结果说明与 FAQ

### 2. 成熟服务工作台

源码位置：

- [program/Musemelody/frontend/src/InspirationMuse.jsx](program/Musemelody/frontend/src/InspirationMuse.jsx)
- [program/Musemelody/frontend/src/App.jsx](program/Musemelody/frontend/src/App.jsx)
- [program/Musemelody/frontend/src/embed.jsx](program/Musemelody/frontend/src/embed.jsx)

构建产物位置：

- [public/studio](public/studio)

职责：

- 输入旋律
- 调节生成参数
- 调用站内 API
- 播放与导出结果

## API 结构

当前站点使用的 API 在 Cloudflare Pages Functions 中实现：

- [functions/api/score/parse.js](functions/api/score/parse.js)
- [functions/api/improv/generate.js](functions/api/improv/generate.js)
- [functions/api/midi/export.js](functions/api/midi/export.js)

对应功能分别是：

1. 乐谱图片解析
2. 旋律生成
3. MIDI 导出

## 技术结构

### 前端

- 产品首页：原生 HTML / CSS
- 成熟服务：Vite + React
- 浏览器内试听：Web Audio

### 后端

- Cloudflare Pages Functions
- 同域名 API
- 当前生成逻辑为可运行实现，便于完整展示产品路径

### 部署

- GitHub 仓库托管
- Cloudflare Pages 部署
- 构建后将成熟服务嵌入首页

## 本地运行

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

### 4. 启动本地站点

```bash
npm run dev
```

## 构建说明

`scripts/build-studio.mjs` 负责：

1. 构建 `program/Musemelody/frontend`
2. 输出产物到 `public/studio/`
3. 将嵌入脚本注入首页

相关文件：

- [scripts/build-studio.mjs](scripts/build-studio.mjs)
- [package.json](package.json)

## 参考实现

仓库中保留了原始程序结构，供继续开发和参考：

- [program/Musemelody/backend](program/Musemelody/backend)
- [program/Musemelody/frontend](program/Musemelody/frontend)
- [program/Musemelody/README.md](program/Musemelody/README.md)

其中 `program/Musemelody/backend/` 是原始 Python/FastAPI 版本参考实现。

## 当前仓库定位

这个仓库当前承担两种角色：

1. 产品网站仓库
2. 成熟服务源码与嵌入构建仓库

也就是说，它既包含线上站点本身，也包含驱动该站点核心体验的服务前端源码与站内 API。

## 后续可继续增强的方向

- 更真实的乐谱识别模型
- 更强的生成结果版本管理
- 历史记录与最近生成
- 更丰富的导出与播放反馈
- 更完整的用户系统与项目保存能力
