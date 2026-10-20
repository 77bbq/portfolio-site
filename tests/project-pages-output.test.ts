import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { load } from "cheerio";
import { beforeAll, describe, expect, it } from "vitest";

import { siteIdentity } from "../src/data/site";
import { withBasePath } from "../src/lib/paths";
import {
  stageSectionId,
  STAGE_LABELS,
  STATUS_LABELS,
} from "../src/lib/projects";
import {
  loadProjectFixtures,
  type ProjectFixture,
  type ProjectMediaFixture,
} from "./project-fixtures";

const pages = new Map<string, string>();
let projects: Map<string, ProjectFixture>;

function sortedMedia(media: ProjectMediaFixture[]): ProjectMediaFixture[] {
  return [...media].sort(
    (left, right) => left.order - right.order || left.src.localeCompare(right.src),
  );
}

beforeAll(async () => {
  projects = await loadProjectFixtures();
  const projectRoot = path.resolve("dist", "projects");
  const entries = await readdir(projectRoot, { withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  expect(directories.sort()).toEqual([...projects.keys()].sort());

  await Promise.all(
    directories.map(async (slug) => {
      pages.set(slug, await readFile(path.join(projectRoot, slug, "index.html"), "utf8"));
    }),
  );
});

describe("built project detail pages", () => {
  it("renders current project identity and stage-aware backlinks", () => {
    expect(pages).toHaveLength(projects.size);

    for (const [slug, { data }] of projects) {
      const $ = load(pages.get(slug)!);
      const bodyText = $("body").text();
      expect($("h1").text()).toContain(data.title);
      expect(bodyText).toContain(STAGE_LABELS[data.stage]);
      expect(bodyText).toContain(STATUS_LABELS[data.status]);
      const backHref = `${withBasePath("/", process.env.BASE_PATH)}#${stageSectionId(data.stage)}`;
      expect($(`a[href="${backHref}"]`).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("matches optional facts and placeholder or ready-body state to current content", () => {
    for (const [slug, { data, body }] of projects) {
      const html = pages.get(slug)!;
      const $ = load(html);
      const summary = $("[data-project-summary]");

      if (data.summary.trim()) {
        expect(summary, slug).toHaveLength(1);
        expect(summary.text()).toContain(data.summary);
      } else {
        expect(summary, slug).toHaveLength(0);
      }

      for (const [selector, values] of [
        ["[data-project-roles]", data.roles],
        ["[data-project-tech]", data.tech],
        ["[data-project-metrics]", data.metrics],
      ] as const) {
        const section = $(selector);
        if (values.length > 0) {
          expect(section, `${slug}: ${selector}`).toHaveLength(1);
          expect(section.find("li").toArray().map((item) => $(item).text().trim())).toEqual(
            values,
          );
        } else {
          expect(section, `${slug}: ${selector}`).toHaveLength(0);
        }
      }

      const showsBody = data.contentStatus === "ready" && body.trim().length > 0;
      expect($("[data-project-body]"), slug).toHaveLength(showsBody ? 1 : 0);
      expect($("[data-placeholder-notice]"), slug).toHaveLength(showsBody ? 0 : 1);
      if (!showsBody) {
        expect($("[data-placeholder-notice]").text()).toContain("内容整理中");
      }

      expect(html).not.toMatch(
        /<!--\s*(项目成果|项目背景|我的职责|系统设计|核心技术与难点|测试结果|项目复盘)/,
      );
    }
  });

  it("renders every configured local video accessibly without autoplay", () => {
    for (const [slug, { data }] of projects) {
      const $ = load(pages.get(slug)!);
      const expectedVideos = sortedMedia(data.media).filter((item) => item.type === "video");
      const videos = $("video");

      expect(videos, slug).toHaveLength(expectedVideos.length);
      expectedVideos.forEach((expected, index) => {
        const video = videos.eq(index);
        expect(video.is("[controls]")).toBe(true);
        expect(video.is("[playsinline]")).toBe(true);
        expect(video.attr("preload")).toBe("none");
        expect(video.is("[autoplay]")).toBe(false);
        expect(video.attr("aria-label")?.trim()).toBe(expected.alt);
        expect(video.attr("src")).toBe(withBasePath(expected.src, process.env.BASE_PATH));
        if (expected.poster || data.cover) {
          expect(video.attr("poster")?.trim()).toBeTruthy();
        }
      });
    }
  });

  it("renders configured detail images responsively and otherwise uses a fallback", () => {
    for (const [slug, { data }] of projects) {
      const $ = load(pages.get(slug)!);
      const items =
        data.media.length > 0
          ? sortedMedia(data.media)
          : data.cover
            ? [{ type: "image" as const, src: data.cover, alt: data.coverAlt, order: 0 }]
            : [];
      const expectedImages = items.filter((item) => item.type === "image");
      const pictures = $("[data-project-media] picture");

      expect(pictures, slug).toHaveLength(expectedImages.length);
      pictures.each((index, picture) => {
        const image = $(picture).find("img");
        expect(image.attr("alt")?.trim()).toBe(expectedImages[index]?.alt);
        expect(
          $(picture)
            .find("source")
            .toArray()
            .some((source) => Boolean($(source).attr("srcset")?.trim())),
        ).toBe(true);
      });
      expect($("[data-project-media] [data-cover-fallback]"), slug).toHaveLength(
        items.length === 0 ? 1 : 0,
      );
    }
  });

  it("renders only configured project and footer actions", () => {
    const configuredFooterActions = [
      siteIdentity.githubUrl,
      siteIdentity.resumeUrl,
      siteIdentity.email,
    ].filter((value) => value.trim()).length;

    for (const [slug, { data }] of projects) {
      const $ = load(pages.get(slug)!);
      const expectedProjectLinks = Object.values(data.links).filter((value) => value.trim());
      expect($("[data-project-links] a"), slug).toHaveLength(expectedProjectLinks.length);
      expect($("[data-footer-actions] a"), slug).toHaveLength(configuredFooterActions);
      expect($('a[href=""]'), slug).toHaveLength(0);
    }
  });
});
