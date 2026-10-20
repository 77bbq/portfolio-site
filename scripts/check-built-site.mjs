import { execFile } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { load } from "cheerio";

import { normalizeBase } from "../src/lib/paths.ts";

const execFileAsync = promisify(execFile);
const windowsDrivePattern = /(?:^|[\s"'=(])([A-Za-z]:[\\/](?![\\/])[^\s"'<>]*)/;
const posixHomePattern = /(?:^|[\s"'=(])(\/(?:Users|home)\/[^\s"'<>/]+\/[^\s"'<>]*)/;
const protocolPattern = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const documentPattern = /\.(?:pdf|pptx?|docx?|xlsx?)(?:$|[?#])/i;

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(absolutePath)));
    } else if (entry.isFile()) {
      files.push(absolutePath);
    }
  }

  return files;
}

function srcsetUrls(value) {
  return value
    .split(",")
    .map((candidate) => candidate.trim().split(/\s+/, 1)[0])
    .filter(Boolean);
}

function stripBase(pathname, basePath) {
  const base = normalizeBase(basePath);
  if (!base) {
    return pathname;
  }
  if (pathname === base) {
    return "/";
  }
  if (!pathname.startsWith(`${base}/`)) {
    return null;
  }
  return pathname.slice(base.length) || "/";
}

function isAllowedDocument(pathname) {
  const normalized = pathname.replace(/\\/g, "/");
  if (!/\.pdf$/i.test(normalized)) {
    return false;
  }
  return (
    /^\/resume\/[^/]+\.pdf$/i.test(normalized) ||
    /^\/media\/projects\/[^/]+\/documents\/[^/]+\.pdf$/i.test(normalized)
  );
}

function targetExists(fileInventory, pathname) {
  let relative = pathname.replace(/^\/+/, "");
  if (!relative || relative.endsWith("/")) {
    relative = path.posix.join(relative, "index.html");
  }

  if (
    relative.startsWith("../") ||
    relative.includes("/../") ||
    relative === ".."
  ) {
    return false;
  }

  if (fileInventory.has(relative)) {
    return true;
  }
  return !path.posix.extname(relative) && fileInventory.has(`${relative}/index.html`);
}

function deployedPath(distDir, sourcePath, basePath) {
  const relative = path.relative(distDir, sourcePath).replace(/\\/g, "/");
  const normalizedBase = normalizeBase(basePath);
  let pathname = `/${relative}`;
  if (pathname.endsWith("/index.html")) {
    pathname = pathname.slice(0, -"index.html".length);
  } else if (pathname === "/index.html") {
    pathname = "/";
  }
  return `${normalizedBase}${pathname}` || "/";
}

async function validateBuiltUrl({
  value,
  attribute,
  sourcePath,
  sourceUrlPath,
  distDir,
  basePath,
  fileInventory,
  canonical = false,
  mustBeLocal = false,
  siteUrl,
}) {
  const errors = [];
  const trimmed = value.trim();
  const source = path.relative(distDir, sourcePath).replace(/\\/g, "/");

  if (!trimmed) {
    return [`${source}: empty ${attribute}`];
  }
  if (/^file:/i.test(trimmed)) {
    return [`${source}: file: URL in ${attribute}: ${trimmed}`];
  }
  if (windowsDrivePattern.test(trimmed)) {
    return [`${source}: absolute local drive path in ${attribute}: ${trimmed}`];
  }
  if (trimmed.includes("\\")) {
    return [`${source}: backslash URL in ${attribute}: ${trimmed}`];
  }
  if (trimmed.startsWith("//")) {
    return [`${source}: protocol-relative URL in ${attribute}: ${trimmed}`];
  }
  if (/^(?:mailto|tel):/i.test(trimmed) || /^data:/i.test(trimmed)) {
    return errors;
  }
  if (trimmed.startsWith("#")) {
    return errors;
  }

  if (protocolPattern.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    return [`${source}: unsupported URL protocol in ${attribute}: ${trimmed}`];
  }

  const auditOrigin = "https://audit.invalid";
  let resolved;
  try {
    resolved = new URL(trimmed, `${auditOrigin}${sourceUrlPath}`);
  } catch {
    return [`${source}: malformed URL in ${attribute}: ${trimmed}`];
  }

  if (canonical) {
    if (!/^https:\/\//i.test(trimmed)) {
      errors.push(`${source}: canonical URL must be absolute HTTPS: ${trimmed}`);
    }
    if (siteUrl) {
      let expectedOrigin;
      try {
        expectedOrigin = new URL(siteUrl).origin;
      } catch {
        return [`${source}: invalid expected SITE_URL: ${siteUrl}`];
      }
      if (resolved.origin !== expectedOrigin) {
        errors.push(
          `${source}: canonical origin ${resolved.origin} does not match ${expectedOrigin}`,
        );
      }
    }
  } else if (resolved.origin !== auditOrigin) {
    if (resolved.protocol !== "https:") {
      errors.push(`${source}: insecure external URL in ${attribute}: ${trimmed}`);
    } else if (mustBeLocal) {
      errors.push(`${source}: external runtime asset in ${attribute}: ${trimmed}`);
    }
    return errors;
  }

  if (/%(?:2f|5c)/i.test(resolved.pathname)) {
    errors.push(`${source}: encoded path separator in ${attribute}: ${trimmed}`);
    return errors;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(resolved.pathname);
  } catch {
    errors.push(`${source}: malformed URL encoding in ${attribute}: ${trimmed}`);
    return errors;
  }
  if (pathname.includes("\\")) {
    errors.push(`${source}: backslash URL in ${attribute}: ${trimmed}`);
    return errors;
  }

  const normalizedBase = normalizeBase(basePath);
  if (normalizedBase && pathname.includes(`${normalizedBase}${normalizedBase}/`)) {
    errors.push(`${source}: doubled base path in ${attribute}: ${pathname}`);
  }

  const withoutBase = stripBase(pathname, normalizedBase);
  if (withoutBase === null) {
    errors.push(`${source}: local URL does not use base ${normalizedBase}: ${pathname}`);
    return errors;
  }
  pathname = withoutBase;

  if (documentPattern.test(pathname) && !isAllowedDocument(pathname)) {
    errors.push(`${source}: unplanned document reference in ${attribute}: ${pathname}`);
  }
  if (!targetExists(fileInventory, pathname)) {
    errors.push(`${source}: missing local target in ${attribute}: ${pathname}`);
  }

  return errors;
}

function cssUrls(css) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const urls = new Set();
  const urlPattern = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/gi;
  const importPattern = /@import\s+(?:url\(\s*)?(?:"([^"]*)"|'([^']*)'|([^\s);]+))/gi;

  for (const pattern of [urlPattern, importPattern]) {
    let match;
    while ((match = pattern.exec(withoutComments)) !== null) {
      const value = match[1] ?? match[2] ?? match[3] ?? "";
      if (value) {
        urls.add(value);
      }
    }
  }

  return [...urls];
}

/**
 * @param {{ distDir: string; basePath: string; siteUrl?: string }} options
 */
export async function auditBuiltSite({ distDir, basePath, siteUrl }) {
  const root = path.resolve(distDir);
  const errors = [];
  let files;

  try {
    files = await walk(root);
  } catch (error) {
    return { errors: [`Unable to scan dist directory: ${error.message}`] };
  }

  const htmlFiles = files.filter((file) => file.toLowerCase().endsWith(".html"));
  const fileInventory = new Set(
    files.map((file) => path.relative(root, file).replace(/\\/g, "/")),
  );
  if (htmlFiles.length === 0) {
    errors.push("No built HTML files found");
  }

  for (const htmlPath of htmlFiles) {
    const html = await readFile(htmlPath, "utf8");
    const $ = load(html);
    const checks = [];
    const sourceUrlPath = deployedPath(root, htmlPath, basePath);

    $("a[href]").each((_, element) => {
      checks.push({ value: $(element).attr("href") ?? "", attribute: "href" });
    });
    $("img[src], video[src], video[poster], source[src]").each((_, element) => {
      for (const attribute of ["src", "poster"]) {
        if ($(element).attr(attribute) !== undefined) {
          checks.push({
            value: $(element).attr(attribute) ?? "",
            attribute,
            mustBeLocal: true,
          });
        }
      }
    });
    $("img[srcset], source[srcset]").each((_, element) => {
      for (const value of srcsetUrls($(element).attr("srcset") ?? "")) {
        checks.push({ value, attribute: "srcset", mustBeLocal: true });
      }
    });
    $("script[src]").each((_, element) => {
      checks.push({
        value: $(element).attr("src") ?? "",
        attribute: "script src",
        mustBeLocal: true,
      });
    });
    $('link[href]:not([rel="canonical"])').each((_, element) => {
      checks.push({
        value: $(element).attr("href") ?? "",
        attribute: "link href",
        mustBeLocal: true,
      });
    });
    $('link[rel="canonical"][href]').each((_, element) => {
      checks.push({
        value: $(element).attr("href") ?? "",
        attribute: "canonical",
        canonical: true,
      });
    });

    for (const check of checks) {
      errors.push(
        ...(await validateBuiltUrl({
          ...check,
          sourcePath: htmlPath,
          sourceUrlPath,
          distDir: root,
          basePath,
          fileInventory,
          siteUrl,
        })),
      );
    }
  }

  for (const cssPath of files.filter((file) => file.toLowerCase().endsWith(".css"))) {
    const css = await readFile(cssPath, "utf8");
    const sourceUrlPath = deployedPath(root, cssPath, basePath);
    for (const value of cssUrls(css)) {
      errors.push(
        ...(await validateBuiltUrl({
          value,
          attribute: "CSS URL",
          sourcePath: cssPath,
          sourceUrlPath,
          distDir: root,
          basePath,
          fileInventory,
          mustBeLocal: true,
          siteUrl,
        })),
      );
    }
  }

  return { errors: [...new Set(errors)] };
}

function forbiddenFilename(relativePath) {
  const normalized = relativePath.replace(/\\/g, "/");
  const basename = path.posix.basename(normalized);
  const lower = basename.toLowerCase();

  if (/\.(?:pptx?|pptm|ppsx|potx)$/i.test(basename)) {
    return "presentation source files are not publishable";
  }
  if (lower === "空地智联_新.pdf".toLowerCase()) {
    return "the air-ground source PDF is not publishable";
  }
  if (/\.pdf$/i.test(basename)) {
    if (!normalized.startsWith("public/")) {
      return "PDF is outside an approved public document directory";
    }
    const publicPath = `/${normalized.slice("public/".length)}`;
    if (!isAllowedDocument(publicPath)) {
      return "PDF is outside an approved public document directory";
    }
  }
  if (/^\.env(?:\..+)?$/i.test(basename)) {
    return "environment files are not publishable";
  }
  if (
    /(?:^|[._-])(?:credentials?|secrets?|token|private[-_]?key|id[-_]?rsa)(?:[._-]|$)/i.test(
      basename,
    )
  ) {
    return "credential-like filename is not publishable";
  }

  return null;
}

function textSafetyErrors(text) {
  const errors = [];
  const collapsedEscapes = text.replaceAll("\\\\", "\\");
  const uncPathPattern = /(?:^|[\s"'=(])\\\\[^\\\s"'<>]+\\[^\\\s"'<>]+/;
  const fileUrlPattern = new RegExp(["fi", "le", ":", "/{2}"].join(""), "i");
  if (
    windowsDrivePattern.test(text) ||
    windowsDrivePattern.test(collapsedEscapes) ||
    uncPathPattern.test(text) ||
    uncPathPattern.test(collapsedEscapes) ||
    posixHomePattern.test(text) ||
    fileUrlPattern.test(text)
  ) {
    errors.push("absolute local path");
  }

  const privateKeyPattern = new RegExp(
    [
      "-----BEGIN ",
      "(?:(?:RSA|EC|DSA|OPENSSH|ENCRYPTED|PGP) )?",
      "PRIVATE ",
      "KEY(?: BLOCK)?-----",
    ].join(""),
    "i",
  );
  const githubTokenPattern = new RegExp(
    ["(?:", "gh", "[pousr]_|github_pat_", ")", "[A-Za-z0-9_]{20,}"].join(""),
  );
  const credentialNames = [
    ["pass", "word"].join(""),
    "passwd",
    ["sec", "ret"].join(""),
    "api[_-]?key",
    "access[_-]?token",
    "client[_-]?secret",
    "private[_-]?key",
  ].join("|");
  const credentialAssignmentPattern = new RegExp(
    `\\b(?:[A-Za-z0-9]+[_-])*(?:${credentialNames})\\b\\s*[:=]\\s*["']?[^\\s"']{8,}`,
    "i",
  );

  if (privateKeyPattern.test(text)) {
    errors.push("private key material");
  }
  if (githubTokenPattern.test(text)) {
    errors.push("token-like value");
  }
  if (credentialAssignmentPattern.test(text)) {
    errors.push("credential assignment");
  }
  return errors;
}

function decodeText(buffer) {
  if (buffer.includes(0)) {
    return null;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return null;
  }
}

export async function auditRepositoryFiles({ repoRoot }) {
  const root = path.resolve(repoRoot);
  const errors = [];
  let output;

  try {
    ({ stdout: output } = await execFileAsync(
      "git",
      ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
      { cwd: root, encoding: "buffer", maxBuffer: 20 * 1024 * 1024 },
    ));
  } catch (error) {
    return { errors: [`Unable to enumerate repository files: ${error.message}`] };
  }

  const files = output
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .sort();

  for (const relativePath of files) {
    const filenameError = forbiddenFilename(relativePath);
    if (filenameError) {
      errors.push(`${relativePath}: ${filenameError}`);
      continue;
    }

    const absolutePath = path.resolve(root, ...relativePath.split("/"));
    if (absolutePath !== root && !absolutePath.startsWith(`${root}${path.sep}`)) {
      errors.push(`${relativePath}: path escapes repository root`);
      continue;
    }

    let buffer;
    try {
      buffer = await readFile(absolutePath);
    } catch (error) {
      errors.push(`${relativePath}: unreadable (${error.message})`);
      continue;
    }

    const text = decodeText(buffer);
    if (text === null) {
      continue;
    }
    for (const finding of textSafetyErrors(text)) {
      errors.push(`${relativePath}: ${finding}`);
    }
  }

  return { errors: [...new Set(errors)] };
}

async function runCli() {
  const repoRoot = process.cwd();
  const built = await auditBuiltSite({
    distDir: path.join(repoRoot, "dist"),
    basePath: process.env.BASE_PATH ?? "",
    siteUrl: process.env.SITE_URL,
  });
  const repository = await auditRepositoryFiles({ repoRoot });
  const errors = [...built.errors, ...repository.errors];

  if (errors.length > 0) {
    console.error(errors.map((error) => `- ${error}`).join("\n"));
    process.exitCode = 1;
    return;
  }

  console.log("Site and repository audit passed.");
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
