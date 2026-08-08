/**
 * types.ts — shared shapes for the clip API and UI.
 */

import type { Highlight } from "./analyzer";

/** A generated clip, as returned by POST /api/clip and rendered in the gallery. */
export interface Clip extends Highlight {
  /** Stable id for React keys and downloads. */
  id: string;
  /** Human-friendly title, e.g. "Highlight 1". */
  title: string;
  /** URL the <video> element plays. */
  previewUrl: string;
  /** URL the "Download MP4" button points at. */
  downloadUrl: string;
  /** Suggested filename for the download. */
  filename: string;
}

/** Request body for POST /api/clip. */
export interface ClipRequest {
  /** A stream/VOD URL or bare ID. */
  url: string;
}

/** Success response for POST /api/clip. */
export interface ClipResponse {
  source: {
    url: string;
    /** Length of the (mock) source in seconds. */
    durationSeconds: number;
    /** Total mock chat messages analyzed. */
    messagesAnalyzed: number;
    /** Whether the clips were persisted to the user's history. */
    saved: boolean;
  };
  clips: Clip[];
}

/** Error response shape. */
export interface ClipError {
  error: string;
}

/** A row in the Supabase `clips` table. */
export interface DbClip {
  id: string;
  user_id: string;
  original_stream_url: string;
  start_time: number;
  end_time: number;
  file_url: string | null;
  created_at: string;
}

/** Map a generated {@link Clip} to a `clips` insert payload for a given user. */
export function clipToInsert(clip: Clip, userId: string, sourceUrl: string) {
  return {
    user_id: userId,
    original_stream_url: sourceUrl,
    start_time: clip.start,
    end_time: clip.end,
    file_url: clip.downloadUrl,
  };
}
