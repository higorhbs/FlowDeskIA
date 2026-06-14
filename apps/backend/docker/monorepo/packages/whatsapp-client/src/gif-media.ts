import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { unlink, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";

const execFileAsync = promisify(execFile);
const ffmpegBin = (typeof ffmpegPath === "string" && ffmpegPath) || "ffmpeg";

export async function gifFirstFrameJpeg(buffer: Buffer, maxWidth = 480): Promise<Buffer> {
  return sharp(buffer, { pages: 1 })
    .resize({ width: maxWidth, withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
}

export async function gifToMp4Buffer(gifBuffer: Buffer): Promise<Buffer | null> {
  const id = randomUUID();
  const input = join(tmpdir(), `fd-gif-${id}.gif`);
  const output = join(tmpdir(), `fd-gif-${id}.mp4`);
  try {
    await writeFile(input, gifBuffer);
    await execFileAsync(
      ffmpegBin,
      [
        "-y",
        "-i",
        input,
        "-movflags",
        "faststart",
        "-pix_fmt",
        "yuv420p",
        "-vf",
        "scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos,fps=12",
        "-an",
        "-t",
        "12",
        output,
      ],
      { timeout: 60_000, maxBuffer: 32 * 1024 * 1024 },
    );
    const mp4 = await readFile(output);
    return mp4.length ? mp4 : null;
  } catch {
    return null;
  } finally {
    await unlink(input).catch(() => undefined);
    await unlink(output).catch(() => undefined);
  }
}
