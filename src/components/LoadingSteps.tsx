"use client";

/** The ordered pipeline steps shown while a stream is being processed. */
export const PROCESSING_STEPS = [
  "Fetching stream…",
  "Analyzing chat…",
  "Detecting highlights…",
  "Cutting video…",
] as const;

interface LoadingStepsProps {
  /** Index of the currently-active step (0-based). */
  activeStep: number;
}

/**
 * Vertical stepper shown during processing. Steps before `activeStep` render
 * as done, the active one spins, and later ones are dimmed/pending.
 */
export default function LoadingSteps({ activeStep }: LoadingStepsProps) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/5 p-6">
      <ol className="space-y-4">
        {PROCESSING_STEPS.map((label, i) => {
          const state =
            i < activeStep ? "done" : i === activeStep ? "active" : "pending";
          return (
            <li key={label} className="flex items-center gap-3">
              <StepIcon state={state} />
              <span
                className={
                  state === "pending"
                    ? "text-zinc-500"
                    : state === "active"
                      ? "font-medium text-white"
                      : "text-zinc-300"
                }
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StepIcon({ state }: { state: "done" | "active" | "pending" }) {
  if (state === "done") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M16.704 5.29a.75.75 0 0 1 .006 1.06l-7.5 7.6a.75.75 0 0 1-1.07 0l-3.85-3.9a.75.75 0 1 1 1.07-1.052l3.315 3.36 6.965-7.062a.75.75 0 0 1 1.06-.006Z"
            clipRule="evenodd"
          />
        </svg>
      </span>
    );
  }

  if (state === "active") {
    return (
      <span
        className="h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-400"
        aria-label="in progress"
      />
    );
  }

  return (
    <span className="h-6 w-6 shrink-0 rounded-full border-2 border-white/15" />
  );
}
