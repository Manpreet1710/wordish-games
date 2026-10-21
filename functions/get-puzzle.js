/**
 * GET /.netlify/functions/get-puzzle
 * 
 * Returns public puzzle information for the current UTC day.
 * 
 * Security: Does NOT return the answer. Returns only metadata.
 * Caching: Public, cached for 60 seconds (balance freshness vs load).
 * 
 * Response body:
 * {
 *   puzzleNumber: number,
 *   date: string,        // YYYY-MM-DD UTC
 *   rulesVersion: number,
 *   maxAttempts: number,
 *   wordLength: number,
 *   nextPuzzleAt: string, // ISO timestamp of next UTC midnight
 *   serverTime: string    // ISO timestamp of trusted server "now"
 * }
 */

'use strict';

const { EPOCH_DATE, getPuzzleNumberForDate, getTodayUTC } = require('./_shared/words');
const { getTrustedNow } = require('./_shared/time');

const RULES_VERSION = 1;
const MAX_ATTEMPTS = 6;
const WORD_LENGTH = 5;

/**
 * Calculates milliseconds until next UTC midnight.
 * 
 * @param {Date} now
 * @returns {string} ISO timestamp of next midnight UTC
 */
function getNextPuzzleAt(now) {
  const d = now instanceof Date ? now : new Date();
  const tomorrow = new Date(Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() + 1, // next day
    0, 0, 0, 0
  ));
  return tomorrow.toISOString();
}

/**
 * @param {import('@netlify/functions').HandlerEvent} event
 * @returns {Promise<import('@netlify/functions').HandlerResponse>}
 */
exports.handler = async function handler(event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const now = await getTrustedNow();
    const today = getTodayUTC(now);
    const requestedDate = (event.queryStringParameters?.date || today).trim();

    // Validate format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
      return jsonResponse(400, { error: 'Invalid date format (expected YYYY-MM-DD)' });
    }

    // Verify date is valid calendar date
    const dObj = new Date(requestedDate + 'T00:00:00Z');
    if (isNaN(dObj.getTime()) || dObj.toISOString().split('T')[0] !== requestedDate) {
      return jsonResponse(400, { error: 'Invalid calendar date' });
    }

    // Epoch check (puzzle #1 = EPOCH_DATE)
    if (requestedDate < EPOCH_DATE) {
      return jsonResponse(404, {
        available: false,
        status: 'unavailable',
        error: `No puzzle exists before Wordora epoch (${EPOCH_DATE})`,
      });
    }

    const puzzleNumber = getPuzzleNumberForDate(dObj);
    const isToday = requestedDate === today;

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders(),
        'Content-Type': 'application/json',
        'Cache-Control': isToday
          ? 'public, max-age=60, stale-while-revalidate=30'
          : 'public, max-age=86400, stale-while-revalidate=3600',
      },
      body: JSON.stringify({
        puzzleNumber,
        date: requestedDate,
        today,
        available: true,
        isToday,
        isPreview: !isToday,
        rulesVersion: RULES_VERSION,
        maxAttempts: MAX_ATTEMPTS,
        wordLength: WORD_LENGTH,
        nextPuzzleAt: getNextPuzzleAt(now),
        serverTime: now.toISOString(),
      }),
    };
  } catch (err) {
    console.error('[get-puzzle] Error:', err.message);
    return jsonResponse(500, { error: 'Internal server error' });
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}
