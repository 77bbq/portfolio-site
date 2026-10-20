import { z } from "astro/zod";
import { describe, expect, it } from "vitest";

import {
  assertUniqueProjectSlugs,
  compareMedia,
  createProjectSchema,
  groupProjects,
  hasUsableCover,
  shouldRenderProjectBody,
  sortMedia,
  stageBackHref,
  stageSectionId,
  type ProjectImageMedia,
  type ProjectLike,
  type ProjectVideoMedia,
} from "../src/lib/projects";

const schema = createProjectSchema(() => z.string());

const minimalProject = {
  title: "测试项目",
  slug: "test-project",
  stage: "graduate",
  status: "ongoing",
  order: 10,
  contentStatus: "placeholder",
} as const;

function project(
  slug: string,
  stage: "graduate" | "undergraduate",
  order: number,
): ProjectLike {
  return { data: { slug, stage, order } };
}

describe("createProjectSchema", () => {
  it("parses a valid minimal project and supplies empty defaults", () => {
    const result = schema.parse(minimalProject);

    expect(result).toMatchObject({
      ...minimalProject,
      summary: "",
      coverAlt: "",
      roles: [],
      tech: [],
      metrics: [],
      media: [],
      links: { repository: "", demo: "", document: "" },
    });
  });

  it.each([
    ["stage", { ...minimalProject, stage: "doctoral" }],
    ["title", { ...minimalProject, title: undefined }],
  ])("reports a field-specific issue for %s", (field, fixture) => {
    const result = schema.safeParse(fixture);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true);
    }
  });

  it("requires cover and non-empty coverAlt together", () => {
    const missingAlt = schema.safeParse({
      ...minimalProject,
      cover: "./cover.webp",
    });
    const missingCover = schema.safeParse({
      ...minimalProject,
      coverAlt: "封面说明",
    });

    expect(missingAlt.success).toBe(false);
    expect(missingCover.success).toBe(false);
    if (!missingAlt.success) {
      expect(missingAlt.error.issues.some((issue) => issue.path[0] === "coverAlt")).toBe(true);
    }
    if (!missingCover.success) {
      expect(missingCover.error.issues.some((issue) => issue.path[0] === "cover")).toBe(true);
    }
  });

  it("rejects empty media alt text", () => {
    const result = schema.safeParse({
      ...minimalProject,
      media: [{ type: "image", src: "./image.webp", alt: "  ", order: 10 }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join(".") === "media.0.alt")).toBe(true);
    }
  });

  it("accepts only encoded, site-root-relative public video paths", () => {
    const relative = schema.safeParse({
      ...minimalProject,
      media: [{ type: "video", src: "./demo.mp4", alt: "演示视频", order: 10 }],
    });
    const encoded = schema.safeParse({
      ...minimalProject,
      media: [
        {
          type: "video",
          src: "/media/projects/test-project/demo.mp4",
          alt: "演示视频",
          order: 10,
        },
      ],
    });

    expect(relative.success).toBe(false);
    expect(encoded.success).toBe(true);
  });

  it("rejects an unsafe configured link", () => {
    const result = schema.safeParse({
      ...minimalProject,
      links: { repository: "javascript:alert(1)" },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) => issue.path.join(".") === "links.repository",
        ),
      ).toBe(true);
    }
  });

  it("trims optional strings but preserves their empty state", () => {
    const result = schema.parse({
      ...minimalProject,
      summary: "   ",
      links: { repository: "   ", demo: "", document: "" },
    });

    expect(result.summary).toBe("");
    expect(result.links.repository).toBe("");
  });
});

describe("project grouping", () => {
  it("groups graduate first and sorts by order then slug without mutation", () => {
    const input = [
      project("undergraduate-z", "undergraduate", 20),
      project("graduate-b", "graduate", 10),
      project("undergraduate-a", "undergraduate", 10),
      project("graduate-a", "graduate", 10),
    ];
    const snapshot = [...input];

    const grouped = groupProjects(input);

    expect(grouped.graduate.map((entry) => entry.data.slug)).toEqual([
      "graduate-a",
      "graduate-b",
    ]);
    expect(grouped.undergraduate.map((entry) => entry.data.slug)).toEqual([
      "undergraduate-a",
      "undergraduate-z",
    ]);
    expect(input).toEqual(snapshot);
  });

  it("rejects duplicate stable slugs", () => {
    expect(() =>
      assertUniqueProjectSlugs([
        project("duplicate", "graduate", 10),
        project("duplicate", "undergraduate", 20),
      ]),
    ).toThrow("Duplicate project slug: duplicate");
  });
});

describe("media ordering", () => {
  const image = {
    type: "image",
    src: { src: "/z-images/z.webp", width: 100, height: 100, format: "webp" },
    alt: "图片",
    order: 10,
  } as ProjectImageMedia;
  const video = {
    type: "video",
    src: "/media/projects/a.mp4",
    alt: "视频",
    order: 10,
  } as ProjectVideoMedia;

  it("uses the media source as a stable tie-breaker", () => {
    expect(compareMedia(image, video)).toBeGreaterThan(0);
  });

  it("sorts a copy instead of mutating the input", () => {
    const input = [image, video];

    expect(sortMedia(input)).toEqual([video, image]);
    expect(input).toEqual([image, video]);
  });
});

describe("stable navigation and visibility helpers", () => {
  it("returns stable section IDs and base-aware backlinks", () => {
    expect(stageSectionId("graduate")).toBe("graduate-projects");
    expect(stageSectionId("undergraduate")).toBe("undergraduate-projects");
    expect(stageBackHref("graduate", "/portfolio")).toBe(
      "/portfolio/#graduate-projects",
    );
    expect(stageBackHref("undergraduate", "/portfolio/")).toBe(
      "/portfolio/#undergraduate-projects",
    );
  });

  it("uses fallback presentation when a cover is absent or empty", () => {
    expect(hasUsableCover({})).toBe(false);
    expect(hasUsableCover({ cover: "", coverAlt: "封面" })).toBe(false);
    expect(hasUsableCover({ cover: "cover", coverAlt: "封面" })).toBe(true);
  });

  it("only renders a non-empty ready body", () => {
    expect(shouldRenderProjectBody("placeholder", "<p>内容</p>")).toBe(false);
    expect(shouldRenderProjectBody("ready", "   ")).toBe(false);
    expect(shouldRenderProjectBody("ready", "<p>内容</p>")).toBe(true);
  });
});
