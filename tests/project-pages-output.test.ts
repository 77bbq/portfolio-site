import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { load } from "cheerio";
import { beforeAll, describe, expect, it } from "vitest";

const expectedProjects = {
  "air-ground-coordination": {
    title: "空地协同",
    stage: "研究生项目",
    status: "进行中",
    section: "graduate-projects",
  },
  "robomaster-hero": {
    title: "机甲大师英雄",
    stage: "本科生项目",
    status: "已完成",
    section: "undergraduate-projects",
  },
  "electric-racing-car": {
    title: "电赛车",
    stage: "本科生项目",
    status: "已完成",
    section: "undergraduate-projects",
  },
  "logistics-carrier": {
    title: "物流搬运机小车",
    stage: "本科生项目",
    status: "已完成",
    section: "undergraduate-projects",
  },
  "smart-harvesting-car": {
    title: "智能采摘车",
    stage: "本科生项目",
    status: "已完成",
    section: "undergraduate-projects",
  },
  "raicom-robot": {
    title: "睿抗机器人",
    stage: "本科生项目",
    status: "已完成",
    section: "undergraduate-projects",
  },
  "bionic-frog": {
    title: "仿生青蛙",
    stage: "本科生项目",
    status: "已完成",
    section: "undergraduate-projects",
  },
} as const;

const authorTopics = [
  "项目成果",
  "项目背景",
  "我的职责",
  "系统设计",
  "核心技术与难点",
  "测试结果",
  "项目复盘",
];

const pages = new Map<string, string>();

beforeAll(async () => {
  const projectRoot = path.resolve("dist", "projects");
  const entries = await readdir(projectRoot, { withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  expect(directories.sort()).toEqual(Object.keys(expectedProjects).sort());

  await Promise.all(
    directories.map(async (slug) => {
      pages.set(slug, await readFile(path.join(projectRoot, slug, "index.html"), "utf8"));
    }),
  );
});

describe("built project detail pages", () => {
  it("renders identity and a stage-aware backlink for all seven projects", () => {
    expect(pages).toHaveLength(7);

    for (const [slug, expected] of Object.entries(expectedProjects)) {
      const $ = load(pages.get(slug)!);
      const bodyText = $("body").text();
      expect($("h1").text()).toContain(expected.title);
      expect(bodyText).toContain(expected.stage);
      expect(bodyText).toContain(expected.status);
      expect($(`a[href="/#${expected.section}"]`).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("shows one placeholder notice without empty facts or author-only prompts", () => {
    const emptySelectors = [
      "[data-project-summary]",
      "[data-project-roles]",
      "[data-project-tech]",
      "[data-project-metrics]",
      "[data-project-body]",
    ];

    for (const html of pages.values()) {
      const $ = load(html);
      expect($("[data-placeholder-notice]")).toHaveLength(1);
      expect($("[data-placeholder-notice]").text()).toContain("内容整理中");
      for (const selector of emptySelectors) {
        expect($(selector), selector).toHaveLength(0);
      }
      expect($("main").text()).not.toContain("项目摘要");
      expect($("main").text()).not.toContain("关键指标");
      for (const topic of authorTopics) {
        expect(html).not.toContain(topic);
      }
    }
  });

  it("renders both local videos accessibly without autoplay", () => {
    const videos = [...pages.values()].flatMap((html) => {
      const $ = load(html);
      return $("video")
        .toArray()
        .map((element) => ({ $, element }));
    });

    expect(videos).toHaveLength(2);
    for (const { $, element } of videos) {
      const video = $(element);
      expect(video.is("[controls]")).toBe(true);
      expect(video.is("[playsinline]")).toBe(true);
      expect(video.attr("preload")).toBe("none");
      expect(video.is("[autoplay]")).toBe(false);
      expect(video.attr("poster")?.trim()).toBeTruthy();
      expect(video.attr("aria-label")?.trim()).toBeTruthy();
      expect(video.attr("src")).toMatch(/^\/media\/projects\/.+\.mp4$/);
    }
  });

  it("renders every detail image through responsive picture output", () => {
    for (const [slug, html] of pages) {
      const $ = load(html);
      $("main img").each((_, image) => {
        expect($(image).closest("picture")).toHaveLength(1);
        expect($(image).attr("alt")?.trim()).toBeTruthy();
        expect(
          $(image)
            .closest("picture")
            .find("source")
            .toArray()
            .some((source) => Boolean($(source).attr("srcset")?.trim())),
        ).toBe(true);
      });

      if (
        [
          "electric-racing-car",
          "logistics-carrier",
          "smart-harvesting-car",
          "raicom-robot",
        ].includes(slug)
      ) {
        expect($("[data-project-media] picture")).toHaveLength(1);
      }
    }
  });

  it("does not render empty project or footer actions", () => {
    for (const html of pages.values()) {
      const $ = load(html);
      expect($("[data-project-links] a")).toHaveLength(0);
      expect($("[data-footer-actions] a")).toHaveLength(0);
      expect($('a[href=""]')).toHaveLength(0);
    }
  });
});
