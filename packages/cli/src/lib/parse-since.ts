export function parseSince(since: string): number {
  const relative = since.match(/^(\d+)(s|m|h|d)$/);
  if (relative) {
    const n = parseInt(relative[1]!, 10);
    const unit = relative[2]!;
    const ms: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return Math.floor((Date.now() - n * ms[unit]!) / 1000);
  }
  const ts = Date.parse(since);
  if (isNaN(ts)) throw new Error(`--since: unrecognized format "${since}". Use ISO date or duration like 1h, 24h, 7d.`);
  return Math.floor(ts / 1000);
}
