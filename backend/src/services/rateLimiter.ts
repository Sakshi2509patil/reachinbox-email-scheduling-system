import { redis } from "../db/redis";

/**
 * Distributed, per-sender, per-hour-window rate limiter.
 *
 * Key shape: ratelimit:{senderId}:{YYYY-MM-DDTHH}
 * We INCR the counter and set a 1-hour TTL the first time it's created.
 * Because INCR + EXPIRE are combined in a single Lua script (EVAL), this is
 * atomic and safe even when many worker processes/instances hit it at once
 * (no "read-then-write" race, unlike an in-memory counter).
 */

const RESERVE_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if tonumber(current) == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[2])
end
if tonumber(current) > tonumber(ARGV[1]) then
  redis.call("DECR", KEYS[1])
  return 0
end
return 1
`;

function hourWindowKey(senderId: string, date: Date): string {
  const iso = date.toISOString(); // e.g. 2026-08-20T14:32:10.000Z
  const hourBucket = iso.slice(0, 13); // "2026-08-20T14"
  return `ratelimit:${senderId}:${hourBucket}`;
}

/**
 * Attempts to reserve one "send slot" for this sender in the hour window
 * containing `at`. Returns true if the slot was reserved (caller may send),
 * false if the sender's hourly cap for that window is already used up.
 */
export async function tryReserveSendSlot(
  senderId: string,
  hourlyLimit: number,
  at: Date = new Date()
): Promise<boolean> {
  const key = hourWindowKey(senderId, at);
  const result = await redis.eval(RESERVE_SCRIPT, 1, key, hourlyLimit, 3600);
  return result === 1;
}

/** Releases a previously reserved slot (used if send fails before completion). */
export async function releaseSendSlot(senderId: string, at: Date = new Date()) {
  const key = hourWindowKey(senderId, at);
  await redis.decr(key);
}

/**
 * Returns the start of the next hour window after `at`, i.e. where a
 * rate-limited job should be rescheduled to.
 */
export function nextHourWindowStart(at: Date = new Date()): Date {
  const next = new Date(at);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(next.getUTCHours() + 1);
  return next;
}
