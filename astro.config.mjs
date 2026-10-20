import { defineConfig } from "astro/config";

import { normalizePagesBase } from "./src/lib/paths.ts";

const site = process.env.SITE_URL?.trim() || undefined;
const rawBase = process.env.BASE_PATH?.trim();
const base = normalizePagesBase(rawBase) || "/";

export default defineConfig({
  output: "static",
  site,
  base,
  trailingSlash: "always",
});
