import { readFile } from "node:fs/promises";
import path from "node:path";

import { load } from "cheerio";
import { beforeAll, describe, expect, it } from "vitest";

import { withBasePath } from "../src/lib/paths";

const projectSlugs = [
  "air-ground-coordination",
  "robomaster-hero",
  "electric-racing-car",
  "logistics-carrier",
  "smart-harvesting-car",
  "raicom-robot",
  "bionic-frog",
];

let html: string;

beforeAll(async () => {
  html = await readFile(path.resolve("dist", "index.html"), "utf8");
});

describe("built homepage", () => {
  it("introduces the portfolio and groups graduate projects first", () => {
    const $ = load(html);
    expect($("body").text()).toContain("机器人与嵌入式作品集");
    expect($("body").text()).toContain("机器人 · 嵌入式 · 系统集成");

    const graduateIndex = html.indexOf('id="graduate-projects"');
    const undergraduateIndex = html.indexOf('id="undergraduate-projects"');
    expect(graduateIndex).toBeGreaterThan(-1);
    expect(undergraduateIndex).toBeGreaterThan(graduateIndex);
  });

  it("links every canonical project exactly once and shows ongoing status", () => {
    const $ = load(html);

    for (const slug of projectSlugs) {
      const href = withBasePath(`/projects/${slug}/`, process.env.BASE_PATH);
      expect($(`a[href="${href}"]`)).toHaveLength(1);
    }

    const airGroundHref = withBasePath(
      "/projects/air-ground-coordination/",
      process.env.BASE_PATH,
    );
    const airGroundCard = $(
      `a[href="${airGroundHref}"]`,
    ).closest("[data-project-card]");
    expect(airGroundCard.text()).toContain("进行中");
  });

  it("collapses empty first-release fields and links", () => {
    const $ = load(html);

    expect($("[data-project-summary]")).toHaveLength(0);
    expect($("[data-project-tech]")).toHaveLength(0);
    expect($("[data-footer-actions] a")).toHaveLength(0);
    expect($('a[href=""]')).toHaveLength(0);
  });

  it("renders accessible responsive covers without homepage video", () => {
    const $ = load(html);
    const pictures = $("[data-project-card] picture");
    expect(pictures).toHaveLength(7);

    pictures.each((_, picture) => {
      const image = $(picture).find("img");
      const sources = $(picture).find("source");
      expect(image.attr("alt")?.trim()).toBeTruthy();
      expect(
        sources
          .toArray()
          .some((source) => Boolean($(source).attr("srcset")?.trim())),
      ).toBe(true);
    });

    expect($("video, video source")).toHaveLength(0);
    expect(html).not.toContain(".mp4");
  });
});
