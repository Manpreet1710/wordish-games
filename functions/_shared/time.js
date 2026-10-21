/**
 * Trusted "now" for Netlify Functions.
 *
 * The machine clock can be wrong — most visibly in local dev, where changing
 * the OS date also moves `netlify dev`'s clock. This reads the HTTP `Date`
 * header from a well-known server, remembers the offset from the local clock,
 * and applies it to every subsequent call.
 *
 * - Offset is cached per Lambda instance for OFFSET_TTL_MS, so most calls make no network request.
 * - Any failure (offline, timeout, bad header) falls back to the local clock.
 * - Skipped under Jest (NODE_ENV=test) so tests never hit the network.
 */

'use strict';

const TIME_SOURCE_URL = process.env.TIME_SOURCE_URL || 'https://www.google.com';
const FETCH_TIMEOUT_MS = 1500;
const OFFSET_TTL_MS = 10 * 60 * 1000; // 10 minutes

let cachedOffsetMs = 0;
let offsetFetchedAt = 0; // Corrected time of last attempt; a local clock jump makes the cache look stale

/**
 * Fetches the offset (ms) between real time and the local clock.
 *
 * @returns {Promise<number|null>} Offset in ms, or null if unavailable
 */
async function fetchClockOffset() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const before = Date.now();
    const response = await fetch(TIME_SOURCE_URL, { method: 'HEAD', signal: controller.signal });
    const after = Date.now();

    const remoteMs = Date.parse(response.headers.get('date') || '');
    if (isNaN(remoteMs)) return null;

    // Date header has 1s resolution; compare against request midpoint
    return remoteMs - (before + after) / 2;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Returns the current time, corrected against an external clock when possible.
 *
 * @returns {Promise<Date>}
 */
async function getTrustedNow() {
  if (process.env.NODE_ENV === 'test') return new Date();

  const localNow = Date.now();
  const cacheAge = Math.abs(localNow + cachedOffsetMs - offsetFetchedAt);

  if (!offsetFetchedAt || cacheAge > OFFSET_TTL_MS) {
    const offset = await fetchClockOffset();
    if (offset !== null) {
      cachedOffsetMs = offset;
    } else {
      console.warn('[time] Could not reach time source; using last known offset');
    }
    // Record the attempt even on failure so an offline server isn't retried on every request
    offsetFetchedAt = Date.now() + cachedOffsetMs;
  }

  return new Date(Date.now() + cachedOffsetMs);
}

module.exports = {
  getTrustedNow,
};
