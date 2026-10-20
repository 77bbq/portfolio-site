# 机器人与嵌入式作品集

这是一个基于 Astro 的静态作品集网站，按“研究生项目 / 本科生项目”分组。项目资料由 Markdown 管理，新增项目通常只需复制模板，不需要修改页面组件。

当前仓库只包含本地站点和部署工作流。登录 GitHub、创建远程仓库、公开发布以及生成简历二维码，应在确认账号与公开素材后单独完成。

## 本地运行

环境要求：Node.js 24 或更高版本、pnpm 11.25.0。

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm preview
```

常用检查：

```bash
pnpm test:unit
pnpm astro check
pnpm build
pnpm test:output
pnpm site:audit
```

完整验收：

```bash
pnpm verify
```

`pnpm extensibility:check` 会临时复制一个第八项目，在它存在时执行单元测试、构建和输出测试，并检查首页与详情页，随后只删除本次生成的临时项目。

## 修改姓名和联系方式

编辑 `src/data/site.ts`：

- `name`：姓名；为空时首页显示站点标题。
- `direction`：研究方向。
- `intro`：个人简介；为空时不显示简介区域。
- `githubUrl`：完整的 `https://` 地址。
- `resumeUrl`：以 `/` 开头的站内文件地址，例如 `/resume/resume.pdf`。
- `email`：邮箱地址；页面会自动生成 `mailto:` 链接。

空值不会产生空按钮或空白区块。

## 填写现有项目

每个项目位于 `src/content/projects/<slug>/index.md`。正文已预留项目成果、背景、职责、系统设计、技术难点、测试结果和复盘的位置。

填写时：

1. 按需修改 `title`，并补充 `summary`、`roles`、`tech`、`metrics` 和正文。
2. 先写入真正可见的 Markdown 正文，再将 `contentStatus` 从 `placeholder` 改为 `ready`；模板中的 HTML 注释不会成为可见内容。
3. 用 `stage: graduate` 或 `stage: undergraduate` 选择分组。
4. 用 `order` 控制同组排序；数值相同时按 `slug` 排序。
5. `status` 可选 `ongoing` 或 `completed`。

支持的链接只有：

- `https://` 外部链接；
- `mailto:` 邮件链接；
- 以 `/` 开头的站内路径。

站内路径不要手动加入 `/portfolio` 等部署前缀，构建时会根据 `BASE_PATH` 自动添加。

未填写的摘要、指标、技术、链接和联系方式会自动隐藏。

## 新增项目

复制整个 `templates/new-project` 目录到：

```text
src/content/projects/<new-slug>
```

然后编辑复制后的 `index.md`。`slug` 必须是稳定的小写英文和连字符，例如 `warehouse-inspection-robot`，并且要与目录名保持一致。模板中的空字段可以暂时保留。

新增完成后运行：

```bash
pnpm astro check
pnpm build
pnpm site:audit
```

## 准备图片和视频

原始文件放在仓库外，只把面向网站的衍生文件写入本仓库。下列命令不会改写输入文件：

```bash
pnpm media:image --input <source-image> --output src/content/projects/<slug>/cover.webp
pnpm media:poster --input <source-video> --output src/content/projects/<slug>/poster.webp --seconds 2
pnpm media:video --input <source-video> --output public/media/projects/<slug>/demo.mp4 --max-width 1280
```

内容文件中的本地视频统一使用站点根相对地址：

```yaml
media:
  - type: "video"
    src: "/media/projects/<slug>/demo.mp4"
    poster: "./poster.webp"
    alt: "项目演示视频"
    caption: ""
    order: 10
```

项目图片放在该项目内容目录内并使用相对路径，例如 `./cover.webp` 或 `./gallery/detail.webp`；填写 `cover` 或图片媒体时必须同时提供有意义的替代文字。发布前请确认人物、工位、屏幕、证书编号和文件内容适合公开，并确认素材使用权。

## GitHub Pages 路径

默认工作流会根据仓库名自动选择路径：

- 用户站点仓库 `<owner>.github.io` 使用根路径 `/`；
- 普通项目仓库使用 `/<repository>/`；
- 配置自定义域名变量 `SITE_URL` 时必须使用根路径，不要再设置非空 `BASE_PATH`；
- 默认 GitHub 域名下如确需覆盖，可单独设置仓库变量 `BASE_PATH`。

`SITE_URL` 只填写 HTTPS 源站（域名部分），部署子路径始终由 `BASE_PATH` 单独表示。

本地模拟项目子路径：

```powershell
$env:SITE_URL = "https://example.github.io"
$env:BASE_PATH = "/robotics-portfolio"
pnpm build
pnpm test:output
pnpm site:audit
```

清除 PowerShell 临时变量：

```powershell
Remove-Item Env:SITE_URL, Env:BASE_PATH
```

## 发布到 GitHub Pages

本地开发不需要登录 GitHub。准备公开发布时再进行以下操作：

1. 登录个人 GitHub 账号并创建目标公开仓库。
2. 将本仓库的 `main` 分支推送到该远程仓库。
3. 在仓库的 **Settings → Pages → Build and deployment** 中，将 Source 设为 **GitHub Actions**。
4. 如需自定义域名，在 **Settings → Secrets and variables → Actions → Variables** 中设置根域名 `SITE_URL` 并让 `BASE_PATH` 保持为空；如只需覆盖默认仓库子路径，则仅设置 `BASE_PATH`。不要添加账号密码或令牌到仓库文件。
5. 等待 “Deploy portfolio to GitHub Pages” 工作流完成，打开工作流返回的页面地址并做一次线上检查。
6. 线上地址确认稳定后，再用该最终 URL 生成二维码并放入简历。

工作流会先执行测试、Astro 类型检查和 `/portfolio` 子路径构建门禁，再上传并部署正式构建结果。
