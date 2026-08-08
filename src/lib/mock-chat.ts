/**
 * mock-chat.ts
 *
 * Deterministic mock chat generator used until real chat ingestion lands.
 * Produces a quiet baseline of small-talk with a few injected hype bursts so
 * the analyzer has clear spikes to detect.
 *
 * Deterministic on purpose: given the same `seed` it returns the same chat, so
 * API responses are stable and testable (no Math.random()).
 */

import type { ChatMessage } from "./analyzer";

const SMALL_TALK = [
  "hi chat",
  "what game is this",
  "gm everyone",
  "the music is nice",
  "how long is the stream today",
  "brb getting coffee",
  "nice setup",
  "first time catching you live",
];

const HYPE_LINES = [
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
  "im crying 😂😂",
  "no wayyy",
  "hype hype",
];

/** Simple string hash → 32-bit int, for deterministic seeding from a URL. */
function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface MockChatOptions {
  /** Total stream length in seconds. Default 120. */
  durationSeconds?: number;
  /** Seed (e.g. the source URL) so output is stable per input. */
  seed?: string;
}

/**
 * Generate mock chat: steady baseline chatter plus 2–3 hype bursts whose count
 * and placement are derived from the seed.
 */
export function generateMockChat(options: MockChatOptions = {}): ChatMessage[] {
  const { durationSeconds = 300, seed = "default" } = options;
  const h = hashString(seed);
  const messages: ChatMessage[] = [];

  // Baseline: one low-energy line roughly every 6s.
  for (let t = 0; t < durationSeconds; t += 6) {
    messages.push({
      timestamp: t + (t % 3),
      text: SMALL_TALK[(t / 6) % SMALL_TALK.length | 0],
      user: `viewer${t % 7}`,
    });
  }

  // 2–3 hype bursts, evenly spread across the middle of the stream with wide
  // gaps between them so each spike merges into its own distinct highlight.
  const burstCount = 2 + (h % 2); // 2 or 3
  const margin = durationSeconds * 0.12;
  const usable = durationSeconds - margin * 2;
  for (let b = 0; b < burstCount; b++) {
    const center = margin + (usable * (b + 0.5)) / burstCount;
    const size = 9 + ((h >> (b * 3)) % 5); // 9–13 messages
    for (let i = 0; i < size; i++) {
      messages.push({
        timestamp: center + i * 0.6,
        text: HYPE_LINES[(h + b * 5 + i) % HYPE_LINES.length],
        user: `hype${b}_${i}`,
      });
    }
  }

  return messages.sort((a, b) => a.timestamp - b.timestamp);
}
