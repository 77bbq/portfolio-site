import { createHash } from "node:crypto";
import {
  access,
  cp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { load } from "cheerio";

import { normalizeBase, withBasePath } from "../src/lib/paths.ts";

const CHECK_TITLE = "扩展性验收项目";
const CHECK_SUMMARY = "验证仅复制项目模板即可加入一项完整作品。";
const CHECK_ROLE = "扩展流程验收";
const CHECK_TECH = "Astro 内容集合";
const CHECK_METRIC = "无需修改组件即可增加第八个项目";
const CHECK_BODY = "扩展性验收正文标记：模板、列表与详情页已经连通。";
const CHECK_LINK = "https://example.com/portfolio-extension-check";

async function pathExists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(target)));
    } else if (entry.isFile()) {
      files.push(target);
    }
  }

  return files;
}

async function hashFiles(root) {
  const hashes = new Map();
  for (const file of await listFiles(root)) {
    const bytes = await readFile(file);
    hashes.set(
      path.relative(root, file).replaceAll(path.sep, "/"),
      createHash("sha256").update(bytes).digest("hex"),
    );
  }
  return hashes;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertHashesEqual(before, after) {
  assert(before.size === after.size, "Component file count changed during the extensibility check");
  for (const [file, digest] of before) {
    assert(after.get(file) === digest, `Component file changed during the check: ${file}`);
  }
}

async function runPnpmScript(repoRoot, script, basePath) {
  const pnpmCli = process.env.npm_execpath;
  const command = pnpmCli ? process.execPath : process.platform === "win32" ? "cmd.exe" : "pnpm";
  const args = pnpmCli
    ? [pnpmCli, script]
    : process.platform === "win32"
      ? ["/d", "/s", "/c", `pnpm ${script}`]
      : [script];

  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: {
        ...process.env,
        BASE_PATH: normalizeBase(basePath),
      },
      stdio: "inherit",
      windowsHide: true,
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Extensibility ${script} failed (${signal ?? `exit ${code}`})`));
    });
  });
}

function projectMarkdown(slug) {
  return `---
title: "${CHECK_TITLE}"
slug: "${slug}"
stage: "graduate"
status: "completed"
order: 9999
contentStatus: "ready"
summary: "${CHECK_SUMMARY}"
coverAlt: ""
roles:
  - "${CHECK_ROLE}"
tech:
  - "${CHECK_TECH}"
metrics:
  - "${CHECK_METRIC}"
media: []
links:
  repository: "${CHECK_LINK}"
  demo: ""
  document: ""
---

## 扩展性验证

${CHECK_BODY}
`;
}

function assertBuiltProject({ homepageHtml, detailHtml, slug, basePath }) {
  const homepage = load(homepageHtml);
  const detail = load(detailHtml);
  const expectedHref = withBasePath(`/projects/${slug}/`, basePath);
  const cardLink = homepage(`#graduate-projects a[href="${expectedHref}"]`);

  assert(cardLink.length === 1, "Temporary project card is not inside the graduate section");
  assert(
    homepage(`#undergraduate-projects a[href="${expectedHref}"]`).length === 0,
    "Temporary graduate project was also rendered in the undergraduate section",
  );
  const card = cardLink.closest("[data-project-card]");
  assert(card.text().includes(CHECK_SUMMARY), "Temporary project summary is missing from its card");
  assert(card.text().includes(CHECK_TECH), "Temporary project technology is missing from its card");
  assert(card.find("[data-cover-fallback]").length === 1, "Temporary project fallback cover is missing");

  const detailText = detail("main").text();
  assert(detailText.includes(CHECK_TITLE), "Temporary detail title is missing");
  assert(detailText.includes(CHECK_SUMMARY), "Temporary detail summary is missing");
  assert(detailText.includes(CHECK_BODY), "Temporary detail body is missing");
  assert(detailText.includes(CHECK_ROLE), "Temporary detail role is missing");
  assert(detailText.includes(CHECK_TECH), "Temporary detail technology is missing");
  assert(detailText.includes(CHECK_METRIC), "Temporary detail metric is missing");
  assert(!detailText.includes("内容整理中"), "Ready project incorrectly renders the placeholder notice");
  for (const selector of [
    "[data-project-summary]",
    "[data-project-roles]",
    "[data-project-tech]",
    "[data-project-metrics]",
    "[data-project-body]",
  ]) {
    assert(detail(selector).length === 1, `Temporary detail section is missing: ${selector}`);
  }
  assert(detail("[data-placeholder-notice]").length === 0, "Ready project has a placeholder element");
  assert(detail("[data-cover-fallback]").length === 1, "Temporary detail fallback cover is missing");

  const repositoryLink = detail(`a[data-configured-link][href="${CHECK_LINK}"]`);
  assert(repositoryLink.length === 1, "Temporary detail repository link is missing");
  assert(repositoryLink.text().includes("项目仓库"), "Temporary repository link is not labelled");
}

export async function checkExtensibility({ repoRoot, basePath = "" }) {
  const root = path.resolve(repoRoot);
  const projectsRoot = path.resolve(root, "src", "content", "projects");
  const templateRoot = path.resolve(root, "templates", "new-project");
  const componentsRoot = path.resolve(root, "src", "components");
  const distRoot = path.resolve(root, "dist");
  const slug = `portfolio-extension-check-${process.pid}-${Date.now()}`;
  const destination = path.resolve(projectsRoot, slug);
  let createdByThisRun = false;

  assert(path.dirname(destination) === projectsRoot, "Refusing an unsafe project destination");
  assert(await pathExists(templateRoot), "The new-project template is missing");
  assert(!(await pathExists(destination)), `Reserved project destination already exists: ${destination}`);

  const componentHashes = await hashFiles(componentsRoot);

  try {
    await cp(templateRoot, destination, {
      recursive: true,
      force: false,
      errorOnExist: true,
    });
    createdByThisRun = true;
    await writeFile(path.join(destination, "index.md"), projectMarkdown(slug), "utf8");

    await runPnpmScript(root, "test:unit", basePath);
    await runPnpmScript(root, "build", basePath);
    await runPnpmScript(root, "test:output", basePath);

    const homepagePath = path.join(distRoot, "index.html");
    const detailPath = path.join(distRoot, "projects", slug, "index.html");
    assert(await pathExists(detailPath), "Temporary project detail file was not built");

    const [homepageHtml, detailHtml, componentHashesAfter] = await Promise.all([
      readFile(homepagePath, "utf8"),
      readFile(detailPath, "utf8"),
      hashFiles(componentsRoot),
    ]);
    assertBuiltProject({ homepageHtml, detailHtml, slug, basePath });
    assertHashesEqual(componentHashes, componentHashesAfter);
  } finally {
    if (createdByThisRun) {
      const destinationInfo = await stat(destination).catch(() => undefined);
      assert(path.dirname(destination) === projectsRoot, "Refusing unsafe extensibility cleanup");
      if (destinationInfo?.isDirectory()) {
        await rm(destination, { recursive: true, force: false });
      }
    }
  }
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  checkExtensibility({
    repoRoot: process.cwd(),
    basePath: process.env.BASE_PATH,
  })
    .then(() => console.log("Extensibility check passed and temporary project was removed."))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
