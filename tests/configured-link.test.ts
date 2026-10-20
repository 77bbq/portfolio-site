import { experimental_AstroContainer } from "astro/container";
import { load } from "cheerio";
import { beforeAll, describe, expect, it } from "vitest";

import ConfiguredLink from "../src/components/ConfiguredLink.astro";

let container: experimental_AstroContainer;

beforeAll(async () => {
  container = await experimental_AstroContainer.create();
});

describe("ConfiguredLink", () => {
  it("opens HTTPS links in a safe new tab", async () => {
    const html = await container.renderToString(ConfiguredLink, {
      props: {
        href: "https://example.com/project",
        label: "项目仓库",
        base: "/portfolio",
      },
    });
    const $ = load(html);
    const anchor = $("a");

    expect(anchor.text()).toContain("项目仓库");
    expect(anchor.attr("href")).toBe("https://example.com/project");
    expect(anchor.attr("target")).toBe("_blank");
    expect(anchor.attr("rel")?.split(/\s+/)).toEqual(
      expect.arrayContaining(["noopener", "noreferrer"]),
    );
  });

  it("prefixes a site path without new-tab attributes", async () => {
    const html = await container.renderToString(ConfiguredLink, {
      props: {
        href: "/resume/cv.pdf",
        label: "个人简历",
        base: "/portfolio",
      },
    });
    const $ = load(html);
    const anchor = $("a");

    expect(anchor.attr("href")).toBe("/portfolio/resume/cv.pdf");
    expect(anchor.attr("target")).toBeUndefined();
    expect(anchor.attr("rel")).toBeUndefined();
  });

  it("renders no anchor for empty input", async () => {
    const html = await container.renderToString(ConfiguredLink, {
      props: { href: "", label: "空链接", base: "/portfolio" },
    });

    expect(load(html)("a")).toHaveLength(0);
  });
});
