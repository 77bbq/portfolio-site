import { mkdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import ffmpegPath from "ffmpeg-static";

import {
  buildPosterArgs,
  buildTranscodeArgs,
  optimizeImage,
} from "./media-tools.mjs";

function parseOptions(argumentsList) {
  const options = {};

  for (let index = 0; index < argumentsList.length; index += 2) {
    const flag = argumentsList[index];
    const value = argumentsList[index + 1];
    if (!flag?.startsWith("--") || value === undefined) {
      throw new Error(`Expected --name value arguments, received: ${flag ?? ""}`);
    }
    options[flag.slice(2)] = value;
  }

  return options;
}

function required(options, key) {
  const value = options[key]?.trim();
  if (!value) {
    throw new Error(`Missing required --${key} argument`);
  }
  return value;
}

function numberOption(options, key, fallback) {
  const raw = options[key];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`--${key} must be a positive number`);
  }
  return value;
}

function runFfmpeg(args) {
  if (!ffmpegPath) {
    throw new Error("ffmpeg-static does not provide a binary for this platform");
  }

  const result = spawnSync(ffmpegPath, args, { stdio: "inherit" });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`ffmpeg exited with status ${result.status ?? "unknown"}`);
  }
}

export async function runMediaCommand(command, options) {
  const input = required(options, "input");
  const output = required(options, "output");

  if (command === "image") {
    await optimizeImage({
      input,
      output,
      maxLongEdge: numberOption(options, "max-long-edge", 1800),
      quality: numberOption(options, "quality", 82),
      fit: options.fit === "contain" ? "contain" : "inside",
    });
    return;
  }

  await mkdir(path.dirname(path.resolve(output)), { recursive: true });
  if (command === "poster") {
    runFfmpeg(
      buildPosterArgs({
        input,
        output,
        seconds: numberOption(options, "seconds", 1),
      }),
    );
    return;
  }

  if (command === "video") {
    runFfmpeg(
      buildTranscodeArgs({
        input,
        output,
        maxWidth: numberOption(options, "max-width", 1280),
      }),
    );
    return;
  }

  throw new Error(`Unknown media command: ${command}`);
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const [command, ...rawOptions] = process.argv.slice(2);
  runMediaCommand(command, parseOptions(rawOptions)).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
