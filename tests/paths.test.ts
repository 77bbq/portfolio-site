import { describe, expect, it } from "vitest";

import {
  normalizeBase,
  resolveConfiguredHref,
  withBasePath,
} from "../src/lib/paths";

describe("normalizeBase", () => {
  it("normalizes an empty or root base", () => {
    expect(normalizeBase(undefined)).toBe("");
    expect(normalizeBase("/")).toBe("");
  });

  it("normalizes a repository base", () => {
    expect(normalizeBase("portfolio")).toBe("/portfolio");
    expect(normalizeBase("/portfolio/")).toBe("/portfolio");
  });
});

describe("withBasePath", () => {
  it("prefixes a site path exactly once", () => {
    expect(withBasePath("/projects/demo/", "/portfolio/")).toBe(
      "/portfolio/projects/demo/",
    );
    expect(withBasePath("/portfolio/projects/demo/", "/portfolio/")).toBe(
      "/portfolio/projects/demo/",
    );
  });

  it("leaves root-hosted paths at the root", () => {
    expect(withBasePath("/projects/demo/", "/")).toBe("/projects/demo/");
  });
});

describe("resolveConfiguredHref", () => {
  it("prefixes local paths and classifies HTTPS links", () => {
    expect(resolveConfiguredHref("/resume/cv.pdf", "/portfolio")).toEqual({
      href: "/portfolio/resume/cv.pdf",
      external: false,
    });
    expect(resolveConfiguredHref("https://example.com", "/portfolio")).toEqual({
      href: "https://example.com",
      external: true,
    });
    expect(resolveConfiguredHref("mailto:hello@example.com", "/portfolio")).toEqual({
      href: "mailto:hello@example.com",
      external: false,
    });
  });

  it("returns null for an empty value", () => {
    expect(resolveConfiguredHref("", "/portfolio")).toBeNull();
    expect(resolveConfiguredHref("   ", "/portfolio")).toBeNull();
  });

  it.each([
    "http://example.com",
    "//example.com",
    "projects/demo/",
    "file:///tmp/demo",
    "javascript:alert(1)",
  ])("rejects an unsafe or unsupported value: %s", (href) => {
    expect(() => resolveConfiguredHref(href, "/portfolio")).toThrow();
  });
});
