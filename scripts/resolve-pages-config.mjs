import { appendFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeBase, normalizePagesBase } from "../src/lib/paths.ts";

function optionalValue(value) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function normalizeSiteUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("SITE_URL must be a valid HTTPS URL");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("SITE_URL must be a clean HTTPS URL");
  }
  if (url.pathname !== "/") {
    throw new Error("SITE_URL must identify a root domain; use BASE_PATH for a subpath");
  }
  return url.origin;
}

/**
 * @param {{
 *   repository: string | undefined;
 *   siteUrlOverride?: string;
 *   basePathOverride?: string;
 * }} options
 */
export function resolvePagesConfig({
  repository,
  siteUrlOverride,
  basePathOverride,
}) {
  const repositoryValue = repository?.trim();
  const parts = repositoryValue?.split("/") ?? [];
  const [owner, repositoryName] = parts;
  const validOwner = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(owner ?? "");
  const validRepository =
    /^[A-Za-z0-9._-]+$/.test(repositoryName ?? "") &&
    /[A-Za-z0-9]/.test(repositoryName ?? "");
  if (parts.length !== 2 || !validOwner || !validRepository) {
    throw new Error("repository must use the owner/repository form");
  }

  const siteOverride = optionalValue(siteUrlOverride);
  const baseOverride = optionalValue(basePathOverride);
  const normalizedBaseOverride =
    baseOverride === undefined ? undefined : normalizePagesBase(baseOverride);
  if (siteOverride && normalizedBaseOverride) {
    throw new Error("A custom domain SITE_URL cannot use a non-root BASE_PATH");
  }
  const isUserSite =
    repositoryName.toLowerCase() === `${owner.toLowerCase()}.github.io`;

  return {
    siteUrl: siteOverride
      ? normalizeSiteUrl(siteOverride)
      : `https://${owner}.github.io`,
    basePath:
      normalizedBaseOverride !== undefined
        ? normalizedBaseOverride
        : siteOverride || isUserSite
          ? ""
          : normalizeBase(repositoryName),
  };
}

async function runCli() {
  const config = resolvePagesConfig({
    repository: process.env.GITHUB_REPOSITORY,
    siteUrlOverride: process.env.SITE_URL_OVERRIDE,
    basePathOverride: process.env.BASE_PATH_OVERRIDE,
  });
  const outputPath = optionalValue(process.env.GITHUB_OUTPUT);
  if (!outputPath) {
    throw new Error("GITHUB_OUTPUT is required when running the Pages resolver CLI");
  }

  await appendFile(
    outputPath,
    `site_url=${config.siteUrl}\nbase_path=${config.basePath}\n`,
    "utf8",
  );
  console.log(`Resolved GitHub Pages configuration for ${config.siteUrl}${config.basePath}/`);
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
