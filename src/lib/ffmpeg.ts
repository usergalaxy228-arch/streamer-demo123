/**
 * ffmpeg.ts
 *
 * Thin wrapper around fluent-ffmpeg for cutting clips out of a source video.
 *
 * We ship the actual FFmpeg/FFprobe binaries via `ffmpeg-static` /
 * `ffprobe-static` so nothing has to be installed on the host machine (there
 * is no system `ffmpeg` in this environment). If a system binary is ever
 * preferred, override the paths below or set the FFMPEG_PATH env var.
 */

import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";

// Point fluent-ffmpeg at the bundled binaries. `ffmpeg-static` exports the
// path as its default; `ffprobe-static` exports an object with `.path`.
const ffmpegPath = process.env.FFMPEG_PATH ?? (ffmpegStatic as unknown as string);
const ffprobePath = process.env.FFPROBE_PATH ?? ffprobeStatic.path;

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
if (ffprobePath) ffmpeg.setFfprobePath(ffprobePath);

export interface CutVideoResult {
  outputPath: string;
  /** Wall-clock time the cut took, in milliseconds. */
  elapsedMs: number;
}

export interface CutVideoOptions {
  /**
   * When true (default), copy the audio/video streams without re-encoding.
   * This is near-instant but cuts land on the nearest keyframe, so clip
   * boundaries can be off by a second or two.
   *
   * When false, the clip is re-encoded (H.264 / AAC) for frame-accurate cuts
   * at the cost of CPU time. Good for final exports.
   */
  copyStreams?: boolean;
}

/**
 * Cut a segment out of `inputPath` and write it to `outputPath`.
 *
 * @param inputPath  Path to the source video.
 * @param startTime  Clip start, in seconds from the start of the source.
 * @param duration   Clip length, in seconds.
 * @param outputPath Where to write the resulting clip (extension picks format).
 * @param options    See {@link CutVideoOptions}.
 * @returns Resolves with the output path and elapsed time once the file is written.
 */
export function cutVideo(
  inputPath: string,
  startTime: number,
  duration: number,
  outputPath: string,
  options: CutVideoOptions = {}
): Promise<CutVideoResult> {
  const { copyStreams = true } = options;

  if (startTime < 0) throw new Error(`startTime must be >= 0 (got ${startTime})`);
  if (duration <= 0) throw new Error(`duration must be > 0 (got ${duration})`);

  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    // `-ss` before the input (fast seek) + `-t` for duration is the standard,
    // performant way to trim. With stream copy this is essentially I/O-bound.
    const command = ffmpeg(inputPath)
      .setStartTime(startTime)
      .setDuration(duration);

    if (copyStreams) {
      command.outputOptions(["-c copy"]);
    } else {
      command
        .videoCodec("libx264")
        .audioCodec("aac")
        .outputOptions(["-preset veryfast", "-movflags +faststart"]);
    }

    command
      .on("end", () => {
        resolve({ outputPath, elapsedMs: Date.now() - startedAt });
      })
      .on("error", (err: Error) => {
        reject(new Error(`FFmpeg failed to cut ${inputPath}: ${err.message}`));
      })
      .save(outputPath);
  });
}

/**
 * Probe a media file for basic metadata (duration, format, streams).
 * Useful for validating a source before cutting, or for tests.
 */
export function probeVideo(inputPath: string): Promise<ffmpeg.FfprobeData> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, data) => {
      if (err) reject(new Error(`FFprobe failed for ${inputPath}: ${err.message}`));
      else resolve(data);
    });
  });
}

/** Resolved binary paths, exported for logging / diagnostics. */
export const binaries = { ffmpegPath, ffprobePath };
