"use client";

import type { DbClip } from "@/lib/types";
import { formatTimestamp } from "@/lib/format";

interface ClipHistoryProps {
  clips: DbClip[];
  loading: boolean;
}

/**
 * Grid of the logged-in user's previously generated clips, loaded from the
 * Supabase `clips` table.
 */
export default function ClipHistory({ clips, loading }: ClipHistoryProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-56 animate-pulse rounded-2xl border border-white/10 bg-white/5"
          />
        ))}
      </div>
    );
  }

  if (clips.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-10 text-center text-sm text-zinc-400">
        You haven&apos;t saved any clips yet. Generate some above and they&apos;ll
        show up here.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {clips.map((clip) => {
        const duration = Math.round(clip.end_time - clip.start_time);
        return (
          <article
            key={clip.id}
            className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5"
          >
            <div className="aspect-video bg-black">
              {clip.file_url ? (
                <video
                  className="h-full w-full object-cover"
                  src={clip.file_url}
                  controls
                  preload="metadata"
                  playsInline
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-zinc-500">
                  No preview
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2 p-4">
              <p
                className="truncate text-sm font-medium text-white"
                title={clip.original_stream_url}
              >
                {clip.original_stream_url}
              </p>
              <p className="text-xs text-zinc-400">
                {formatTimestamp(clip.start_time)} →{" "}
                {formatTimestamp(clip.end_time)} · {duration}s
              </p>
              <p className="text-xs text-zinc-500">
                {new Date(clip.created_at).toLocaleString()}
              </p>
              {clip.file_url && (
                <a
                  href={clip.file_url}
                  download
                  className="mt-auto inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
                >
                  Download MP4
                </a>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
