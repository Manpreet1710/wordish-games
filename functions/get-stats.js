/**
 * GET /.netlify/functions/get-stats
 * 
 * Returns aggregated public statistics for today's puzzle.
 * No personal data exposed.
 * 
 * Response body:
 * {
 *   date: string,
 *   puzzleNumber: number,
 *   gamesStarted: number,
 *   gamesCompleted: number,
 *   gamesWon: number,
 *   winPercentage: number,
 *   attemptsDistribution: number[],  // [win_on_1, win_on_2, ..., win_on_6]
 * }
 */

'use strict';

const { getPuzzleNumberForDate, getTodayUTC } = require('./_shared/words');
const { getTrustedNow } = require('./_shared/time');

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const now = await getTrustedNow();
  const date = getTodayUTC(now);
  const puzzleNumber = getPuzzleNumberForDate(now);

  try {
    const { connectToDatabase } = require('./_shared/db');
    const { db } = await connectToDatabase();
    const stats = db.collection('dailyStats');

    const doc = await stats.findOne({ date });

    if (!doc) {
      // No games played yet today
      return jsonResponse(200, {
        date,
        puzzleNumber,
        gamesStarted: 0,
        gamesCompleted: 0,
        gamesWon: 0,
        winPercentage: 0,
        attemptsDistribution: [0, 0, 0, 0, 0, 0],
      });
    }

    const winPercentage = doc.gamesCompleted > 0
      ? Math.round((doc.gamesWon / doc.gamesCompleted) * 100)
      : 0;

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders(),
        'Content-Type': 'application/json',
        // Public stats can be cached briefly
        'Cache-Control': 'public, max-age=120, stale-while-revalidate=60',
      },
      body: JSON.stringify({
        date,
        puzzleNumber,
        gamesStarted: doc.gamesStarted || 0,
        gamesCompleted: doc.gamesCompleted || 0,
        gamesWon: doc.gamesWon || 0,
        winPercentage,
        attemptsDistribution: doc.attemptsDistribution || [0, 0, 0, 0, 0, 0],
      }),
    };
  } catch (err) {
    console.error('[get-stats] Error:', err.message);
    // Non-fatal — return empty stats instead of 500
    return jsonResponse(200, {
      date,
      puzzleNumber,
      gamesStarted: 0,
      gamesCompleted: 0,
      gamesWon: 0,
      winPercentage: 0,
      attemptsDistribution: [0, 0, 0, 0, 0, 0],
      unavailable: true,
    });
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
