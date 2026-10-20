import type { CollectionEntry } from "astro:content";
import { z } from "astro/zod";

import { resolveConfiguredHref, withBasePath } from "./paths";

export type Stage = "graduate" | "undergraduate";
export type ProjectStatus = "ongoing" | "completed";
export type ContentStatus = "placeholder" | "ready";

export type ProjectImageMedia = {
  type: "image";
  src: ImageMetadata;
  alt: string;
  caption?: string;
  order: number;
};

export type ProjectVideoMedia = {
  type: "video";
  src: string;
  poster?: ImageMetadata;
  alt: string;
  caption?: string;
  order: number;
};

export type ProjectMediaItem = ProjectImageMedia | ProjectVideoMedia;

export type ProjectLike = {
  data: {
    slug: string;
    stage: Stage;
    order: number;
  };
};

export const STAGE_LABELS: Record<Stage, string> = {
  graduate: "研究生项目",
  undergraduate: "本科生项目",
};

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  ongoing: "进行中",
  completed: "已完成",
};

const configuredLinkSchema = z
  .string()
  .trim()
  .refine(
    (value) => {
      if (!value) {
        return true;
      }

      try {
        resolveConfiguredHref(value);
        return true;
      } catch {
        return false;
      }
    },
    { message: "链接必须是 HTTPS、mailto: 或以 / 开头的站内路径" },
  );

function isEncodedPublicMediaPath(value: string): boolean {
  if (!value.startsWith("/media/") || /[\\\s?#]/.test(value)) {
    return false;
  }

  try {
    return encodeURI(decodeURI(value)) === value;
  } catch {
    return false;
  }
}

export function createProjectSchema(imageFactory: () => z.ZodTypeAny) {
  const nonEmptyText = z.string().trim().min(1);
  const imageMedia = z.object({
    type: z.literal("image"),
    src: imageFactory(),
    alt: nonEmptyText,
    caption: z.string().trim().optional(),
    order: z.number(),
  });
  const videoMedia = z.object({
    type: z.literal("video"),
    src: z
      .string()
      .trim()
      .refine(isEncodedPublicMediaPath, {
        message: "视频必须使用已编码的 /media/ 站点根相对路径",
      }),
    poster: imageFactory().optional(),
    alt: nonEmptyText,
    caption: z.string().trim().optional(),
    order: z.number(),
  });

  return z
    .object({
      title: nonEmptyText,
      slug: z
        .string()
        .trim()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug 必须是稳定的小写英文连字符"),
      stage: z.enum(["graduate", "undergraduate"]),
      status: z.enum(["ongoing", "completed"]),
      order: z.number(),
      contentStatus: z.enum(["placeholder", "ready"]),
      summary: z.string().trim().default(""),
      cover: imageFactory().optional(),
      coverAlt: z.string().trim().default(""),
      coverFit: z.enum(["cover", "contain"]).optional(),
      coverPosition: z.string().trim().optional(),
      roles: z.array(nonEmptyText).default([]),
      tech: z.array(nonEmptyText).default([]),
      metrics: z.array(nonEmptyText).default([]),
      media: z.discriminatedUnion("type", [imageMedia, videoMedia]).array().default([]),
      links: z
        .object({
          repository: configuredLinkSchema.default(""),
          demo: configuredLinkSchema.default(""),
          document: configuredLinkSchema.default(""),
        })
        .default({ repository: "", demo: "", document: "" }),
    })
    .superRefine((project, context) => {
      const hasCover = Boolean(project.cover);
      const hasCoverAlt = Boolean(project.coverAlt);

      if (hasCover && !hasCoverAlt) {
        context.addIssue({
          code: "custom",
          message: "提供封面时必须填写 coverAlt",
          path: ["coverAlt"],
        });
      }

      if (!hasCover && hasCoverAlt) {
        context.addIssue({
          code: "custom",
          message: "提供 coverAlt 时必须同时提供封面",
          path: ["cover"],
        });
      }
    });
}

function compareStrings(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
}

export function compareProjects(a: ProjectLike, b: ProjectLike): number {
  return a.data.order - b.data.order || compareStrings(a.data.slug, b.data.slug);
}

function mediaSource(media: ProjectMediaItem): string {
  return media.type === "image" ? media.src.src : media.src;
}

export function compareMedia(a: ProjectMediaItem, b: ProjectMediaItem): number {
  return a.order - b.order || compareStrings(mediaSource(a), mediaSource(b));
}

export function sortMedia<T extends ProjectMediaItem>(media: T[]): T[] {
  return [...media].sort(compareMedia);
}

export function groupProjects<T extends ProjectLike>(projects: T[]): {
  graduate: T[];
  undergraduate: T[];
} {
  return {
    graduate: projects
      .filter((project) => project.data.stage === "graduate")
      .sort(compareProjects),
    undergraduate: projects
      .filter((project) => project.data.stage === "undergraduate")
      .sort(compareProjects),
  };
}

export function assertUniqueProjectSlugs(projects: ProjectLike[]): void {
  const seen = new Set<string>();

  for (const project of projects) {
    const { slug } = project.data;
    if (seen.has(slug)) {
      throw new Error(`Duplicate project slug: ${slug}`);
    }
    seen.add(slug);
  }
}

export function stageSectionId(
  stage: Stage,
): "graduate-projects" | "undergraduate-projects" {
  return stage === "graduate" ? "graduate-projects" : "undergraduate-projects";
}

export function stageBackHref(stage: Stage, base?: string): string {
  return `${withBasePath("/", base)}#${stageSectionId(stage)}`;
}

export function hasUsableCover(project: {
  cover?: unknown;
  coverAlt?: string;
}): boolean {
  return Boolean(project.cover && project.coverAlt?.trim());
}

export function shouldRenderProjectBody(
  status: ContentStatus,
  bodyHtml: string,
): boolean {
  return status === "ready" && bodyHtml.trim().length > 0;
}

export async function getProjects(): Promise<CollectionEntry<"projects">[]> {
  const { getCollection } = await import("astro:content");
  const projects = await getCollection("projects");
  assertUniqueProjectSlugs(projects);
  return [...projects].sort(compareProjects);
}
