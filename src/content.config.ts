import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";

import { createProjectSchema } from "./lib/projects";

const projects = defineCollection({
  loader: glob({ pattern: "**/index.md", base: "./src/content/projects" }),
  schema: ({ image }) => createProjectSchema(image),
});

export const collections = { projects };
