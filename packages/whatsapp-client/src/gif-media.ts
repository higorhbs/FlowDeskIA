import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { unlink, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";

const execFileAsync = promisify(execFile);

export async function gifFirstFrameJpeg(buffer: Buffer, maxWidth = 480): Promise<Buffer> {
  return sharp(buffer, { animated: true, pages: 1 })
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
      "ffmpeg",
      [
        "-y",
        "-i",
        input,
        "-movflags",
        "faststart",
        "-pix_fmt",
        "yuv420p",
        "-vf",
        "scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos,fps=15",
        "-an",
        "-t",
        "15",
        output,
      ],
      { timeout: 45_000 },
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
