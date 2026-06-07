// Date/time helpers replicating the C# format strings (UTC, like DateTime.UtcNow).

const pad = (n: number, w = 2): string => String(n).padStart(w, '0');

/** C# "dd.MM.yyyy" (UTC). */
export function formatDate(d: Date): string {
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

/** C# "HH:mm" (UTC). */
export function formatHourMinute(d: Date): string {
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** C# "dd.MM.yyyy HH:mm:ss" (UTC) — DateTimeConverter on token DTOs. */
export function formatDateTime(d: Date): string {
  return (
    `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  );
}

/** C# TimeSpan "hh\\:mm\\:ss" from a millisecond duration. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** C# "yyyy-MM-ddTHH:mm:ss.fffZ" — ISO 8601 UTC (Dart DateTime.parse compatible). */
export function formatIso(d: Date): string {
  return d.toISOString();
}

/**
 * Tolerant parser: accepts "dd.MM.yyyy HH:mm:ss" (backend convention) OR ISO 8601
 * (what older app builds send). Returns null only if neither format matches.
 */
export function parseFlexibleDateTime(value: unknown): Date | null {
  const exact = parseExactDateTime(value);
  if (exact) return exact;
  if (typeof value !== 'string') return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : new Date(ms);
}

/** Parse exactly "dd.MM.yyyy HH:mm:ss" (UTC) like DateTime.TryParseExact; null on mismatch. */
export function parseExactDateTime(timestamp: unknown): Date | null {
  if (typeof timestamp !== 'string') return null;
  const m = timestamp.match(/^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, dd, MM, yyyy, HH, mm, ss] = m.map(Number);
  const date = new Date(Date.UTC(yyyy, MM - 1, dd, HH, mm, ss));
  if (
    date.getUTCFullYear() !== yyyy ||
    date.getUTCMonth() !== MM - 1 ||
    date.getUTCDate() !== dd ||
    date.getUTCHours() !== HH ||
    date.getUTCMinutes() !== mm ||
    date.getUTCSeconds() !== ss
  )
    return null;
  return date;
}
