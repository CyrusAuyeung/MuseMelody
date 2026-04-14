# MuseMelody

> AI melody continuation and score-to-improvisation workspace for generating, previewing, and exporting new musical ideas from existing material.

MuseMelody 是一个面向公开用户的 AI 旋律续写与乐谱生成网站。

它帮助用户从已有乐谱、MIDI、MusicXML 或文字描述出发，生成新的旋律片段、和声建议与试听结果，并在同一界面里完成输入、生成、试听和导出。

## Why MuseMelody

创作并不总是从空白页开始。

很多时候，真正的需求不是“从零写一首歌”，而是：

- 给出一段已有旋律，再往下写
- 为一段现有主题找新的发展方向
- 快速比较不同版本的旋律走向
- 在网页里直接试听、调整和导出结果

MuseMelody 就是围绕这个动作设计的产品。

## What It Does

当前版本支持：

- 从乐谱、MIDI、MusicXML、图片或文字描述开始
- 使用键盘录入旋律音高与时值
- 选择风格、音色、速度和生成长度
- 生成新的旋律片段与和声建议
- 试听原旋律、生成旋律与合并结果
- 导出 MIDI 文件
- 在首页中直接使用成熟服务界面

## Product Experience

MuseMelody 当前的产品结构包括两层：

1. 产品首页
   负责产品定位、能力说明、结果展示和 FAQ。

2. 成熟服务工作台
   负责真正的旋律输入、生成、试听和导出流程，并已经嵌入首页。

## User Flow

```mermaid
flowchart LR
    A[Upload or input melody] --> B[Adjust style and parameters]
    B --> C[Generate continuation]
    C --> D[Preview harmony and melody]
    D --> E[Listen and compare]
    E --> F[Export MIDI or iterate again]
```

## Site Architecture

```mermaid
flowchart TB
    User[User] --> Home[Homepage]
    Home --> Studio[Embedded Studio Service]
    Studio --> ParseAPI[/api/score/parse]
    Studio --> GenerateAPI[/api/improv/generate]
    Studio --> ExportAPI[/api/midi/export]
    ParseAPI --> Functions[Cloudflare Pages Functions]
    GenerateAPI --> Functions
    ExportAPI --> Functions
```

## Repository Structure

```text
public/
  index.html              Product homepage
  styles.css              Homepage styles
  studio/                 Built studio assets embedded into the homepage
functions/
  api/
    score/parse.js        Score image parsing endpoint
    improv/generate.js    Melody generation endpoint
    midi/export.js        MIDI export endpoint
program/
  Musemelody/
    frontend/             Main studio frontend source (Vite + React)
    backend/              Original Python/FastAPI reference implementation
scripts/
  build-studio.mjs        Builds the studio and injects the embedded script into homepage
```

## Core Source Files

### Product homepage

- [public/index.html](public/index.html)
- [public/styles.css](public/styles.css)

### Embedded studio service

- [program/Musemelody/frontend/src/InspirationMuse.jsx](program/Musemelody/frontend/src/InspirationMuse.jsx)
- [program/Musemelody/frontend/src/App.jsx](program/Musemelody/frontend/src/App.jsx)
- [program/Musemelody/frontend/src/embed.jsx](program/Musemelody/frontend/src/embed.jsx)
- [program/Musemelody/frontend/vite.config.js](program/Musemelody/frontend/vite.config.js)

### Site APIs

- [functions/api/score/parse.js](functions/api/score/parse.js)
- [functions/api/improv/generate.js](functions/api/improv/generate.js)
- [functions/api/midi/export.js](functions/api/midi/export.js)

## Local Development

### 1. Install root dependencies

```bash
npm install
```

### 2. Install studio frontend dependencies

```bash
cd program/Musemelody/frontend
npm install
```

### 3. Build the embedded studio

```bash
cd ../../..
npm run build:studio
```

### 4. Start the site locally

```bash
npm run dev
```

## Deployment

The project is designed for Cloudflare Pages.

Recommended configuration:

- Framework preset: `None`
- Build command: leave empty
- Build output directory: `public`

Important:

Whenever you update the studio frontend source under `program/Musemelody/frontend/`, rebuild it before deployment:

```bash
npm run build:studio
```

## Current Implementation Notes

The current online version uses:

- Cloudflare Pages static frontend
- Cloudflare Pages Functions APIs
- Embedded studio build output under `public/studio/`

The original Python/FastAPI backend remains in the repository as a reference implementation under [program/Musemelody/backend](program/Musemelody/backend).

## Roadmap

Potential next steps for the product include:

- Replacing the current placeholder score parsing with a real OMR model
- Replacing the current rule-based generation with a real model inference service
- Adding generation history and version comparison
- Improving playback/export feedback and result states
- Adding user accounts and project persistence

## Repository Policy

This repository is not released as open source software.

Please see:

- [LICENSE](LICENSE)
- [NOTICE](NOTICE)
