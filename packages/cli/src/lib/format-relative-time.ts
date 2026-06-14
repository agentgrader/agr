const SECOND = 1;
const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

export function formatRelativeTime(unixSeconds: number, nowMs = Date.now()): string {
  const thenMs = unixSeconds * 1000;
  const diffSec = Math.max(0, Math.floor((nowMs - thenMs) / 1000));

  if (diffSec < 10) return "just now";
  if (diffSec < MINUTE) return `${diffSec} seconds ago`;
  if (diffSec < 2 * MINUTE) return "1 minute ago";
  if (diffSec < HOUR) return `${Math.floor(diffSec / MINUTE)} minutes ago`;
  if (diffSec < 2 * HOUR) return "1 hour ago";
  if (diffSec < DAY) return `${Math.floor(diffSec / HOUR)} hours ago`;
  if (diffSec < 2 * DAY) return "1 day ago";
  if (diffSec < WEEK) return `${Math.floor(diffSec / DAY)} days ago`;

  return formatAbsoluteTime(unixSeconds);
}

export function formatAbsoluteTime(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRunWhen(unixSeconds: number, nowMs = Date.now()): string {
  const relative = formatRelativeTime(unixSeconds, nowMs);
  const absolute = formatAbsoluteTime(unixSeconds);
  if (relative === absolute) return absolute;
  return `${relative} (${absolute})`;
}

export function formatCompactDate(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Like formatRelativeTime, but for runs older than a week falls back to a
// short "Mon D" date instead of the full "Mon D, YYYY, H:MM AM/PM" string,
// so the result always fits in a fixed-width table column.
export function formatCompactWhen(unixSeconds: number, nowMs = Date.now()): string {
  const relative = formatRelativeTime(unixSeconds, nowMs);
  if (relative === formatAbsoluteTime(unixSeconds)) {
    return formatCompactDate(unixSeconds);
  }
  return relative;
}
