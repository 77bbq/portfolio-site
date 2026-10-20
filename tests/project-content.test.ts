import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";
import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const projectsRoot = path.join(repositoryRoot, "src", "content", "projects");
const publicRoot = path.join(repositoryRoot, "public");
const templatePath = path.join(repositoryRoot, "templates", "new-project", "index.md");

const expectedProjects = {
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

const authorTopics = [
  "项目成果",
  "项目背景",
  "我的职责",
  "系统设计",
  "核心技术与难点",
  "测试结果",
  "项目复盘",
];

async function projectFiles(): Promise<string[]> {
  const entries = await readdir(projectsRoot, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name === "index.md")
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort();
}

async function expectFile(filePath: string): Promise<void> {
  await expect(access(filePath)).resolves.toBeUndefined();
}

function authorCommentText(source: string): string {
  return [...source.matchAll(/<!--([\s\S]*?)-->/g)]
    .map((match) => match[1])
    .join("\n");
}

describe("project content manifest", () => {
  it("contains exactly the seven confirmed projects with stable metadata", async () => {
    const files = await projectFiles();
    expect(files).toHaveLength(7);

    const manifest = await Promise.all(
      files.map(async (file) => {
        const source = await readFile(file, "utf8");
        const { data } = matter(source);
        return { file, source, data };
      }),
    );

    expect(new Set(manifest.map(({ data }) => data.slug)).size).toBe(7);
    expect(
      Object.fromEntries(
        manifest.map(({ data }) => [
          data.slug,
          {
            title: data.title,
            stage: data.stage,
            status: data.status,
            order: data.order,
          },
        ]),
      ),
    ).toEqual(expectedProjects);

    for (const { file, data } of manifest) {
      expect(path.basename(path.dirname(file))).toBe(data.slug);
      expect(data.contentStatus).toBe("placeholder");
      expect(data.summary).toBe("");
      expect(data.roles).toEqual([]);
      expect(data.tech).toEqual([]);
      expect(data.metrics).toEqual([]);
      expect(data.links).toEqual({ repository: "", demo: "", document: "" });
    }
  });

  it("provides accessible, resolvable cover and media references", async () => {
    for (const file of await projectFiles()) {
      const { data } = matter(await readFile(file, "utf8"));
      const projectDirectory = path.dirname(file);

      if (data.cover) {
        expect(String(data.coverAlt).trim()).not.toBe("");
        await expectFile(path.resolve(projectDirectory, data.cover));
      }

      for (const media of data.media ?? []) {
        expect(String(media.alt).trim()).not.toBe("");
        if (media.type === "image") {
          await expectFile(path.resolve(projectDirectory, media.src));
        } else {
          expect(media.src).toMatch(/^\/media\//);
          await expectFile(path.join(publicRoot, media.src.slice(1)));
          if (media.poster) {
            await expectFile(path.resolve(projectDirectory, media.poster));
          }
        }
      }
    }
  });

  it("keeps all seven writing prompts in the template and every project", async () => {
    const files = [templatePath, ...(await projectFiles())];

    for (const file of files) {
      const comments = authorCommentText(await readFile(file, "utf8"));
      for (const topic of authorTopics) {
        expect(comments, `${path.relative(repositoryRoot, file)}: ${topic}`).toContain(topic);
      }
    }
  });
});
