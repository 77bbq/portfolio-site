import { defineConfig } from "astro/config";

const site = process.env.SITE_URL?.trim() || undefined;
const rawBase = process.env.BASE_PATH?.trim();
const normalizedBase = rawBase?.replace(/^\/+|\/+$/g, "") ?? "";
const base = normalizedBase ? `/${normalizedBase}` : "/";

export default defineConfig({
  output: "static",
  site,
  base,
  trailingSlash: "always",
});
