/**
 * test-clipper.ts
 *
 * Local smoke test for Phase 1. It:
 *   1. Runs the chat analyzer over mock chat data and prints detected highlights.
 *   2. Generates a short synthetic source video with FFmpeg (so no real VOD is
 *      needed), then cuts each detected highlight into its own clip.
 *
 * Run with:  npx tsx scripts/test-clipper.ts
 */

import { promises as fs } from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";

import { analyzeChat, type ChatMessage } from "../src/lib/analyzer";
import { cutVideo, probeVideo, binaries } from "../src/lib/ffmpeg";

const OUT_DIR = path.join(process.cwd(), "tmp", "test-output");
const SOURCE_VIDEO = path.join(OUT_DIR, "source.mp4");
const SOURCE_DURATION = 120; // seconds

/**
 * Build ~2 minutes of mock chat. Baseline is quiet small-talk; we inject two
 * hype bursts (a clutch play around 0:40 and a funny moment around 1:30) that
 * the analyzer should surface as highlights.
 */
function buildMockChat(): ChatMessage[] {
  const messages: ChatMessage[] = [];

  // --- Baseline chatter: ~1 low-energy message every ~6s across the stream ---
  const smallTalk = [
    "hi chat",
    "what game is this",
    "been here since the start",
    "gm everyone",
    "the music is nice",
    "how long is the stream today",
    "brb getting coffee",
    "nice setup",
  ];
  for (let t = 0; t < SOURCE_DURATION; t += 6) {
    messages.push({
      timestamp: t + (t % 3), // slight jitter
      text: smallTalk[(t / 6) % smallTalk.length | 0],
      user: `viewer${t % 7}`,
    });
  }

  // --- Burst 1: clutch play ~40s (dense, very hype) ---
  const hype1 = [
    "OMG",
    "NO WAY",
    "LMAOOO",
    "GG GG GG",
    "POGGERS 🔥🔥",
    "that was INSANE",
    "CLIP IT",
    "actually cracked",
    "W streamer",
    "KEKW",
    "HOW DID HE DO THAT",
    "🔥🔥🔥",
  ];
  hype1.forEach((text, i) => {
    messages.push({ timestamp: 38 + i * 0.7, text, user: `hype${i}` });
  });

  // --- Burst 2: funny moment ~90s (dense, lots of laughing) ---
  const hype2 = [
    "LMAO",
    "LOOOL",
    "im crying 😂😂",
    "KEKW KEKW",
    "clip that please",
    "HAHAHA",
    "GG",
    "😂😂😂",
    "no wayyy",
    "hype hype",
  ];
  hype2.forEach((text, i) => {
    messages.push({ timestamp: 87 + i * 0.6, text, user: `chatter${i}` });
  });

  return messages;
}

/** Generate a synthetic test video (color bars + tone) so we have real bytes to cut. */
function generateSourceVideo(): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(`testsrc=duration=${SOURCE_DURATION}:size=640x360:rate=30`)
      .inputOptions(["-f lavfi"])
      .input(`sine=frequency=440:duration=${SOURCE_DURATION}`)
      .inputOptions(["-f lavfi"])
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions(["-pix_fmt yuv420p", "-preset ultrafast"])
      .on("end", () => resolve())
      .on("error", (err: Error) =>
        reject(new Error(`Failed to generate source video: ${err.message}`))
      )
      .save(SOURCE_VIDEO);
  });
}

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(1).padStart(4, "0");
  return `${m}:${s}`;
}

async function main() {
  console.log("=== Clipify Phase 1 smoke test ===\n");
  console.log("FFmpeg binary:  ", binaries.ffmpegPath);
  console.log("FFprobe binary: ", binaries.ffprobePath, "\n");

  await fs.mkdir(OUT_DIR, { recursive: true });

  // --- Part 1: analyzer ---
  console.log("--- 1. Analyzing mock chat ---");
  const chat = buildMockChat();
  console.log(`Mock chat messages: ${chat.length}`);

  const highlights = analyzeChat(chat);
  console.log(`Detected ${highlights.length} highlight(s):\n`);
  highlights.forEach((h, i) => {
    console.log(
      `  #${i + 1}  ${fmt(h.start)} → ${fmt(h.end)}  ` +
        `(dur ${h.duration}s, score ${h.score}, ${h.messageCount} msgs)`
    );
  });

  if (highlights.length === 0) {
    throw new Error("Analyzer found no highlights — expected at least 2.");
  }
  console.log();

  // --- Part 2: FFmpeg ---
  console.log("--- 2. Generating synthetic source video ---");
  await generateSourceVideo();
  const probe = await probeVideo(SOURCE_VIDEO);
  const dur = probe.format.duration ?? 0;
  console.log(`Source: ${SOURCE_VIDEO} (${dur.toFixed(1)}s)\n`);

  console.log("--- 3. Cutting a clip per highlight ---");
  const clipPaths: string[] = [];
  for (let i = 0; i < highlights.length; i++) {
    const h = highlights[i];
    const outPath = path.join(OUT_DIR, `clip-${i + 1}.mp4`);
    const { elapsedMs } = await cutVideo(SOURCE_VIDEO, h.start, h.duration, outPath);
    const stat = await fs.stat(outPath);
    console.log(
      `  clip-${i + 1}.mp4  ${fmt(h.start)}+${h.duration}s  ` +
        `${(stat.size / 1024).toFixed(0)} KB  (${elapsedMs}ms)`
    );
    clipPaths.push(outPath);
  }

  // --- Verify each clip is a valid, roughly correct-length media file ---
  console.log("\n--- 4. Verifying clips ---");
  for (let i = 0; i < clipPaths.length; i++) {
    const clipProbe = await probeVideo(clipPaths[i]);
    const clipDur = clipProbe.format.duration ?? 0;
    const expected = highlights[i].duration;
    const ok = Math.abs(clipDur - expected) <= 2; // stream-copy keyframe slack
    console.log(
      `  clip-${i + 1}: ${clipDur.toFixed(1)}s (expected ~${expected}s) ${
        ok ? "✅" : "⚠️"
      }`
    );
  }

  console.log("\n✅ All done. Clips written to", OUT_DIR);
}

main().catch((err) => {
  console.error("\n❌ Test failed:");
  console.error(err);
  process.exit(1);
});
