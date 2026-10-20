import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";

export type ProjectStage = "graduate" | "undergraduate";
export type ProjectStatus = "ongoing" | "completed";
export type ProjectContentStatus = "placeholder" | "ready";

export type ProjectMediaFixture = {
  type: "image" | "video";
  src: string;
  poster?: string;
  alt: string;
  caption?: string;
  order: number;
};

export type ProjectFixture = {
  file: string;
  source: string;
  body: string;
  data: {
    title: string;
    slug: string;
    stage: ProjectStage;
    status: ProjectStatus;
    order: number;
    contentStatus: ProjectContentStatus;
    summary: string;
    cover: string;
    coverAlt: string;
    roles: string[];
    tech: string[];
    metrics: string[];
    media: ProjectMediaFixture[];
    links: {
      repository: string;
      demo: string;
      document: string;
    };
  };
};

export const repositoryRoot = path.resolve(import.meta.dirname, "..");
export const projectsRoot = path.join(repositoryRoot, "src", "content", "projects");
export const templatePath = path.join(
  repositoryRoot,
  "templates",
  "new-project",
  "index.md",
);

export const requiredProjects = {
  "air-ground-coordination": {
    title: "空地协同",
    stage: "graduate",
    status: "ongoing",
    order: 10,
  },
  "robomaster-hero": {
    title: "机甲大师英雄",
    stage: "undergraduate",
    status: "completed",
    order: 10,
  },
  "electric-racing-car": {
    title: "电赛车",
    stage: "undergraduate",
    status: "completed",
    order: 20,
  },
  "logistics-carrier": {
    title: "物流搬运机小车",
    stage: "undergraduate",
    status: "completed",
    order: 30,
  },
  "smart-harvesting-car": {
    title: "智能采摘车",
    stage: "undergraduate",
    status: "completed",
    order: 40,
  },
  "raicom-robot": {
    title: "睿抗机器人",
    stage: "undergraduate",
    status: "completed",
    order: 50,
  },
  "bionic-frog": {
    title: "仿生青蛙",
    stage: "undergraduate",
    status: "completed",
    order: 60,
  },
} as const;

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function loadProjectFixtures(): Promise<Map<string, ProjectFixture>> {
  const entries = await readdir(projectsRoot, {
    recursive: true,
    withFileTypes: true,
  });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name === "index.md")
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort();
  const fixtures = new Map<string, ProjectFixture>();

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const parsed = matter(source);
    const raw = parsed.data as Record<string, unknown>;
    const slug = text(raw.slug);
    const rawLinks = (raw.links ?? {}) as Record<string, unknown>;
    const rawMedia = Array.isArray(raw.media) ? raw.media : [];

    if (fixtures.has(slug)) {
      throw new Error(`Duplicate project slug in fixtures: ${slug}`);
    }

    fixtures.set(slug, {
      file,
      source,
      body: parsed.content,
      data: {
        title: text(raw.title),
        slug,
        stage: raw.stage as ProjectStage,
        status: raw.status as ProjectStatus,
        order: Number(raw.order),
        contentStatus: raw.contentStatus as ProjectContentStatus,
        summary: text(raw.summary),
        cover: text(raw.cover),
        coverAlt: text(raw.coverAlt),
        roles: strings(raw.roles),
        tech: strings(raw.tech),
        metrics: strings(raw.metrics),
        media: rawMedia.map((item) => {
          const media = item as Record<string, unknown>;
          return {
            type: media.type as "image" | "video",
            src: text(media.src),
            poster: text(media.poster) || undefined,
            alt: text(media.alt),
            caption: text(media.caption) || undefined,
            order: Number(media.order),
          };
        }),
        links: {
          repository: text(rawLinks.repository),
          demo: text(rawLinks.demo),
          document: text(rawLinks.document),
        },
      },
    });
  }

  return fixtures;
}
