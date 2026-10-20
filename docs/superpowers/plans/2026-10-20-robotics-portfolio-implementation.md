# Robotics & Embedded Portfolio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fast, mobile-first Astro portfolio that groups one graduate project and six undergraduate projects, uses the supplied media, leaves safe author-editable content placeholders, and deploys through GitHub Pages.

**Architecture:** Astro generates static HTML from a typed `projects` content collection. Pure helpers own base-path generation and deterministic project grouping; focused Astro components own cards, layouts, facts, and media. Optimized images live with project content, video files live under `public/media`, and GitHub Actions builds and deploys the same source for either a user-site root or repository subpath.

**Tech Stack:** Node.js 24, pnpm 11, Astro 7, TypeScript, Zod-backed Astro content collections, Sharp, Vitest, Cheerio, ffmpeg-static, GitHub Actions, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-20-robotics-portfolio-design.md`

## Global Constraints

- First release is Chinese-only and fully static: no accounts, database, analytics, comments, online editor, or server runtime.
- The homepage displays graduate projects before undergraduate projects and shows every public project in v1.
- Public project routes are stable `/projects/<slug>/` URLs; education stage never appears in the route.
- Empty optional content and links render nothing; `contentStatus: placeholder` renders one “内容整理中” notice and no empty section headings.
- Source media stays read-only outside the repository; only copied and optimized derivatives enter the repository.
- System fonts only; no remote font, icon, or script CDN.
- Videos never autoplay and use `controls`, `playsinline`, and deferred loading.
- Internal URLs must work at both `/` and `/portfolio/` base paths.
- Repository files must not contain local absolute paths, credentials, Wi-Fi data, customer data, or unpublished source documents.
- Use the canonical display name “物流搬运机小车”; its source image remains named `物流搬运小车.jpg` outside the repository.
- Keep awards, bilingual UI, filtering, search, and admin features out of v1.

## Review Focus

1. **GitHub Pages subpath:** `/portfolio/` builds must prefix every internal page, image, video, and navigation URL exactly once; Task 1 unit tests and Task 7 built-site checks pin this behavior.
2. **Missing optional content:** empty summary, contacts, links, cover, metrics, and placeholder Markdown must collapse without empty boxes or headings; Tasks 2, 5, and 6 test each owning layer.
3. **Deterministic grouping:** graduate appears first, undergraduate second, `order` sorts ascending, and duplicate order values use `slug`; Tasks 2 and 5 test the data and rendered output.
4. **Media edge cases:** portrait, low-resolution, absent cover, local video, and video-without-autoplay all remain usable; Tasks 3, 5, and 6 verify assets and HTML attributes.
5. **Public-repository safety:** no source PDFs/PPTX, local paths, secrets, broken local URLs, or remote runtime font/script dependencies enter the tracked repository or build; Task 7 scans every tracked filename/text file and the built output.

---

## File Structure

### Project and build configuration

- `package.json` — scripts, Node/pnpm contract, runtime and development dependencies.
- `pnpm-lock.yaml` — reproducible dependency graph.
- `astro.config.mjs` — static output plus `SITE_URL`/`BASE_PATH` handling.
- `tsconfig.json` — Astro strict TypeScript configuration.
- `vitest.config.ts` — unit and built-output test configuration.
- `.gitignore` — dependencies, build output, caches, local incoming media, and environment files.
- `.github/workflows/deploy.yml` — verified GitHub Pages build/deploy workflow.

### Data and content

- `src/content.config.ts` — `projects` collection schema, including image/video media unions.
- `src/data/site.ts` — editable identity, direction, introduction, GitHub, résumé, and contact values.
- `src/lib/paths.ts` — base-path normalization and URL prefixing.
- `src/lib/projects.ts` — project types, labels, deterministic sorting, grouping, and collection loading.
- `src/content/projects/<slug>/index.md` — one author-editable project record per project.
- `templates/new-project/index.md` — copyable, commented project template.

### Presentation

- `src/layouts/BaseLayout.astro` — metadata, skip link, header/footer shell, and global styles.
- `src/layouts/ProjectLayout.astro` — shared project-detail composition.
- `src/components/Header.astro` — compact navigation using base-aware URLs.
- `src/components/Footer.astro` — visible configured contact actions only.
- `src/components/ProjectCard.astro` — accessible project link, cover fallback, status, and optional metadata.
- `src/components/ProjectGrid.astro` — stage heading and responsive project grid.
- `src/components/ProjectFacts.astro` — non-empty roles, technologies, and metrics.
- `src/components/ProjectMedia.astro` — responsive images and non-autoplay videos.
- `src/components/ConfiguredLink.astro` — labelled local/mail/external links with base-aware and safe new-tab behavior.
- `src/components/PlaceholderNotice.astro` — consistent in-progress content message.
- `src/pages/index.astro` — hero and graduate/undergraduate project sections.
- `src/pages/projects/[slug].astro` — statically generated project pages.
- `src/styles/global.css` — design tokens, typography, layout, focus, responsive rules, and reduced motion.
- `public/favicon.svg` — simple engineering-themed local icon.

### Media tooling and verification

- `scripts/media-tools.mjs` — image optimization and deterministic ffmpeg argument builders.
- `scripts/prepare-media.mjs` — CLI for generating repository media derivatives from explicit input/output arguments.
- `scripts/check-built-site.mjs` — internal-link, asset, base-path, and unsafe-reference audit.
- `scripts/resolve-pages-config.mjs` — deterministic GitHub repository-to-site/base configuration and workflow outputs.
- `scripts/check-extensibility.mjs` — temporary eighth-project build acceptance check with guaranteed cleanup.
- `tests/paths.test.ts` — root/subpath URL behavior.
- `tests/projects.test.ts` — project ordering/grouping and optional-field behavior.
- `tests/media-tools.test.ts` — image output and ffmpeg command contracts.
- `tests/project-content.test.ts` — exact seven-project manifest and source-independent public metadata.
- `tests/homepage-output.test.ts` — built homepage semantics and grouping.
- `tests/project-pages-output.test.ts` — detail pages, placeholder behavior, media attributes, and accessibility basics.
- `tests/configured-link.test.ts` — isolated base-aware local-link and safe external-link rendering.
- `tests/built-site-integrity.test.ts` — local-link, runtime dependency, base-path, and all-tracked-file privacy validation.
- `tests/pages-config.test.ts` — user-site, project-site, custom-domain, and workflow wiring behavior.
- `README.md` — local development, author editing, adding a project, media preparation, and deployment.

---

### Task 1: Bootstrap Astro and base-aware URL utilities

**Files:**
- Create: `package.json`
- Create: `pnpm-lock.yaml`
- Create: `astro.config.mjs`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `src/env.d.ts`
- Create: `src/lib/paths.ts`
- Create: `src/pages/index.astro`
- Test: `tests/paths.test.ts`

**Interfaces:**
- Produces: `normalizeBase(base: string | undefined): string`
- Produces: `withBasePath(pathname: string, base?: string): string`
- Produces: `resolveConfiguredHref(href: string, base?: string): { href: string; external: boolean } | null`
- Produces: package scripts `dev`, `build`, `preview`, `check`, `test`, and `test:unit`

- [ ] **Step 1: Create the minimal package and configuration files**

Set `packageManager` to `pnpm@11.25.0`, require Node `>=24`, configure Astro static output, and add dependencies `astro`, `sharp`, plus development dependencies `@astrojs/check`, `typescript`, `vitest`, and `cheerio`. Define `test:unit` so it excludes `tests/*-output.test.ts` and `tests/built-site-integrity.test.ts`, which require a completed `dist/`; `test` is its watch-mode counterpart. Install once to create `pnpm-lock.yaml`.

- [ ] **Step 2: Write the failing base-path tests**

```ts
expect(normalizeBase(undefined)).toBe("");
expect(normalizeBase("/")).toBe("");
expect(normalizeBase("portfolio")).toBe("/portfolio");
expect(withBasePath("/projects/demo/", "/portfolio/")).toBe("/portfolio/projects/demo/");
expect(withBasePath("/projects/demo/", "/")).toBe("/projects/demo/");
expect(resolveConfiguredHref("/resume/cv.pdf", "/portfolio")).toEqual({ href: "/portfolio/resume/cv.pdf", external: false });
expect(resolveConfiguredHref("https://example.com", "/portfolio")).toEqual({ href: "https://example.com", external: true });
expect(resolveConfiguredHref("", "/portfolio")).toBeNull();
expect(() => resolveConfiguredHref("http://example.com", "/portfolio")).toThrow();
expect(() => resolveConfiguredHref("javascript:alert(1)", "/portfolio")).toThrow();
```

- [ ] **Step 3: Run the unit test and verify the expected failure**

Run: `pnpm vitest run tests/paths.test.ts`

Expected: FAIL because `src/lib/paths.ts` does not yet export the three functions.

- [ ] **Step 4: Implement the three pure URL helpers and wire Astro config to environment values**

`resolveConfiguredHref` trims the input; returns `null` for empty values; accepts `https://`, `mailto:`, or a single-leading-slash site path; prefixes only site paths with `withBasePath`; marks only HTTPS URLs external; and throws for insecure `http://`, protocol-relative paths, bare relative paths, `file:`, `javascript:`, or any other scheme. `astro.config.mjs` reads `SITE_URL` and `BASE_PATH`, normalizes an empty/root base to `/`, and never embeds a local filesystem path. `src/pages/index.astro` is only a minimal buildable shell for later tasks.

- [ ] **Step 5: Verify the task**

Run: `pnpm vitest run tests/paths.test.ts && pnpm astro check && pnpm build`

Expected: all path tests pass, Astro reports zero errors, and `dist/index.html` exists.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml astro.config.mjs tsconfig.json vitest.config.ts .gitignore src/env.d.ts src/lib/paths.ts src/pages/index.astro tests/paths.test.ts
git commit -m "chore: bootstrap Astro portfolio"
```

---

### Task 2: Define the typed content model and deterministic project grouping

**Files:**
- Create: `src/content.config.ts`
- Create: `src/data/site.ts`
- Create: `src/lib/projects.ts`
- Create: `templates/new-project/index.md`
- Test: `tests/projects.test.ts`

**Interfaces:**
- Consumes: `withBasePath(pathname, base)` and `resolveConfiguredHref(href, base)` from Task 1.
- Produces: `type Stage = "graduate" | "undergraduate"`
- Produces: `type ProjectStatus = "ongoing" | "completed"`
- Produces: `type ContentStatus = "placeholder" | "ready"`
- Produces: `type ProjectImageMedia = { type: "image"; src: ImageMetadata; alt: string; caption?: string; order: number }`
- Produces: `type ProjectVideoMedia = { type: "video"; src: string; poster?: ImageMetadata; alt: string; caption?: string; order: number }`
- Produces: `type ProjectMediaItem = ProjectImageMedia | ProjectVideoMedia`
- Produces: `createProjectSchema(imageFactory: () => z.ZodTypeAny): z.ZodTypeAny`
- Produces: `compareProjects(a: ProjectLike, b: ProjectLike): number`
- Produces: `compareMedia(a: ProjectMediaItem, b: ProjectMediaItem): number`
- Produces: `sortMedia<T extends ProjectMediaItem>(media: T[]): T[]`
- Produces: `groupProjects<T extends ProjectLike>(projects: T[]): { graduate: T[]; undergraduate: T[] }`
- Produces: `assertUniqueProjectSlugs(projects: ProjectLike[]): void`
- Produces: `stageSectionId(stage: Stage): "graduate-projects" | "undergraduate-projects"`
- Produces: `stageBackHref(stage: Stage, base?: string): string`
- Produces: `hasUsableCover(project: { cover?: unknown; coverAlt?: string }): boolean`
- Produces: `shouldRenderProjectBody(status: ContentStatus, bodyHtml: string): boolean`
- Produces: `getProjects(): Promise<CollectionEntry<"projects">[]>`
- Produces: `STAGE_LABELS` and `STATUS_LABELS`
- Produces: `siteIdentity` with `title`, `name`, `direction`, `intro`, `githubUrl`, `resumeUrl`, and `email`

- [ ] **Step 1: Write the failing schema, ordering, and navigation tests**

Use `createProjectSchema(() => z.string())` for schema fixtures. Test that a valid minimal project parses; an invalid `stage` and a missing `title` each fail with a field-specific issue; `cover` without non-empty `coverAlt` or `coverAlt` without `cover` each fails; empty media `alt` fails; video `src: "./demo.mp4"` fails while `/media/projects/demo.mp4` passes; and configured links reject `javascript:`. Test that graduate and undergraduate entries are separated, `order` is ascending, equal project orders use slug ascending, duplicate slugs throw `Duplicate project slug: <slug>`, and the input array is not mutated. Define one image and one video media fixture with the same order and assert `compareMedia` uses `image.src.src` or `video.src` as its ascending tie-breaker and `sortMedia` does not mutate its input. Also assert the two stable section IDs and base-aware backlink values `/portfolio/#graduate-projects` and `/portfolio/#undergraduate-projects`. Finally test that empty optional strings stay empty, an absent/empty cover chooses fallback presentation, placeholder content never exposes a body, and ready non-empty content does expose a body.

- [ ] **Step 2: Run the tests and verify failure**

Run: `pnpm vitest run tests/projects.test.ts`

Expected: FAIL because the project interfaces and grouping functions do not exist.

- [ ] **Step 3: Implement the collection schema and pure project helpers**

The schema must enforce the two stages, two statuses, two content statuses, non-empty stable slug/title, numeric order, optional paired cover/non-empty-coverAlt validation, optional `coverFit: "cover" | "contain"`, optional `coverPosition`, optional roles/tech/metrics/links, and the exact discriminated image/video media union above with trimmed non-empty `alt`. Image `src`/video `poster` use Astro image metadata; video `src` must be an encoded site-root-relative string beginning `/media/`, never `./`. Link values may be empty or follow Task 1's accepted HTTPS, `mailto:`, or site-root-relative forms. `compareMedia` sorts by numeric `order`, then by source string (`image.src.src` for images and `video.src` for videos). `getProjects()` calls `assertUniqueProjectSlugs` before returning entries sorted through `compareProjects`. Stage helpers own the two section IDs and build `/<base>/#<section-id>` links through `withBasePath`.

- [ ] **Step 4: Add site defaults and the author-editable template**

Use default title `机器人与嵌入式作品集` and direction `机器人 · 嵌入式 · 系统集成`; leave personal name, introduction, GitHub, résumé, and email empty. The template uses HTML comments for writing guidance, `contentStatus: placeholder`, and a commented video example using `/media/projects/<slug>/demo.mp4` rather than a page-relative path.

- [ ] **Step 5: Verify the task**

Run: `pnpm vitest run tests/projects.test.ts && pnpm astro check`

Expected: all project helper tests pass and the schema type-checks.

- [ ] **Step 6: Commit**

```bash
git add src/content.config.ts src/data/site.ts src/lib/projects.ts templates/new-project/index.md tests/projects.test.ts
git commit -m "feat: add extensible project content model"
```

---

### Task 3: Build reusable media preparation and create optimized derivatives

**Files:**
- Create: `scripts/media-tools.mjs`
- Create: `scripts/prepare-media.mjs`
- Create: `tests/media-tools.test.ts`
- Create: `src/content/projects/air-ground-coordination/cover.webp`
- Create: `src/content/projects/robomaster-hero/cover.webp`
- Create: `src/content/projects/electric-racing-car/cover.webp`
- Create: `src/content/projects/logistics-carrier/cover.webp`
- Create: `src/content/projects/smart-harvesting-car/cover.webp`
- Create: `src/content/projects/raicom-robot/cover.webp`
- Create: `src/content/projects/bionic-frog/cover.webp`
- Create: `src/content/projects/bionic-frog/gallery/assembly.webp`
- Create: `public/media/projects/air-ground-coordination/demo.mp4`
- Create: `public/media/projects/robomaster-hero/demo.mp4`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces: `optimizeImage(options: { input: string; output: string; maxLongEdge: number; quality: number; fit?: "inside" | "contain" }): Promise<void>`
- Produces: `buildPosterArgs(options: { input: string; output: string; seconds: number }): string[]`
- Produces: `buildTranscodeArgs(options: { input: string; output: string; maxWidth: number }): string[]`
- Produces: CLI commands `pnpm media:image`, `pnpm media:poster`, and `pnpm media:video`

- [ ] **Step 1: Add `ffmpeg-static` and write failing media-tool tests**

Tests create one oversized and one small portrait PNG with Sharp. Assert the oversized WebP has both dimensions at or below `maxLongEdge`, the small image retains its original dimensions through `withoutEnlargement`, and poster/transcode arguments include explicit input/output, bounded even-dimension scaling, H.264 video, AAC audio, `yuv420p`, CRF 24, `+faststart`, and never target the input path.

- [ ] **Step 2: Run the tests and verify failure**

Run: `pnpm vitest run tests/media-tools.test.ts`

Expected: FAIL because media tool exports do not exist.

- [ ] **Step 3: Implement the media helpers and CLI**

The CLI accepts explicit `--input` and `--output` arguments, creates only the output parent directory, refuses identical input/output paths, and never scans or mutates the source-media directory.

- [ ] **Step 4: Run the media-tool tests**

Run: `pnpm vitest run tests/media-tools.test.ts`

Expected: PASS with temporary files removed by the test.

- [ ] **Step 5: Record source hashes and render the primary air-ground cover source**

Record SHA-256 hashes for the seven undergraduate source files plus `视频.mp4`, `空地智联_新.pptx`, and `空地智联_新.pdf` in a temporary JSON manifest outside the repository; delete it after the before/after comparison. Using the presentation rendering workflow, render slide 1 of `空地智联_新.pptx` to a temporary PNG; the temporary file stays outside the repository. Use PDF page 1 only if PPTX rendering fails, first visually confirm it matches PPTX slide 1, and record that fallback in the QA document rather than silently changing sources.

- [ ] **Step 6: Generate and copy the repository derivatives**

Use the exact source mapping from the spec. Generate WebP covers with a maximum long edge of 1800 px and quality 82; never upscale a source, and use `contain` composition for the low-resolution logistics image. Extract the RoboMaster cover from its video at 1 second. Copy the RoboMaster video and transcode the air-ground video to H.264/AAC with a maximum width of 1280 px, CRF 24, `yuv420p`, even dimensions, and `+faststart`; use the air-ground cover as its poster. Responsive AVIF/WebP variants are generated later by Astro `<Picture>` components from these repository source images rather than committed as hand-maintained duplicates.

- [ ] **Step 7: Verify derivative limits and source immutability**

Run a Sharp metadata check confirming every WebP opens, has nonzero dimensions, no long edge exceeds 1800 px, and neither dimension exceeds its source counterpart. Confirm both MP4 files open through ffmpeg metadata inspection. Require the air-ground output to be H.264 `yuv420p`, at most 1280 px wide with even dimensions, no larger than 20 MiB, and smaller than its source; confirm the RoboMaster copy remains below 10 MiB. Recompute all source hashes and require an exact match with Step 5, then visually inspect the transcoded air-ground video for readable detail and record the chosen compression result in QA.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-lock.yaml scripts/media-tools.mjs scripts/prepare-media.mjs tests/media-tools.test.ts src/content/projects public/media/projects
git commit -m "feat: prepare portfolio media assets"
```

---

### Task 4: Add the seven project records and author placeholders

**Files:**
- Create: `src/content/projects/air-ground-coordination/index.md`
- Create: `src/content/projects/robomaster-hero/index.md`
- Create: `src/content/projects/electric-racing-car/index.md`
- Create: `src/content/projects/logistics-carrier/index.md`
- Create: `src/content/projects/smart-harvesting-car/index.md`
- Create: `src/content/projects/raicom-robot/index.md`
- Create: `src/content/projects/bionic-frog/index.md`
- Create: `tests/project-content.test.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: the schema from Task 2 and media paths from Task 3.
- Produces: exactly seven public collection entries with stable slugs and author-editable Markdown comments.

- [ ] **Step 1: Add `gray-matter` as a test dependency and write the failing manifest test**

Assert the exact slug/stage mapping, graduate status `ongoing`, six undergraduate statuses `completed`, orders `10` for graduate and `10..60` for undergraduate, canonical title `物流搬运机小车`, `contentStatus: placeholder`, unique slugs, non-empty alt text for every configured cover/media item, and resolvable cover/media files. Assert both the template and every project record contain HTML-comment prompts for the exact seven topics 项目成果、项目背景、我的职责、系统设计、核心技术与难点、测试结果、项目复盘.

- [ ] **Step 2: Run the manifest test and verify failure**

Run: `pnpm vitest run tests/project-content.test.ts`

Expected: FAIL because the seven `index.md` files do not exist.

- [ ] **Step 3: Create the seven project records**

Leave `summary`, roles, tech, metrics, and configured links empty. Add non-rendered HTML comments describing exactly where the author writes project outcome, background, responsibility, system design, technical challenges, results, and reflection. Reference both project videos with `/media/projects/<slug>/demo.mp4` site-root-relative values in their `media` arrays, and reference both frog images through Astro image fields.

- [ ] **Step 4: Verify content validity**

Run: `pnpm vitest run tests/project-content.test.ts && pnpm astro check && pnpm build`

Expected: the manifest test passes, Astro accepts all seven records, and the current minimal site builds. Project-route count is intentionally verified in Task 6, after the dynamic route exists.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml src/content/projects tests/project-content.test.ts
git commit -m "content: add graduate and undergraduate projects"
```

---

### Task 5: Implement the responsive shell and grouped homepage

**Files:**
- Create: `src/layouts/BaseLayout.astro`
- Create: `src/components/Header.astro`
- Create: `src/components/Footer.astro`
- Create: `src/components/ConfiguredLink.astro`
- Create: `src/components/ProjectCard.astro`
- Create: `src/components/ProjectGrid.astro`
- Create: `src/styles/global.css`
- Create: `public/favicon.svg`
- Modify: `src/pages/index.astro`
- Test: `tests/homepage-output.test.ts`
- Test: `tests/configured-link.test.ts`

**Interfaces:**
- Consumes: `siteIdentity`, `withBasePath`, `resolveConfiguredHref`, `getProjects`, `groupProjects`, `stageSectionId`, stage/status labels.
- Produces: `ProjectCard.astro` props `{ project: CollectionEntry<"projects"> }`.
- Produces: `ProjectGrid.astro` props `{ title: string; stage: Stage; projects: CollectionEntry<"projects">[] }`.
- Produces: `ConfiguredLink.astro` props `{ href: string; label: string; base?: string }`, rendering nothing for empty input, prefixing site paths, and adding new-tab safety attributes only to HTTPS links.

- [ ] **Step 1: Write the failing built-homepage test**

After a build, parse `dist/index.html` with Cheerio and assert: the default title/direction exist; `#graduate-projects` precedes `#undergraduate-projects`; all seven canonical project links appear once; air-ground shows “进行中”; empty contact links do not exist; `[data-project-summary]` and `[data-project-tech]` do not exist for the empty first-release values; every real cover `<picture>` has a non-empty image `alt` and at least one non-empty source `srcset`; no `href=""`; and the homepage contains no `<video>` or video `<source>` element at all.

- [ ] **Step 2: Write the failing isolated configured-link test**

Use `experimental_AstroContainer.create()` and `renderToString(ConfiguredLink, ...)`. For `{ href: "https://example.com/project", label: "项目仓库", base: "/portfolio" }`, assert the label is visible and the anchor has `target="_blank"` plus both `noopener` and `noreferrer` in `rel`. For `{ href: "/resume/cv.pdf", label: "个人简历", base: "/portfolio" }`, assert `href="/portfolio/resume/cv.pdf"` and no new-tab attributes. An empty `href` fixture renders no anchor.

- [ ] **Step 3: Run both tests and verify failure**

Run: `pnpm build && pnpm vitest run tests/homepage-output.test.ts tests/configured-link.test.ts`

Expected: FAIL because the grouped homepage, semantic selectors, and configured-link component do not exist.

- [ ] **Step 4: Implement the base layout and global visual system**

Use deep graphite surfaces, cool blue emphasis, a warm ongoing-status accent, system Chinese fonts, a skip link, semantic landmarks, visible keyboard focus, and reduced-motion rules. Breakpoints produce one, two, and three card columns without horizontal scrolling. Render all configured footer actions through `ConfiguredLink`. Render cover assets through Astro `<Picture>` with AVIF/WebP output and candidates selected from `480`, `800`, and `1200` px but filtered to widths no larger than the source, always retaining the source width; this supplies responsive `srcset` output without upscaling the logistics image.

- [ ] **Step 5: Implement project cards and grouped homepage sections**

Graduate projects render first, and each stage section uses the stable ID returned by `stageSectionId`. Cards use a consistent media frame, `coverFit: contain` for the low-resolution logistics project, a neutral inline SVG marked `data-cover-fallback` when cover is absent, and explicit `data-project-summary`/`data-project-tech` wrappers only when their values are non-empty. Cards render only cover/poster imagery—never a video element or MP4 source—so large videos cannot load from the homepage.

- [ ] **Step 6: Verify the task**

Run: `pnpm build && pnpm vitest run tests/homepage-output.test.ts tests/configured-link.test.ts && pnpm astro check`

Expected: homepage assertions pass and Astro reports zero errors.

- [ ] **Step 7: Commit**

```bash
git add src/layouts/BaseLayout.astro src/components src/styles/global.css src/pages/index.astro public/favicon.svg tests/homepage-output.test.ts tests/configured-link.test.ts
git commit -m "feat: build grouped portfolio homepage"
```

---

### Task 6: Implement project detail pages and accessible media

**Files:**
- Create: `src/layouts/ProjectLayout.astro`
- Create: `src/components/ProjectFacts.astro`
- Create: `src/components/ProjectMedia.astro`
- Create: `src/components/PlaceholderNotice.astro`
- Create: `src/pages/projects/[slug].astro`
- Test: `tests/project-pages-output.test.ts`

**Interfaces:**
- Consumes: sorted project entries, `sortMedia`, `stageBackHref`, path helpers, content schema media union, status/stage labels, and `ConfiguredLink.astro` from Task 5.
- Produces: one prerendered page per project via `getStaticPaths()`.
- Produces: `ProjectMedia.astro` props `{ media: ProjectMediaItem[]; projectTitle: string; cover?: ImageMetadata; coverAlt?: string }`.
- Produces: `ProjectFacts.astro` props `{ summary?: string; roles: string[]; tech: string[]; metrics: string[] }`, hiding each empty field independently.

- [ ] **Step 1: Write the failing detail-page output test**

Assert exactly seven detail `index.html` files exist; each contains its title, stage, status, and a backlink whose fragment targets its matching `#graduate-projects` or `#undergraduate-projects` homepage section. Placeholder projects contain exactly one “内容整理中” notice, no rendered Markdown body container, none of `[data-project-summary]`, `[data-project-roles]`, `[data-project-tech]`, `[data-project-metrics]`, or their empty section headings, and none of the seven author-only prompt strings. Both videos have `controls`, `playsinline`, `preload="none"`, no `autoplay`, a poster, and a non-empty accessible label derived from their `alt` field. Every real image is inside responsive `<picture>` output with alt text and at least one source `srcset`. The electric racing car, logistics carrier, smart harvesting car, and RAICOM pages each render their cover as detail media despite having an empty `media` array. Empty GitHub/résumé/document links do not render.

- [ ] **Step 2: Run the test and verify failure**

Run: `pnpm build && pnpm vitest run tests/project-pages-output.test.ts`

Expected: FAIL because the dynamic route and detail components do not exist.

- [ ] **Step 3: Implement static path generation and the project layout**

Call `getProjects()` in `getStaticPaths()` so duplicate slug validation is a build invariant, then render project identity and media for all records. Pass `cover` and `coverAlt` to `ProjectMedia`; when `media` is empty, it uses the cover as the sole detail image, and when both are absent it uses the neutral `data-cover-fallback`. For `placeholder`, render only the notice after the facts/media area. For `ready`, render non-empty Markdown inside a body container. Optional summary, fact groups, and links render only when non-empty, with `data-project-summary`, `data-project-roles`, `data-project-tech`, and `data-project-metrics` selectors reserved for visible groups. The backlink uses `stageBackHref(project.data.stage, import.meta.env.BASE_URL)`.

- [ ] **Step 4: Implement responsive media and safe external links**

Sort a copied media array through `sortMedia`. Images preserve the full composition through Astro `<Picture>` with AVIF/WebP widths capped at their source width and use lazy loading below the first item. Videos run their `/media/...` source and poster through base-aware URL handling, use required non-autoplay attributes, and map `media.alt` to a non-empty `aria-label`. Captions render only when non-empty. Route every configured repository/demo/document URL through `ConfiguredLink` so blank values disappear, site paths receive the active base, and HTTPS links have visible labels plus safe attributes.

- [ ] **Step 5: Verify the task**

Run: `pnpm build && pnpm vitest run tests/project-pages-output.test.ts && pnpm astro check`

Expected: all seven pages and media assertions pass with zero Astro errors.

- [ ] **Step 6: Commit**

```bash
git add src/layouts/ProjectLayout.astro src/components/ProjectFacts.astro src/components/ProjectMedia.astro src/components/PlaceholderNotice.astro src/pages/projects tests/project-pages-output.test.ts
git commit -m "feat: add project detail pages"
```

---

### Task 7: Add repository audits, GitHub Pages deployment, and editing documentation

**Files:**
- Create: `scripts/check-built-site.mjs`
- Create: `scripts/resolve-pages-config.mjs`
- Create: `scripts/check-extensibility.mjs`
- Create: `.github/workflows/deploy.yml`
- Create: `README.md`
- Modify: `package.json`
- Test: `tests/built-site-integrity.test.ts`
- Test: `tests/pages-config.test.ts`

**Interfaces:**
- Consumes: production `dist/` from prior tasks and `normalizeBase` from Task 1.
- Produces: `auditBuiltSite(options: { distDir: string; basePath: string }): Promise<{ errors: string[] }>`
- Produces: `auditRepositoryFiles(options: { repoRoot: string }): Promise<{ errors: string[] }>`
- Produces: `resolvePagesConfig(options: { repository: string; siteUrlOverride?: string; basePathOverride?: string }): { siteUrl: string; basePath: string }`
- Produces: `checkExtensibility(options: { repoRoot: string; basePath?: string }): Promise<void>`
- Produces: `pnpm test:output` for the three tests that consume `dist/`, `pnpm test:run` for clean-clone unit/build/output testing, and `pnpm verify` in the exact order unit tests → Astro check → extensibility check → clean seven-project build → output tests → repository/site audit.
- Produces: deploy workflow using `actions/checkout@v7`, `pnpm/action-setup@v6`, `actions/setup-node@v7`, `withastro/action@v6`, and `actions/deploy-pages@v5` with Node 24 and a frozen pnpm lockfile.

- [ ] **Step 1: Write the failing repository and built-site integrity tests**

For built HTML, test every local `href`, image `src/srcset`, video `src/poster`, and canonical URL against `dist`; reject empty URLs, doubled `/portfolio/portfolio/`, `file:` URLs, Windows drive paths, missing/unplanned document references, and external stylesheet, script, font-preload, or font-source requests. For repository safety, create temporary Git repositories and assert a clean tracked-text fixture passes while dynamically assembled drive-path, PEM-key-header, token-like, or credential-assignment fixtures fail; build the sentinel strings from pieces so the test and scanner do not flag their own source. Also assert actual tracked `.pptx`, the named air-ground source PDF, PDF files outside `public/resume/` or `public/media/projects/<slug>/documents/`, `.env*`, or credential-like filenames fail even when their contents are binary.

- [ ] **Step 2: Run the integrity test and verify failure**

Run: `pnpm build && pnpm vitest run tests/built-site-integrity.test.ts`

Expected: FAIL because the shared audit helper does not exist.

- [ ] **Step 3: Implement the repository and built-output audits**

Expose both audit functions for tests and one CLI exit code for CI. `auditRepositoryFiles` obtains the complete publishable file set with `git ls-files --cached --others --exclude-standard`, checks forbidden extensions/names directly, allows deliberate PDFs only below `public/resume/` or `public/media/projects/<slug>/documents/`, skips binary contents only after the filename check, and scans every text file—including README, scripts, tests, and docs—for absolute local paths and credential material. Assemble sensitive sentinel/pattern literals from fragments so the scanner source and fixtures do not self-match. `auditBuiltSite` performs the local-asset/base-path checks and rejects external runtime font, stylesheet, and script dependencies. `pnpm site:audit` runs both audits.

- [ ] **Step 4: Write failing GitHub Pages configuration tests**

Assert `resolvePagesConfig` maps `alice/alice.github.io` to `{ siteUrl: "https://alice.github.io", basePath: "" }`, maps `alice/robotics-portfolio` to `{ siteUrl: "https://alice.github.io", basePath: "/robotics-portfolio" }`, treats a non-empty `siteUrlOverride` as a custom root domain unless an explicit `basePathOverride` is also supplied, and rejects a malformed repository value. Read `.github/workflows/deploy.yml` and assert it configures Node 24, installs with the frozen pnpm lockfile, passes `github.repository` to the resolver, runs the explicit `/portfolio` build/output-test/audit sequence, then passes `steps.pages.outputs.site_url` as `SITE_URL` and `steps.pages.outputs.base_path` as `BASE_PATH` to `withastro/action@v6`.

- [ ] **Step 5: Run the Pages tests and verify failure**

Run: `pnpm vitest run tests/pages-config.test.ts`

Expected: FAIL because the resolver and workflow do not exist.

- [ ] **Step 6: Implement the resolver and GitHub Pages workflow**

`resolvePagesConfig` imports Task 1's `normalizeBase`, trims empty overrides to `undefined`, splits the required `owner/repository` value, treats `<owner>.github.io` case-insensitively as a user-site repository, and normalizes an explicit base with that shared helper. Its CLI reads `GITHUB_REPOSITORY`, `SITE_URL_OVERRIDE`, and `BASE_PATH_OVERRIDE`, then appends `site_url=<value>` and `base_path=<value>` to `GITHUB_OUTPUT`. The workflow maps `${{ github.repository }}`, `${{ vars.SITE_URL }}`, and `${{ vars.BASE_PATH }}` to those three inputs respectively.

Trigger the workflow on `main` and manual dispatch; grant only `contents: read`, `pages: write`, and `id-token: write`; and keep deploy in a separate job. In this exact build-job order: check out the repository; install pnpm 11; install Node 24; run `pnpm install --frozen-lockfile`; run unit tests and Astro check; run the Node-24 resolver using `github.repository` plus optional repository variables `SITE_URL` and `BASE_PATH`; run a `/portfolio` build, output tests, and audit with those test values scoped only to that step; then run `withastro/action@v6` with production `SITE_URL` and `BASE_PATH` taken from the resolver step outputs. Deploy only the artifact returned by that official action via `actions/deploy-pages@v5`; do not add secrets or a hard-coded username.

- [ ] **Step 7: Add the extensibility acceptance check**

Implement `checkExtensibility` with the reserved unique slug `portfolio-extension-check-<pid>-<timestamp>`. Resolve its destination under `src/content/projects`, refuse to run if that exact destination already exists, copy `templates/new-project` with no overwrite, and set `createdByThisRun = true` only after the copy succeeds. Update only the copy to a valid eighth graduate project with `contentStatus: ready`, non-empty summary/roles/tech/metrics, a safe example repository link, no cover/media, and distinctive Markdown body text. Record component-file hashes, build, and assert: its card is inside `#graduate-projects`; summary and technology are visible; the neutral `data-cover-fallback` renders; its detail file exists; detail summary, body, roles, technology, metric, and labelled safe link render; “内容整理中” does not; and no component hash changes. In `finally`, remove the destination only when `createdByThisRun` is true and its resolved parent is exactly the projects directory. Add `pnpm extensibility:check`.

- [ ] **Step 8: Run the new audit, Pages, and extensibility checks**

Define `test:output` as `vitest run` over `homepage-output`, `project-pages-output`, and `built-site-integrity`; define clean-clone `test:run` as unit tests → build → output tests; and define `verify` as unit tests → Astro check → extensibility check → fresh seven-project build → output tests → site/repository audit.

Run: `pnpm test:unit && pnpm astro check && pnpm extensibility:check && pnpm build && pnpm test:output && pnpm site:audit`

Expected: every unit and output test passes; the temporary ready eighth project builds and is removed without touching pre-existing content; the final build contains only the seven real projects; and both audits report no errors.

- [ ] **Step 9: Write the README**

Document exact commands, the site identity edit location, how to fill project Markdown and change `contentStatus`, how to copy the new-project template, how to prepare media without touching originals, the `/media/projects/<slug>/...` public-video convention, the accepted external/mail/site-root-relative link forms, how to choose root vs repository base path, and how to enable GitHub Pages after login.

- [ ] **Step 10: Verify root and subpath builds**

Run root verification: `pnpm verify`

Run subpath verification in PowerShell: `$env:SITE_URL='https://example.test'; $env:BASE_PATH='/portfolio'; $code=0; try { pnpm build; $code=$LASTEXITCODE; if ($code -eq 0) { pnpm test:output; $code=$LASTEXITCODE }; if ($code -eq 0) { pnpm site:audit; $code=$LASTEXITCODE } } finally { Remove-Item Env:SITE_URL -ErrorAction SilentlyContinue; Remove-Item Env:BASE_PATH -ErrorAction SilentlyContinue }; exit $code`

Expected: both commands exit 0; no broken or doubled URLs are reported.

- [ ] **Step 11: Commit**

```bash
git add package.json scripts/check-built-site.mjs scripts/resolve-pages-config.mjs scripts/check-extensibility.mjs .github/workflows/deploy.yml README.md tests/built-site-integrity.test.ts tests/pages-config.test.ts
git commit -m "ci: add GitHub Pages deployment and audits"
```

---

### Task 8: Perform browser QA, privacy review, and final verification

**Files:**
- Create: `docs/qa/2026-10-20-portfolio-qa.md`
- Modify: only files required by observed failures.

**Interfaces:**
- Consumes: complete site, tests, build, and local preview.
- Produces: verified local artifact and a concise QA record; no GitHub publication occurs until the user logs in and confirms the destination repository.

- [ ] **Step 1: Run the complete automated verification from a clean working tree**

Run: `pnpm install --frozen-lockfile && pnpm verify`

Expected: dependency install, tests, Astro check, build, and site audit all exit 0.

- [ ] **Step 2: Start and confirm the local preview**

Start `pnpm preview --host 127.0.0.1 --port 4321` in a retained PTY session. Wait until `http://127.0.0.1:4321/` returns HTTP 200, then open that exact URL in the Codex browser and keep the server session available for the remaining checks.

- [ ] **Step 3: Check responsive layouts**

Inspect 375 px, 768 px, and 1440 px widths. Confirm no horizontal scrolling, graduate-first ordering, one/two/three-column grids, readable full-page detail content, sensible portrait crops, and restrained sizing for the low-resolution logistics image.

At 375 px from a fresh page load, start a 30-second timer and verify a first-time reviewer can identify the robotics/embedded direction, the graduate/undergraduate grouping, the ongoing status of 空地协同, and at least one representative project without opening a detail page. Record the elapsed time and result.

- [ ] **Step 4: Check interaction and accessibility**

Keyboard through skip link, navigation, all cards, video controls, and backlinks; confirm visible focus, meaningful image text/video accessible names, 44 px interactive targets, no autoplay, reduced-motion behavior, and usable contrast. Inspect the browser network log and require zero remote font, stylesheet, icon, or script requests.

- [ ] **Step 5: Review public media disclosure and publication rights**

Inspect all seven covers, the frog gallery image, and both full videos; additionally generate temporary out-of-repository contact sheets sampling each video from start through end. Check for faces/name tags, student IDs, license plates, QR/contact details, credentials, internal UI/source code, customer/lab information, or third-party material that may not be publishable. Remove or redact only repository derivatives when an obvious disclosure is found, never the originals; flag uncertain rights for the user. Record every asset reviewed, findings, and that final public push remains gated on the user's confirmation that team/school/competition media may be published.

- [ ] **Step 6: Perform the public-repository privacy audit**

Run `pnpm site:audit` and confirm its tracked-plus-unignored repository-file scan reports no local absolute path or credential material. Independently inspect `git ls-files`: require zero tracked `*.pptx`, the named air-ground source PDF, PDFs outside the two documented public resume/project-document directories, `.env*`, and credential-like files; documentation may name forbidden extensions but the source documents themselves must be absent. Inspect `git diff --check`, `git status --short`, and the full tracked-file list.

- [ ] **Step 7: Record evidence and route any observed failure back to its owning task**

Write the commands, viewports, results, and any intentional limitations to `docs/qa/2026-10-20-portfolio-qa.md`. If a failure appears, return to the owning task's red-green steps, add or tighten its automated test, implement the minimal fix, verify it, and commit those exact files before resuming QA.

- [ ] **Step 8: Stop the preview cleanly**

Send Ctrl+C to the same retained PTY session and poll it once; require the preview process to exit so no background server is left running.

- [ ] **Step 9: Stage the QA record and run final verification after all fixes**

Stage `docs/qa/2026-10-20-portfolio-qa.md` before verification so the repository audit necessarily includes the final record (the audit also scans untracked non-ignored files). If the record changes afterward, stage it again and rerun verification.

Run: `pnpm verify`

Expected: exit 0 with every test passing, zero Astro errors, successful production build, and clean audit.

- [ ] **Step 10: Commit**

```bash
git add docs/qa/2026-10-20-portfolio-qa.md
git commit -m "test: verify portfolio experience"
```

The next separate publication step is intentionally excluded from implementation: after the user supplies or confirms the GitHub username, authenticate through the browser or local credential helper, create/attach the intended public repository, push `main`, select GitHub Actions as the Pages source, verify the deployed URL, and only then generate the résumé QR code.
