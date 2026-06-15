import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { unlink, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";

const execFileAsync = promisify(execFile);

function resolveFfmpegBin(): string {
  const env = process.env.FFMPEG_PATH?.trim();
  if (env) return env;
  if (typeof ffmpegPath === "string" && ffmpegPath) return ffmpegPath;
  return "ffmpeg";
}

const ffmpegBin = resolveFfmpegBin();

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
    await writeFile(input, new Uint8Array(gifBuffer));
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
        "-profile:v",
        "baseline",
        "-level",
        "3.0",
        "-vf",
        "scale='min(480,iw)':-2:flags=lanczos,fps=15",
        "-an",
        "-t",
        "30",
        output,
      ],
      { timeout: 90_000, maxBuffer: 48 * 1024 * 1024 },
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
