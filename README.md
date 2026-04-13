# MuseMelody Demo

这是一个面向 Cloudflare Pages 的前后端 demo，用来展示 MuseMelody 的核心交互流程：

- 输入既有乐谱或文字描述
- 配置即兴旋律生成参数
- 请求后端生成 mock 的旋律 / 和声 / 试听数据
- 在浏览器里直接试听一段合成旋律

当前版本还没有接入正式的 Python 模型、卷积网络乐谱解析器或真实音频生成服务，后端接口返回的是可交互的演示数据，方便你先完成站点展示、汇报和后续联调。

## 目录结构

```text
public/
  index.html      前端页面
  styles.css      页面样式
  app.js          页面交互与浏览器音频试听
functions/
  api/
    generate.js   Cloudflare Pages Function，返回 demo 数据
package.json
```

## 本地运行

1. 安装依赖

```bash
npm install
```

2. 启动 Cloudflare Pages 本地开发

```bash
npm run dev
```

默认会同时提供静态页面和 `/api/generate` 接口。

## 上传到 GitHub

建议把这个项目作为一个完整仓库上传，目录里保留这些内容即可：

- `public`
- `functions`
- `package.json`
- `package-lock.json`
- `wrangler.toml`
- `.gitignore`
- `README.md`

不建议上传：

- `node_modules`
- `.wrangler`
- 课程文档等无关材料

## 部署到 Cloudflare Pages

如果你准备直接挂到 musemelody.com，对应项目建议这样配置：

1. 在 GitHub 新建仓库并上传本项目。
2. 在 Cloudflare Pages 新建项目，选择连接这个 GitHub 仓库。
3. Framework preset 选择 `None`。
4. Build command 留空。
5. Build output directory 填写 `public`。
6. `functions` 目录会被自动识别为 Pages Functions。
7. 部署完成后，在 Pages 项目里把自定义域名绑定到 `musemelody.com` 或你想要的子域名。

## 命令行部署

如果你已经登录 Wrangler，也可以直接在本地执行：

```bash
npm run deploy
```

这个命令会把 `public` 目录部署为静态站点，并携带 `functions` 里的后端接口。

## 下一步接正式能力

1. 把 `functions/api/generate.js` 替换成真实后端代理。
2. 接入你的 Python 服务，完成乐谱图片 / MusicXML / MIDI 到模型输入格式的转换。
3. 把返回结果从 mock 的 note/chord 数据替换成真实推理结果。
4. 如果要做音频生成，可以先输出 MIDI，再接 WebAudio、SoundFont 或独立合成服务。
