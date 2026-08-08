"use client";

import type { Clip } from "@/lib/types";
import { formatTimestamp } from "@/lib/format";

interface ClipGalleryProps {
  clips: Clip[];
}

/**
 * Responsive grid of generated clips. Each card has an inline video player
 * preview, the highlight's timing/score metadata, and a Download MP4 button.
 */
export default function ClipGallery({ clips }: ClipGalleryProps) {
  if (clips.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-10 text-center text-sm text-zinc-400">
        No highlights were detected for this stream. Try another URL.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {clips.map((clip) => (
        <ClipCard key={clip.id} clip={clip} />
      ))}
    </div>
  );
}

function ClipCard({ clip }: { clip: Clip }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-lg shadow-black/20 transition hover:border-violet-400/40 hover:shadow-violet-500/10">
      <div className="relative aspect-video bg-black">
        <video
          className="h-full w-full object-cover"
          src={clip.previewUrl}
          controls
          preload="metadata"
          playsInline
        />
        <span className="pointer-events-none absolute right-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-xs font-medium text-white backdrop-blur">
          {clip.duration}s
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-white">{clip.title}</h3>
          <span
            title="Hype score — peak weighted chat density"
            className="shrink-0 rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-semibold text-violet-300"
          >
            🔥 {clip.score}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-zinc-400">
          <div className="flex justify-between">
            <dt>Start</dt>
            <dd className="font-mono text-zinc-200">
              {formatTimestamp(clip.start)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>End</dt>
            <dd className="font-mono text-zinc-200">
              {formatTimestamp(clip.end)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>Length</dt>
            <dd className="font-mono text-zinc-200">{clip.duration}s</dd>
          </div>
          <div className="flex justify-between">
            <dt>Messages</dt>
            <dd className="font-mono text-zinc-200">{clip.messageCount}</dd>
          </div>
        </dl>

        <a
          href={clip.downloadUrl}
          download={clip.filename}
          className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M10 2a.75.75 0 0 1 .75.75v8.19l2.72-2.72a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-1.06 0l-4-4a.75.75 0 1 1 1.06-1.06l2.72 2.72V2.75A.75.75 0 0 1 10 2Z" />
            <path d="M3.5 14.75a.75.75 0 0 1 .75.75v.75c0 .414.336.75.75.75h10a.75.75 0 0 0 .75-.75v-.75a.75.75 0 0 1 1.5 0v.75A2.25 2.25 0 0 1 15 18.5H5a2.25 2.25 0 0 1-2.25-2.25v-.75a.75.75 0 0 1 .75-.75Z" />
          </svg>
          Download MP4
        </a>
      </div>
    </article>
  );
}
