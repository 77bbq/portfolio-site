import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { load } from "cheerio";
import { beforeAll, describe, expect, it } from "vitest";

import { siteIdentity } from "../src/data/site";
import { withBasePath } from "../src/lib/paths";
import {
  compareProjects,
  stageSectionId,
  STAGE_LABELS,
  STATUS_LABELS,
} from "../src/lib/projects";
import {
  loadProjectFixtures,
  type ProjectFixture,
} from "./project-fixtures";

let html: string;
let projects: Map<string, ProjectFixture>;

beforeAll(async () => {
  [html, projects] = await Promise.all([
    readFile(path.resolve("dist", "index.html"), "utf8"),
    loadProjectFixtures(),
  ]);
});

async function builtStylesheet(): Promise<string> {
  const entries = await readdir(path.resolve("dist"), {
    recursive: true,
    withFileTypes: true,
  });
  const stylesheets = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".css"))
    .map((entry) => path.join(entry.parentPath, entry.name));

  return (await Promise.all(stylesheets.map((file) => readFile(file, "utf8")))).join("\n");
}

describe("built homepage", () => {
  it("introduces the portfolio and groups graduate projects first", () => {
    const $ = load(html);
    expect($("#portfolio-title").text().trim()).toBe(
      (siteIdentity.name || siteIdentity.title).trim(),
    );
    expect($(".hero-direction").text().trim()).toBe(siteIdentity.direction.trim());

    const graduateIndex = html.indexOf('id="graduate-projects"');
    const undergraduateIndex = html.indexOf('id="undergraduate-projects"');
    expect(graduateIndex).toBeGreaterThan(-1);
    expect(undergraduateIndex).toBeGreaterThan(graduateIndex);
  });

  it("links every current project once in its stage and reports dynamic counts", () => {
    const $ = load(html);
    const stageCounts = { graduate: 0, undergraduate: 0 };

    expect($("[data-project-card]")).toHaveLength(projects.size);
    for (const { data } of projects.values()) {
      const href = withBasePath(`/projects/${data.slug}/`, process.env.BASE_PATH);
      const links = $(`a[href="${href}"]`);
      const section = `#${stageSectionId(data.stage)}`;

      expect(links, data.slug).toHaveLength(1);
      expect(links.closest(section), data.slug).toHaveLength(1);
      const card = links.closest("[data-project-card]");
      const cardText = card.text();
      expect(cardText).toContain(data.title);
      expect(cardText).toContain(STAGE_LABELS[data.stage]);
      expect(cardText).toContain(STATUS_LABELS[data.status]);
      expect(card.find(".project-card__index").text().trim()).toBe(
        String(data.order).padStart(2, "0"),
      );
      stageCounts[data.stage] += 1;
    }

    expect($("#graduate-projects .project-count strong").text()).toBe(
      String(stageCounts.graduate).padStart(2, "0"),
    );
    expect($("#undergraduate-projects .project-count strong").text()).toBe(
      String(stageCounts.undergraduate).padStart(2, "0"),
    );

    for (const stage of ["graduate", "undergraduate"] as const) {
      const section = `#${stageSectionId(stage)}`;
      const actualHrefs = $(`${section} [data-project-card] > a`)
        .toArray()
        .map((anchor) => $(anchor).attr("href"));
      const expectedHrefs = [...projects.values()]
        .filter(({ data }) => data.stage === stage)
        .sort(compareProjects)
        .map(({ data }) =>
          withBasePath(`/projects/${data.slug}/`, process.env.BASE_PATH),
        );

      expect(actualHrefs, `${stage} project order`).toEqual(expectedHrefs);
    }
  });

  it("renders only the summaries, technologies, and footer actions currently configured", () => {
    const $ = load(html);

    for (const { data } of projects.values()) {
      const href = withBasePath(`/projects/${data.slug}/`, process.env.BASE_PATH);
      const card = $(`a[href="${href}"]`).closest("[data-project-card]");
      const summary = card.find("[data-project-summary]");
      const tech = card.find("[data-project-tech] li");

      if (data.summary.trim()) {
        expect(summary).toHaveLength(1);
        expect(summary.text()).toContain(data.summary);
      } else {
        expect(summary).toHaveLength(0);
      }
      expect(tech.toArray().map((item) => $(item).text().trim())).toEqual(data.tech);
    }

    const configuredFooterActions = [
      siteIdentity.githubUrl,
      siteIdentity.resumeUrl,
      siteIdentity.email,
    ].filter((value) => value.trim()).length;
    expect($("[data-footer-actions] a")).toHaveLength(configuredFooterActions);
    expect($('a[href=""]')).toHaveLength(0);
  });

  it("renders accessible responsive covers or fallbacks without homepage video", () => {
    const $ = load(html);
    const expectedPictures = [...projects.values()].filter(({ data }) => data.cover).length;

    expect($("[data-project-card] picture")).toHaveLength(expectedPictures);
    for (const { data } of projects.values()) {
      const href = withBasePath(`/projects/${data.slug}/`, process.env.BASE_PATH);
      const card = $(`a[href="${href}"]`).closest("[data-project-card]");
      const picture = card.find("picture");
      const fallback = card.find("[data-cover-fallback]");

      if (data.cover) {
        expect(picture, data.slug).toHaveLength(1);
        expect(fallback, data.slug).toHaveLength(0);
        const image = picture.find("img");
        expect(image.attr("alt")?.trim()).toBe(data.coverAlt);
        expect(
          picture
            .find("source")
            .toArray()
            .some((source) => Boolean($(source).attr("srcset")?.trim())),
        ).toBe(true);
      } else {
        expect(picture, data.slug).toHaveLength(0);
        expect(fallback, data.slug).toHaveLength(1);
      }
    }

    expect($("video, video source")).toHaveLength(0);
    expect(html).not.toContain(".mp4");
  });

  it("keeps tall or mechanically dense project covers fully visible", () => {
    const $ = load(html);

    for (const slug of ["smart-harvesting-car", "raicom-robot"]) {
      const href = withBasePath(`/projects/${slug}/`, process.env.BASE_PATH);
      const media = $(`a[href="${href}"]`).find(".project-card__media");

      expect(media).toHaveLength(1);
      expect(media.hasClass("project-card__media--contain"), slug).toBe(true);
    }
  });

  it("draws keyboard focus on the unclipped project-card boundary", async () => {
    const stylesheet = await builtStylesheet();
    const focusRule = stylesheet.match(/\.project-card:focus-within\{([^}]*)\}/)?.[1] ?? "";

    expect(focusRule).toContain("outline:3px solid var(--blue)");
    expect(focusRule).toContain("outline-offset:4px");
  });
});
