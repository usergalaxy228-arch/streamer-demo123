"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";

import ClipGallery from "@/components/ClipGallery";
import ClipHistory from "@/components/ClipHistory";
import LoadingSteps, { PROCESSING_STEPS } from "@/components/LoadingSteps";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Clip, ClipResponse, ClipError, DbClip } from "@/lib/types";

type Status = "idle" | "loading" | "done" | "error";

export default function Home() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [activeStep, setActiveStep] = useState(0);
  const [clips, setClips] = useState<Clip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<ClipResponse["source"] | null>(null);

  // Auth + saved-clip history.
  const [user, setUser] = useState<User | null>(null);
  const [history, setHistory] = useState<DbClip[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const stepTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  /** Load the current user's saved clips from Supabase. */
  const loadHistory = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setHistoryLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("clips")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setHistory(data as DbClip[]);
    setHistoryLoading(false);
  }, []);

  // Track auth state and (re)load history when the user changes.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) loadHistory();
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadHistory();
      else setHistory([]);
    });

    return () => sub.subscription.unsubscribe();
  }, [loadHistory]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setHistory([]);
  }

  function clearStepTimers() {
    stepTimers.current.forEach(clearTimeout);
    stepTimers.current = [];
  }

  /** Advance the visible pipeline steps on a timer while the request is in flight. */
  function startStepAnimation() {
    setActiveStep(0);
    clearStepTimers();
    // Advance through the steps on a timer; hold on the last one until the
    // response resolves.
    for (let i = 1; i < PROCESSING_STEPS.length; i++) {
      stepTimers.current.push(setTimeout(() => setActiveStep(i), i * 500));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || status === "loading") return;

    setStatus("loading");
    setError(null);
    setClips([]);
    setSource(null);
    startStepAnimation();

    try {
      const res = await fetch("/api/clip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!res.ok) {
        const data = (await res.json()) as ClipError;
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      const data = (await res.json()) as ClipResponse;
      clearStepTimers();
      setClips(data.clips);
      setSource(data.source);
      setStatus("done");
      // If the clips were persisted, refresh the saved-clips history.
      if (data.source.saved) loadHistory();
    } catch (err) {
      clearStepTimers();
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Ambient gradient backdrop */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(139,92,246,0.18),transparent_70%)]" />

      {/* Top nav with auth state */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="text-sm font-semibold tracking-tight">Clipify</span>
        {isSupabaseConfigured ? (
          user ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="hidden text-zinc-400 sm:inline">
                {user.email}
              </span>
              <button
                onClick={handleSignOut}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-medium text-white transition hover:bg-white/10"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-violet-500"
            >
              Log in
            </Link>
          )
        ) : (
          <span className="text-xs text-zinc-500">Supabase not configured</span>
        )}
      </header>

      <div className="mx-auto max-w-6xl px-6 pb-16 pt-8 sm:pb-24 sm:pt-12">
        {/* Hero */}
        <section className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-violet-300">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
            Clipify · Automated Stream Clipper
          </span>

          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
            Turn your streams into{" "}
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              viral clips
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-balance text-zinc-400">
            Paste a stream URL and Clipify reads the chat, finds the moments
            everyone lost it, and cuts them into ready-to-share clips.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mx-auto mt-8 flex w-full max-w-xl flex-col gap-3 sm:flex-row"
          >
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://twitch.tv/videos/… or a VOD ID"
              disabled={status === "loading"}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-violet-400/50 focus:outline-none focus:ring-2 focus:ring-violet-500/30 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={status === "loading" || !url.trim()}
              className="shrink-0 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "loading" ? "Generating…" : "Generate Clips"}
            </button>
          </form>
        </section>

        {/* Results / states */}
        <section className="mt-16">
          {status === "loading" && <LoadingSteps activeStep={activeStep} />}

          {status === "error" && (
            <div className="mx-auto max-w-md rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-300">
              {error}
            </div>
          )}

          {status === "done" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">
                  {clips.length} clip{clips.length === 1 ? "" : "s"} generated
                </h2>
                {source && (
                  <p className="text-xs text-zinc-500">
                    Analyzed {source.messagesAnalyzed} chat messages ·{" "}
                    {source.durationSeconds}s source
                  </p>
                )}
              </div>
              <ClipGallery clips={clips} />
              {source && !source.saved && (
                <p className="text-center text-xs text-zinc-500">
                  {isSupabaseConfigured ? (
                    <>
                      <Link
                        href="/login"
                        className="text-violet-400 hover:underline"
                      >
                        Log in
                      </Link>{" "}
                      to save these clips to your history.
                    </>
                  ) : (
                    "Configure Supabase to save clips to your history."
                  )}
                </p>
              )}
            </div>
          )}
        </section>

        {/* Saved clips history (logged-in users only) */}
        {isSupabaseConfigured && user && (
          <section className="mt-20 border-t border-white/10 pt-12">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Your saved clips</h2>
              <button
                onClick={loadHistory}
                className="text-xs text-zinc-400 hover:text-white"
              >
                Refresh
              </button>
            </div>
            <ClipHistory clips={history} loading={historyLoading} />
          </section>
        )}
      </div>
    </main>
  );
}
