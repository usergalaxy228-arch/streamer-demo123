/**
 * POST /api/clip
 *
 * Accepts a stream URL (or bare ID), runs it through the mock pipeline, and
 * returns detected highlight clips.
 *
 * Phase 2 note: the download + video-cutting steps are MOCKED. We generate
 * deterministic mock chat, run the *real* analyzer over it, and map each
 * detected highlight to one of the pre-rendered sample clips in /public/samples.
 * The FFmpeg cutting from Phase 1 gets wired in during Phase 3.
 */

import { NextResponse } from "next/server";

import { analyzeChat } from "@/lib/analyzer";
import { generateMockChat } from "@/lib/mock-chat";
import type { Clip, ClipRequest, ClipResponse, ClipError } from "@/lib/types";

const SOURCE_DURATION = 300; // seconds of mock stream

// Pre-rendered sample clips we cycle through for previews (see /public/samples).
const SAMPLE_CLIPS = [
  "/samples/clip-1.mp4",
  "/samples/clip-2.mp4",
  "/samples/clip-3.mp4",
];

/** Small helper to fake per-step processing latency so the UI can show steps. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(
  request: Request
): Promise<NextResponse<ClipResponse | ClipError>> {
  let body: ClipRequest;
  try {
    body = (await request.json()) as ClipRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const url = body?.url?.trim();
  if (!url) {
    return NextResponse.json(
      { error: "A stream URL or ID is required." },
      { status: 400 }
    );
  }

  // --- MOCK: "download" the VOD ---
  await delay(600);

  // --- REAL: analyze chat for highlights ---
  const chat = generateMockChat({ durationSeconds: SOURCE_DURATION, seed: url });
  const highlights = analyzeChat(chat);
  await delay(400);

  // --- MOCK: "cut" each highlight into a clip ---
  await delay(500);
  const clips: Clip[] = highlights.map((h, i) => ({
    ...h,
    id: `clip-${i + 1}`,
    title: `Highlight ${i + 1}`,
    previewUrl: SAMPLE_CLIPS[i % SAMPLE_CLIPS.length],
    downloadUrl: SAMPLE_CLIPS[i % SAMPLE_CLIPS.length],
    filename: `clipify-highlight-${i + 1}.mp4`,
  }));

  const response: ClipResponse = {
    source: {
      url,
      durationSeconds: SOURCE_DURATION,
      messagesAnalyzed: chat.length,
    },
    clips,
  };

  return NextResponse.json(response);
}
