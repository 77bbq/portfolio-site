import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import {
  auditBuiltSite,
  auditRepositoryFiles,
} from "../scripts/check-built-site.mjs";

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function temporaryDirectory(prefix: string): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

async function createRepository(
  files: Record<string, string | Buffer>,
): Promise<string> {
  const repository = await temporaryDirectory("portfolio-audit-repo-");
  await execFileAsync("git", ["init", "--quiet"], { cwd: repository });

  for (const [relativePath, contents] of Object.entries(files)) {
    const destination = path.join(repository, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, contents);
  }

  return repository;
}

async function createBuiltSite(
  html: string,
  files: Record<string, string | Buffer> = {},
): Promise<string> {
  const dist = await temporaryDirectory("portfolio-built-site-");
  await writeFile(path.join(dist, "index.html"), html);
  for (const [relativePath, contents] of Object.entries(files)) {
    const destination = path.join(dist, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, contents);
  }
  return dist;
}

describe("auditBuiltSite", () => {
  it("accepts the complete production build", async () => {
    const result = await auditBuiltSite({
      distDir: path.resolve("dist"),
      basePath: process.env.BASE_PATH ?? "",
    });

    expect(result.errors).toEqual([]);
  });

  it("checks local links, images, srcsets, videos, posters, and canonical paths", async () => {
    const dist = await temporaryDirectory("portfolio-built-site-");
    await mkdir(path.join(dist, "assets"), { recursive: true });
    await mkdir(path.join(dist, "projects", "demo"), { recursive: true });
    await writeFile(path.join(dist, "assets", "image.webp"), "image");
    await writeFile(path.join(dist, "assets", "video.mp4"), "video");
    await writeFile(path.join(dist, "projects", "demo", "index.html"), "demo");
    await writeFile(
      path.join(dist, "index.html"),
      `<!doctype html><html><head>
        <link rel="canonical" href="https://example.test/portfolio/">
      </head><body>
        <a href="/portfolio/projects/demo/">demo</a>
        <picture><source srcset="/portfolio/assets/image.webp 1x"><img src="/portfolio/assets/image.webp" alt="demo"></picture>
        <video src="/portfolio/assets/video.mp4" poster="/portfolio/assets/image.webp"></video>
      </body></html>`,
    );

    const result = await auditBuiltSite({
      distDir: dist,
      basePath: "/portfolio",
      siteUrl: "https://example.test",
    });
    expect(result.errors).toEqual([]);
  });

  it("rejects unsafe, doubled, missing, or unplanned built URLs", async () => {
    const dist = await temporaryDirectory("portfolio-broken-site-");
    const fileUrl = ["fi", "le:///tmp/private.png"].join("");
    const drivePath = ["C", ":", "\\", "Users", "\\", "private.png"].join("");
    await writeFile(
      path.join(dist, "index.html"),
      `<!doctype html><html><head>
        <link rel="stylesheet" href="https://cdn.example.test/site.css">
        <link rel="preload" as="font" href="https://cdn.example.test/font.woff2">
        <script src="https://cdn.example.test/app.js"></script>
      </head><body>
        <a href="">empty</a>
        <a href="/portfolio/portfolio/missing/">doubled</a>
        <img src="${fileUrl}" alt="file">
        <img src="${drivePath}" alt="drive">
        <a href="/portfolio/private.pdf">document</a>
        <video src="/portfolio/missing.mp4" poster="/portfolio/missing.webp"></video>
      </body></html>`,
    );

    const { errors } = await auditBuiltSite({ distDir: dist, basePath: "/portfolio" });
    expect(errors.join("\n")).toMatch(/empty/i);
    expect(errors.join("\n")).toContain("/portfolio/portfolio/");
    expect(errors.join("\n")).toMatch(/file:/i);
    expect(errors.join("\n")).toMatch(/drive|absolute local/i);
    expect(errors.join("\n")).toMatch(/document/i);
    expect(errors.join("\n")).toMatch(/missing/i);
    expect(errors.join("\n")).toMatch(/external runtime/i);
  });

  it.each([
    [
      "missing local stylesheet",
      '<link rel="stylesheet" href="/portfolio/missing.css">',
      {},
      /missing local target/i,
    ],
    [
      "protocol-relative script",
      '<script src="//cdn.example.test/app.js"></script>',
      {},
      /protocol-relative|external runtime/i,
    ],
    [
      "uppercase external script",
      '<script src="HTTPS://cdn.example.test/app.js"></script>',
      {},
      /external runtime/i,
    ],
    [
      "protocol-relative CSS asset",
      '<link rel="stylesheet" href="/portfolio/site.css">',
      { "site.css": "body { background: url(//cdn.example.test/a.png); }" },
      /protocol-relative|external runtime/i,
    ],
  ])("rejects %s independently", async (_label, markup, files, expected) => {
    const dist = await createBuiltSite(`<!doctype html><html><head>${markup}</head></html>`, files);
    const { errors } = await auditBuiltSite({ distDir: dist, basePath: "/portfolio" });
    expect(errors.join("\n")).toMatch(expected);
  });

  it("resolves relative links from the containing document", async () => {
    const dist = await createBuiltSite("<!doctype html><html></html>", {
      "sibling/index.html": "wrong location",
      "projects/demo/index.html": '<a href="sibling/">nested sibling</a>',
    });

    const { errors } = await auditBuiltSite({ distDir: dist, basePath: "" });
    expect(errors.join("\n")).toMatch(/projects\/demo\/sibling|missing local target/i);
  });

  it("rejects backslash URLs and a foreign canonical origin", async () => {
    const backslashUrl = ["\\", "\\", "evil.example", "\\", "portfolio", "\\", "target/"].join("");
    const dist = await createBuiltSite(`<!doctype html><html><head>
      <link rel="canonical" href="https://evil.example/portfolio/">
    </head><body><a href="${backslashUrl}">bad</a></body></html>`);

    const { errors } = await auditBuiltSite({
      distDir: dist,
      basePath: "/portfolio",
      siteUrl: "https://example.test",
    });
    expect(errors.join("\n")).toMatch(/backslash/i);
    expect(errors.join("\n")).toMatch(/canonical origin/i);
  });

  it("reports encoded documents and malformed URL escapes without throwing", async () => {
    const dist = await createBuiltSite(`<!doctype html><html><body>
      <a href="/portfolio/private%2Epdf">encoded</a>
      <a href="/portfolio/bad%">malformed</a>
    </body></html>`, { "private.pdf": "private" });

    const { errors } = await auditBuiltSite({ distDir: dist, basePath: "/portfolio" });
    expect(errors.join("\n")).toMatch(/document/i);
    expect(errors.join("\n")).toMatch(/malformed|encoding/i);
  });

  it("requires exact filename case for GitHub Pages", async () => {
    const dist = await createBuiltSite(
      '<!doctype html><html><body><img src="/portfolio/assets/image.webp" alt="case"></body></html>',
      { "assets/Image.webp": "image" },
    );

    const { errors } = await auditBuiltSite({ distDir: dist, basePath: "/portfolio" });
    expect(errors.join("\n")).toMatch(/missing local target|case/i);
  });
});

describe("auditRepositoryFiles", () => {
  it("accepts clean tracked and untracked publishable files", async () => {
    const repository = await createRepository({
      "README.md": "Safe portfolio documentation.",
      "public/resume/cv.pdf": Buffer.from([0, 1, 2, 3]),
      "public/media/projects/demo/documents/spec.pdf": Buffer.from([0, 1, 2, 3]),
    });

    const result = await auditRepositoryFiles({ repoRoot: repository });
    expect(result.errors).toEqual([]);
  });

  it.each([
    [
      "absolute drive path",
      () => ["C", ":", "\\", "Users", "\\", "owner", "\\", "secret.txt"].join(""),
    ],
    [
      "private key header",
      () => ["-----BEGIN ", "PRIVATE ", "KEY-----", "\nprivate-data"].join(""),
    ],
    ["token-like value", () => ["gh", "p_", "A".repeat(40)].join("")],
    [
      "credential assignment",
      () => ["pass", "word", " = ", "correct-horse-battery-staple"].join(""),
    ],
    [
      "prefixed credential assignment",
      () => [["WIFI", "PASSWORD"].join("_"), "=", "correct-horse-battery-staple"].join(""),
    ],
    [
      "escaped Windows drive path",
      () => ["C", ":", "\\\\", "Users", "\\\\", "owner", "\\\\", "secret.txt"].join(""),
    ],
    [
      "PGP private key header",
      () => ["-----BEGIN ", "PGP ", "PRIVATE ", "KEY BLOCK-----"].join(""),
    ],
  ])("rejects text containing %s", async (_label, fixture) => {
    const repository = await createRepository({ "unsafe.txt": fixture() });

    const { errors } = await auditRepositoryFiles({ repoRoot: repository });
    expect(errors).not.toEqual([]);
  });

  it.each([
    ["slides/deck.pptx", Buffer.from([0, 1, 2])],
    ["空地智联_新.pdf", Buffer.from([0, 1, 2])],
    ["notes.pdf", Buffer.from([0, 1, 2])],
    [".env.local", "SAFE=false"],
    ["config/private-key.pem", Buffer.from([0, 1, 2])],
    ["config/github-token.txt", Buffer.from([0, 1, 2])],
    ["resume/cv.pdf", Buffer.from([0, 1, 2])],
  ])("rejects forbidden file name %s before binary scanning", async (file, contents) => {
    const repository = await createRepository({ [file]: contents });

    const { errors } = await auditRepositoryFiles({ repoRoot: repository });
    expect(errors).not.toEqual([]);
  });

  it.each(["src/tokenizer.ts", "styles/design-tokens.css"])(
    "does not reject an ordinary filename containing a credential substring: %s",
    async (file) => {
      const repository = await createRepository({ [file]: "safe" });
      const { errors } = await auditRepositoryFiles({ repoRoot: repository });
      expect(errors).toEqual([]);
    },
  );

  it("accepts the actual publishable repository set", async () => {
    const result = await auditRepositoryFiles({ repoRoot: path.resolve(".") });
    expect(result.errors).toEqual([]);
  });
});
