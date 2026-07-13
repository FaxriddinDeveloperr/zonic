// Weekly Tanga window: coins live from Monday 00:00 to the next Monday 00:00 LOCAL time
// (Tashkent, UTC+5 by default) — unspent coins are burned at the boundary.
const OFFSET_MIN = Number(process.env.ECON_WEEK_TZ_OFFSET_MIN ?? 300); // +5h = Asia/Tashkent

const DAY_MS = 86_400_000;

/** The local Monday (yyyy-mm-dd) that the given instant's week starts on. */
export function weekMonday(now: Date = new Date()): string {
  const local = new Date(now.getTime() + OFFSET_MIN * 60_000);
  const back = (local.getUTCDay() + 6) % 7; // 0=Sun → 6, 1=Mon → 0 …
  return new Date(local.getTime() - back * DAY_MS).toISOString().slice(0, 10);
}

/** The instant the current week ends (= next Monday 00:00 local) — when unspent Tanga burns. */
export function weekEndsAt(now: Date = new Date()): Date {
  const mondayUtcMidnight = Date.parse(`${weekMonday(now)}T00:00:00.000Z`);
  return new Date(mondayUtcMidnight - OFFSET_MIN * 60_000 + 7 * DAY_MS);
}
