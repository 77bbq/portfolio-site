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

export const requiredProjectSlugs = [
  "air-ground-coordination",
  "robomaster-hero",
  "electric-racing-car",
  "logistics-carrier",
  "smart-harvesting-car",
  "raicom-robot",
  "bionic-frog",
] as const;

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => trimmedText(item)) : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function trimmedText(value: unknown): string {
  return text(value).trim();
}

function optionalTrimmedText(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() : undefined;
}

export function compareProjectMediaFixtures(
  left: ProjectMediaFixture,
  right: ProjectMediaFixture,
): number {
  if (left.order !== right.order) {
    return left.order - right.order;
  }

  if (left.src === right.src) {
    return 0;
  }

  return left.src < right.src ? -1 : 1;
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
    const slug = trimmedText(raw.slug);
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
        title: trimmedText(raw.title),
        slug,
        stage: raw.stage as ProjectStage,
        status: raw.status as ProjectStatus,
        order: Number(raw.order),
        contentStatus: raw.contentStatus as ProjectContentStatus,
        summary: trimmedText(raw.summary),
        cover: text(raw.cover),
        coverAlt: trimmedText(raw.coverAlt),
        roles: strings(raw.roles),
        tech: strings(raw.tech),
        metrics: strings(raw.metrics),
        media: rawMedia.map((item) => {
          const media = item as Record<string, unknown>;
          return {
            type: media.type as "image" | "video",
            src:
              media.type === "video"
                ? trimmedText(media.src)
                : text(media.src),
            poster: text(media.poster) || undefined,
            alt: trimmedText(media.alt),
            caption: optionalTrimmedText(media.caption),
            order: Number(media.order),
          };
        }),
        links: {
          repository: trimmedText(rawLinks.repository),
          demo: trimmedText(rawLinks.demo),
          document: trimmedText(rawLinks.document),
        },
      },
    });
  }

  return fixtures;
}
