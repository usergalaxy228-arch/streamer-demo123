/**
 * analyzer.ts
 *
 * Chat-driven highlight detection.
 *
 * The core idea: a stream is "hype" when chat activity spikes. We measure that
 * activity with a sliding window over time, weighting each message by how
 * excited it looks (spam of "LMAO", "GG", "POG", emotes, exclamation marks,
 * etc). Windows whose weighted density rises well above the stream's baseline
 * become highlight candidates, and adjacent candidates are merged into clips.
 */

/** A single chat message. `timestamp` is seconds from the start of the VOD. */
export interface ChatMessage {
  /** Seconds from the start of the stream/VOD. */
  timestamp: number;
  /** Raw message text. */
  text: string;
  /** Optional author — unused by the algorithm today but handy for debugging. */
  user?: string;
}

/** A detected highlight window, in seconds from the start of the VOD. */
export interface Highlight {
  /** Clip start time (seconds). */
  start: number;
  /** Clip end time (seconds). */
  end: number;
  /** Clip length (seconds), i.e. `end - start`. */
  duration: number;
  /** Peak weighted density (messages-equivalent per window) inside the clip. */
  score: number;
  /** How many raw messages fall inside the clip. */
  messageCount: number;
}

export interface AnalyzeOptions {
  /** Sliding-window size in seconds. Default 15. */
  windowSize?: number;
  /** How far the window advances each step, in seconds. Default 5. */
  stepSize?: number;
  /**
   * A window is "hot" when its weighted density is at least this multiple of
   * the baseline (median) density. Default 2.5.
   */
  thresholdMultiplier?: number;
  /**
   * Absolute floor on weighted density for a window to qualify, so a dead
   * stream with a baseline near zero doesn't flag every stray message.
   * Default 4.
   */
  minDensity?: number;
  /** Merge hot windows that sit within this many seconds of each other. Default 10. */
  mergeGap?: number;
  /** Seconds of lead-in padding added before each clip. Default 5. */
  padBefore?: number;
  /** Seconds of tail padding added after each clip. Default 3. */
  padAfter?: number;
}

const DEFAULTS: Required<AnalyzeOptions> = {
  windowSize: 15,
  stepSize: 5,
  thresholdMultiplier: 2.5,
  minDensity: 4,
  mergeGap: 10,
  padBefore: 5,
  padAfter: 3,
};

/**
 * Excitement keywords and the weight each contributes. A message can match
 * several; weights stack (capped later) so "LMAOOO GG POG" scores high.
 */
const HYPE_TERMS: { pattern: RegExp; weight: number }[] = [
  { pattern: /\bl+m+a+o+\b/i, weight: 1.5 }, // lmao, lmaooo
  { pattern: /\blo+l+\b/i, weight: 1.0 }, // lol, loool
  { pattern: /\bg+g+\b/i, weight: 1.5 }, // gg, gggg
  { pattern: /\bpog+(ers|champ|u)?\b/i, weight: 2.0 }, // pog, pogchamp, poggers
  { pattern: /\bkekw?\b/i, weight: 1.5 }, // kek, kekw
  { pattern: /\bomg\b/i, weight: 1.5 },
  { pattern: /\bw+\b/i, weight: 0.75 }, // "W" / "WWWW" chat
  { pattern: /\bhype\b/i, weight: 1.5 },
  { pattern: /\bclip(?:\s?(?:it|this|that))?\b/i, weight: 2.5 }, // "clip it!" is a strong signal
  { pattern: /\bno\s?way\b/i, weight: 1.5 },
  { pattern: /\binsane\b/i, weight: 1.5 },
  { pattern: /\bactual(?:ly)?\s+cracked\b/i, weight: 1.5 },
];

/** Emoji ranges commonly used for hype (faces, hands, fire, hearts, etc). */
const EMOJI_REGEX =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F02F}]/u;

/**
 * Score a single message's "excitement". Baseline is 1 (every message counts
 * as at least one unit of activity); hype terms, emotes, caps, and repeated
 * punctuation add on top. Capped so a single copy-pasta can't dominate.
 */
export function scoreMessage(text: string): number {
  let score = 1;

  for (const { pattern, weight } of HYPE_TERMS) {
    if (pattern.test(text)) score += weight;
  }

  // Emoji / emote spam.
  const emojiMatches = text.match(new RegExp(EMOJI_REGEX, "gu"));
  if (emojiMatches) score += Math.min(emojiMatches.length, 5) * 0.5;

  // Repeated exclamation / question marks: "!!!", "?!?!"
  const bangs = text.match(/[!?]{2,}/g);
  if (bangs) score += Math.min(bangs.length, 3) * 0.5;

  // ALL CAPS shouting (only counts if the message has some length).
  const letters = text.replace(/[^a-zA-Z]/g, "");
  if (letters.length >= 3 && letters === letters.toUpperCase()) {
    score += 1;
  }

  // A single message can contribute at most this much, so one spammer isn't a
  // "highlight" on their own — real highlights come from many messages.
  return Math.min(score, 6);
}

/** Median of a numeric array (returns 0 for an empty array). */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

interface Window {
  start: number;
  end: number;
  /** Sum of message excitement scores in this window. */
  density: number;
  /** Raw message count in this window. */
  count: number;
}

/**
 * Analyze chat messages and return highlight windows where activity spikes.
 *
 * @param messages Chat messages with timestamps (seconds from VOD start).
 * @param options  Tuning knobs (window size, thresholds, padding, …).
 * @returns Highlights sorted by start time.
 */
export function analyzeChat(
  messages: ChatMessage[],
  options: AnalyzeOptions = {}
): Highlight[] {
  const opts = { ...DEFAULTS, ...options };

  if (messages.length === 0) return [];

  // Work on a time-sorted copy so callers don't have to pre-sort.
  const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp);
  const streamEnd = sorted[sorted.length - 1].timestamp;

  // 1) Slide a window across the whole timeline, summing excitement per window.
  const windows: Window[] = [];
  for (
    let start = 0;
    start <= streamEnd;
    start += opts.stepSize
  ) {
    const end = start + opts.windowSize;
    let density = 0;
    let count = 0;
    for (const msg of sorted) {
      // sorted, so we could break early, but timelines are small; keep it simple.
      if (msg.timestamp >= start && msg.timestamp < end) {
        density += scoreMessage(msg.text);
        count += 1;
      }
    }
    windows.push({ start, end, density, count });
  }

  // 2) Establish a baseline from windows that actually have chatter, then
  //    derive a threshold. Using the median (not mean) keeps a few huge spikes
  //    from inflating the baseline and hiding smaller-but-real highlights.
  const activeDensities = windows
    .map((w) => w.density)
    .filter((d) => d > 0);
  const baseline = median(activeDensities);
  const threshold = Math.max(
    baseline * opts.thresholdMultiplier,
    opts.minDensity
  );

  // 3) Flag "hot" windows.
  const hot = windows.filter((w) => w.density >= threshold);
  if (hot.length === 0) return [];

  // 4) Merge hot windows that overlap or sit within `mergeGap` seconds into
  //    single clip candidates.
  const clips: Window[] = [];
  for (const w of hot) {
    const last = clips[clips.length - 1];
    if (last && w.start <= last.end + opts.mergeGap) {
      last.end = Math.max(last.end, w.end);
      last.density = Math.max(last.density, w.density); // peak density
      last.count += w.count;
    } else {
      clips.push({ ...w });
    }
  }

  // 5) Turn candidates into padded highlights and recompute an accurate raw
  //    message count over the final (padded) span.
  return clips.map((clip) => {
    const start = Math.max(0, clip.start - opts.padBefore);
    const end = clip.end + opts.padAfter;
    const messageCount = sorted.filter(
      (m) => m.timestamp >= start && m.timestamp < end
    ).length;

    return {
      start: Number(start.toFixed(2)),
      end: Number(end.toFixed(2)),
      duration: Number((end - start).toFixed(2)),
      score: Number(clip.density.toFixed(2)),
      messageCount,
    };
  });
}
