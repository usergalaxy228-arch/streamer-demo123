/** Format seconds as `m:ss` (e.g. 95 -> "1:35"). */
export function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}
