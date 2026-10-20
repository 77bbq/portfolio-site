import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  loadProjectFixtures,
  repositoryRoot,
  requiredProjectSlugs,
  templatePath,
} from "./project-fixtures";

const publicRoot = path.join(repositoryRoot, "public");

const authorTopics = [
  "项目成果",
  "项目背景",
  "我的职责",
  "系统设计",
  "核心技术与难点",
  "测试结果",
  "项目复盘",
];

async function expectFile(filePath: string): Promise<void> {
  await expect(access(filePath)).resolves.toBeUndefined();
}

function authorCommentText(source: string): string {
  return [...source.matchAll(/<!--([\s\S]*?)-->/g)]
    .map((match) => match[1])
    .join("\n");
}

describe("project content manifest", () => {
  it("keeps the seven confirmed projects stable while allowing additions and authoring", async () => {
    const fixtures = await loadProjectFixtures();

    expect(fixtures.size).toBeGreaterThanOrEqual(requiredProjectSlugs.length);
    for (const slug of requiredProjectSlugs) {
      expect(fixtures.has(slug), slug).toBe(true);
    }

    for (const fixture of fixtures.values()) {
      const { file, data } = fixture;
      expect(path.basename(path.dirname(file))).toBe(data.slug);
      expect(["placeholder", "ready"]).toContain(data.contentStatus);
      expect(Array.isArray(data.roles)).toBe(true);
      expect(Array.isArray(data.tech)).toBe(true);
      expect(Array.isArray(data.metrics)).toBe(true);
      expect(data.links).toEqual(
        expect.objectContaining({
          repository: expect.any(String),
          demo: expect.any(String),
          document: expect.any(String),
        }),
      );
    }
  });

  it("provides accessible, resolvable cover and media references", async () => {
    for (const { file, data } of (await loadProjectFixtures()).values()) {
      const projectDirectory = path.dirname(file);

      if (data.cover) {
        expect(data.coverAlt.trim()).not.toBe("");
        await expectFile(path.resolve(projectDirectory, data.cover));
      }

      for (const media of data.media) {
        expect(media.alt.trim()).not.toBe("");
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

  it("keeps writing prompts in the template and unfinished projects", async () => {
    const templateComments = authorCommentText(await readFile(templatePath, "utf8"));
    for (const topic of authorTopics) {
      expect(templateComments, `template: ${topic}`).toContain(topic);
    }

    for (const { file, source, data } of (await loadProjectFixtures()).values()) {
      if (data.contentStatus !== "placeholder") {
        continue;
      }

      const comments = authorCommentText(source);
      for (const topic of authorTopics) {
        expect(comments, `${path.relative(repositoryRoot, file)}: ${topic}`).toContain(topic);
      }
    }
  });
});
