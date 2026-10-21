/**
 * Simple in-memory rate limiter for Netlify Functions.
 * 
 * NOTE: In-memory rate limiting works per Lambda instance.
 * For production, replace with a Redis-backed or MongoDB-backed rate limiter.
 * This provides reasonable protection against script-kiddies and accidental loops.
 * 
 * Limits: 30 guess submissions per IP per 10-minute window.
 */

'use strict';

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS = 30;           // Per window per IP

// Map of ip -> { count, windowStart }
const ipWindows = new Map();

/**
 * Checks whether the given IP has exceeded the rate limit.
 * 
 * @param {string} ip - Client IP address
 * @returns {{ allowed: boolean, remaining: number, resetMs: number }}
 */
function checkRateLimit(ip) {
  const now = Date.now();
  const key = ip || 'unknown';

  let entry = ipWindows.get(key);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    // New window
    entry = { count: 0, windowStart: now };
    ipWindows.set(key, entry);
  }

  entry.count += 1;

  const remaining = Math.max(0, MAX_REQUESTS - entry.count);
  const resetMs = entry.windowStart + WINDOW_MS - now;

  if (entry.count > MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetMs };
  }

  return { allowed: true, remaining, resetMs };
}

/**
 * Extracts client IP from Netlify Function event headers.
 * 
 * @param {Object} headers
 * @returns {string}
 */
function getClientIP(headers) {
  return (
    headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    headers['x-nf-client-connection-ip'] ||
    headers['x-real-ip'] ||
    'unknown'
  );
}

/**
 * Cleanup old windows periodically (prevents memory leak in long-lived instances).
 * Called automatically every 30 minutes.
 */
function cleanup() {
  const now = Date.now();
  for (const [key, entry] of ipWindows.entries()) {
    if (now - entry.windowStart > WINDOW_MS * 2) {
      ipWindows.delete(key);
    }
  }
}

// Schedule cleanup (safe — setInterval is available in Lambda/Node runtimes)
if (typeof setInterval !== 'undefined') {
  setInterval(cleanup, 30 * 60 * 1000);
}

module.exports = { checkRateLimit, getClientIP };
