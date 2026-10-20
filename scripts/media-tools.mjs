import { mkdir } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

function normalizedPath(filePath) {
  const resolved = path.resolve(filePath);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function assertDistinctPaths(input, output) {
  if (normalizedPath(input) === normalizedPath(output)) {
    throw new Error("Input and output paths must be different");
  }
}

function assertPositiveNumber(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number`);
  }
}

export async function optimizeImage({
  input,
  output,
  maxLongEdge,
  quality,
  fit = "inside",
}) {
  assertDistinctPaths(input, output);
  assertPositiveNumber(maxLongEdge, "maxLongEdge");
  assertPositiveNumber(quality, "quality");
  if (quality > 100) {
    throw new Error("quality must not exceed 100");
  }
  if (fit !== "inside" && fit !== "contain") {
    throw new Error(`Unsupported fit mode: ${fit}`);
  }

  const source = sharp(input, { failOn: "error" }).rotate();
  const metadata = await source.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`Unable to read image dimensions: ${input}`);
  }

  const resizeOptions =
    fit === "contain"
      ? {
          width: Math.min(maxLongEdge, metadata.width),
          height: Math.min(maxLongEdge, metadata.height),
          fit: "contain",
          withoutEnlargement: true,
          background: { r: 17, g: 24, b: 39, alpha: 1 },
        }
      : {
          width: maxLongEdge,
          height: maxLongEdge,
          fit: "inside",
          withoutEnlargement: true,
        };

  await mkdir(path.dirname(path.resolve(output)), { recursive: true });
  await source.resize(resizeOptions).webp({ quality }).toFile(output);
}

export function buildPosterArgs({ input, output, seconds }) {
  assertDistinctPaths(input, output);
  assertPositiveNumber(seconds, "seconds");

  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-ss",
    String(seconds),
    "-i",
    input,
    "-frames:v",
    "1",
    "-vf",
    "scale=w='trunc(iw/2)*2':h='trunc(ih/2)*2'",
    output,
  ];
}

export function buildTranscodeArgs({ input, output, maxWidth }) {
  assertDistinctPaths(input, output);
  assertPositiveNumber(maxWidth, "maxWidth");

  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    input,
    "-map",
    "0:v:0",
    "-map",
    "0:a?",
    "-vf",
    `scale=w='trunc(min(iw,${Math.floor(maxWidth)})/2)*2':h=-2`,
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "24",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    "-map_metadata",
    "-1",
    output,
  ];
}
