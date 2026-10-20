import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildPosterArgs,
  buildTranscodeArgs,
  optimizeImage,
} from "../scripts/media-tools.mjs";

let fixtureDirectory: string;

beforeEach(async () => {
  fixtureDirectory = await mkdtemp(path.join(tmpdir(), "portfolio-media-tools-"));
});

afterEach(async () => {
  await rm(fixtureDirectory, { recursive: true, force: true });
});

describe("optimizeImage", () => {
  it("bounds an oversized image and writes WebP", async () => {
    const input = path.join(fixtureDirectory, "oversized.png");
    const output = path.join(fixtureDirectory, "nested", "oversized.webp");
    await sharp({
      create: {
        width: 2400,
        height: 1200,
        channels: 3,
        background: "#123456",
      },
    })
      .png()
      .toFile(input);

    await optimizeImage({ input, output, maxLongEdge: 800, quality: 82 });

    const metadata = await sharp(await readFile(output)).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBeLessThanOrEqual(800);
    expect(metadata.height).toBeLessThanOrEqual(800);
  });

  it("never enlarges a small portrait image", async () => {
    const input = path.join(fixtureDirectory, "portrait.png");
    const output = path.join(fixtureDirectory, "portrait.webp");
    await sharp({
      create: {
        width: 320,
        height: 640,
        channels: 3,
        background: "#654321",
      },
    })
      .png()
      .toFile(input);

    await optimizeImage({ input, output, maxLongEdge: 1800, quality: 82 });

    const metadata = await sharp(await readFile(output)).metadata();
    expect(metadata.width).toBe(320);
    expect(metadata.height).toBe(640);
  });

  it("refuses to overwrite the input", async () => {
    const input = path.join(fixtureDirectory, "same.png");
    await sharp({
      create: {
        width: 20,
        height: 20,
        channels: 3,
        background: "#000000",
      },
    })
      .png()
      .toFile(input);

    await expect(
      optimizeImage({ input, output: input, maxLongEdge: 20, quality: 82 }),
    ).rejects.toThrow(/different/i);
  });
});

describe("ffmpeg argument builders", () => {
  it("builds explicit poster arguments without targeting the input", () => {
    const input = path.join(fixtureDirectory, "demo.mp4");
    const output = path.join(fixtureDirectory, "poster.png");
    const args = buildPosterArgs({ input, output, seconds: 1 });

    expect(args).toContain(input);
    expect(args.at(-1)).toBe(output);
    expect(args).toEqual(expect.arrayContaining(["-ss", "1", "-frames:v", "1"]));
    expect(args.join(" ")).toMatch(/trunc\(iw\/2\)\*2/);
    expect(args.join(" ")).toMatch(/trunc\(ih\/2\)\*2/);
    expect(output).not.toBe(input);
  });

  it("builds bounded H.264/AAC transcode arguments", () => {
    const input = path.join(fixtureDirectory, "source.mp4");
    const output = path.join(fixtureDirectory, "public.mp4");
    const args = buildTranscodeArgs({ input, output, maxWidth: 1280 });
    const command = args.join(" ");

    expect(args).toContain(input);
    expect(args.at(-1)).toBe(output);
    expect(command).toMatch(/trunc\(min\(iw,1280\)\/2\)\*2/);
    expect(command).toContain("-2");
    expect(args).toEqual(
      expect.arrayContaining([
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        "-pix_fmt",
        "yuv420p",
        "-crf",
        "24",
        "-movflags",
        "+faststart",
      ]),
    );
    expect(output).not.toBe(input);
  });

  it("rejects identical input and output paths", () => {
    const input = path.join(fixtureDirectory, "same.mp4");

    expect(() => buildPosterArgs({ input, output: input, seconds: 1 })).toThrow(
      /different/i,
    );
    expect(() =>
      buildTranscodeArgs({ input, output: input, maxWidth: 1280 }),
    ).toThrow(/different/i);
  });
});
