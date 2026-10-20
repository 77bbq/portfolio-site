import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { resolvePagesConfig } from "../scripts/resolve-pages-config.mjs";

describe("resolvePagesConfig", () => {
  it("maps a GitHub user-site repository to the root", () => {
    expect(resolvePagesConfig({ repository: "alice/alice.github.io" })).toEqual({
      siteUrl: "https://alice.github.io",
      basePath: "",
    });
  });

  it("maps a project repository to its repository base", () => {
    expect(resolvePagesConfig({ repository: "alice/robotics-portfolio" })).toEqual({
      siteUrl: "https://alice.github.io",
      basePath: "/robotics-portfolio",
    });
  });

  it("treats a site override as a custom root domain", () => {
    expect(
      resolvePagesConfig({
        repository: "alice/robotics-portfolio",
        siteUrlOverride: " https://portfolio.example.com/ ",
      }),
    ).toEqual({ siteUrl: "https://portfolio.example.com", basePath: "" });

    expect(() =>
      resolvePagesConfig({
        repository: "alice/robotics-portfolio",
        siteUrlOverride: "https://portfolio.example.com",
        basePathOverride: "showcase/",
      }),
    ).toThrow(/custom domain.*base/i);

    expect(
      resolvePagesConfig({
        repository: "alice/robotics-portfolio",
        siteUrlOverride: "https://portfolio.example.com",
        basePathOverride: "/",
      }),
    ).toEqual({ siteUrl: "https://portfolio.example.com", basePath: "" });
  });

  it("accepts GitHub repository punctuation and rejects unsafe base values", () => {
    expect(resolvePagesConfig({ repository: "alice/.github" }).basePath).toBe("/.github");
    expect(resolvePagesConfig({ repository: "alice/_portfolio" }).basePath).toBe(
      "/_portfolio",
    );
    expect(() =>
      resolvePagesConfig({
        repository: "alice/robotics-portfolio",
        basePathOverride: "portfolio\nsite_url=https://evil.example",
      }),
    ).toThrow(/base_path/i);
  });

  it.each(["alice", "alice/repo/extra", "/repo", "owner/", "owner name/repo"])(
    "rejects malformed repository value %s",
    (repository) => {
      expect(() => resolvePagesConfig({ repository })).toThrow(/repository/i);
    },
  );
});

describe("GitHub Pages workflow", () => {
  it("pins official actions, scopes least privilege, and separates deployment", async () => {
    const workflow = await readFile(
      path.resolve(".github", "workflows", "deploy.yml"),
      "utf8",
    );

    const pinnedActions = [
      ["actions/checkout", "v7"],
      ["pnpm/action-setup", "v6"],
      ["actions/setup-node", "v7"],
      ["withastro/action", "v6"],
      ["actions/deploy-pages", "v5"],
    ];
    for (const [action, version] of pinnedActions) {
      const escapedAction = action.replace("/", "\\/");
      expect(workflow).toMatch(
        new RegExp(`uses:\\s*${escapedAction}@[a-f0-9]{40}\\s+#\\s*${version}`),
      );
    }
    expect(workflow).toMatch(/node-version:\s*["']?24["']?/);
    expect(workflow).toMatch(/version:\s*["']?11["']?/);
    expect(workflow).toContain("pnpm install --frozen-lockfile");
    expect(workflow).toMatch(/^permissions:\s*\{\}/m);
    expect(workflow).toMatch(/\n\s{2}build:/);
    expect(workflow).toMatch(/\n\s{2}deploy:/);

    const buildJob = workflow.slice(workflow.indexOf("  build:"), workflow.indexOf("  deploy:"));
    const deployJob = workflow.slice(workflow.indexOf("  deploy:"));
    expect(buildJob).toMatch(/permissions:\s*\n\s+contents:\s*read/);
    expect(buildJob).not.toMatch(/pages:\s*write|id-token:\s*write/);
    expect(deployJob).toMatch(/permissions:\s*\n\s+pages:\s*write\s*\n\s+id-token:\s*write/);
    expect(deployJob).not.toMatch(/contents:\s*write/);
  });

  it("resolves production Pages values and performs an explicit subpath gate", async () => {
    const workflow = await readFile(
      path.resolve(".github", "workflows", "deploy.yml"),
      "utf8",
    );

    expect(workflow).toContain("GITHUB_REPOSITORY: ${{ github.repository }}");
    expect(workflow).toContain("SITE_URL_OVERRIDE: ${{ vars.SITE_URL }}");
    expect(workflow).toContain("BASE_PATH_OVERRIDE: ${{ vars.BASE_PATH }}");
    expect(workflow).toContain("node scripts/resolve-pages-config.mjs");
    expect(workflow).toContain("SITE_URL: https://example.test");
    expect(workflow).toContain("BASE_PATH: /portfolio");
    expect(workflow).toContain("pnpm test:output");
    expect(workflow).toContain("pnpm site:audit");
    expect(workflow).toContain("SITE_URL: ${{ steps.pages.outputs.site_url }}");
    expect(workflow).toContain("BASE_PATH: ${{ steps.pages.outputs.base_path }}");
    expect(workflow).toContain(
      'build-cmd: "pnpm build && pnpm test:output && pnpm site:audit"',
    );

    const order = [
      "actions/checkout@",
      "pnpm/action-setup@",
      "actions/setup-node@",
      "pnpm install --frozen-lockfile",
      "pnpm test:unit",
      "node scripts/resolve-pages-config.mjs",
      "SITE_URL: https://example.test",
      "withastro/action@",
    ].map((needle) => workflow.indexOf(needle));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((left, right) => left - right)).toEqual(order);
  });

  it("triggers on main and manual dispatch without secrets or a username", async () => {
    const workflow = await readFile(
      path.resolve(".github", "workflows", "deploy.yml"),
      "utf8",
    );

    expect(workflow).toMatch(/branches:\s*\[?main\]?/);
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toContain("secrets.");
    expect(workflow).not.toMatch(/https:\/\/[A-Za-z0-9-]+\.github\.io/);
    expect(workflow).toContain("needs: build");
  });
});
