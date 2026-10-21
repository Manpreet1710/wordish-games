/**
 * Netlify Scheduled Function — Daily Puzzle Scheduler
 *
 * Schedule: 0 0 * * * (UTC midnight, every day)
 *
 * Responsibilities:
 * 1. Determines today's UTC date and puzzle number
 * 2. Backfills any missing past puzzles from the legacy word-list formula (self-healing)
 * 3. Keeps the next SCHEDULE_AHEAD_DAYS puzzles assigned in MongoDB (see _shared/puzzles.js)
 * 4. Marks today's puzzle as "published"
 * 5. Warns when the answer list is running out of never-used words
 * 6. Safe to re-run — every step is idempotent and never changes an assigned answer
 *
 * Because answers are scheduled ahead, the game keeps working even if this
 * function fails for several days in a row.
 *
 * Failure recovery:
 * - Check Netlify Function logs for errors
 * - Run manually: netlify functions:invoke publish-puzzle --no-identity
 * - Or locally: npm run seed-db
 */

'use strict';

const { getPuzzleNumberForDate, getTodayUTC } = require('./_shared/words');
const { getTrustedNow } = require('./_shared/time');
const { backfillHistory, scheduleUpcoming, SCHEDULE_AHEAD_DAYS } = require('./_shared/puzzles');

// Warn when fewer never-used words remain than this many days
const LOW_WORDS_THRESHOLD = 60;

/**
 * @type {import('@netlify/functions').ScheduledHandler}
 */
exports.handler = async function handler(event) {
  const startTime = Date.now();
  const now = await getTrustedNow();
  const date = getTodayUTC(now);
  const puzzleNumber = getPuzzleNumberForDate(now);

  console.log(`[publish-puzzle] Starting for date=${date}, puzzleNumber=${puzzleNumber}`);

  let database;
  try {
    const { connectToDatabase } = require('./_shared/db');
    database = (await connectToDatabase()).db;
  } catch (dbErr) {
    console.error('[publish-puzzle] MongoDB connection failed:', dbErr.message);
    // Game keeps running on already-scheduled puzzles (or the legacy word list)
    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'no-db', date, puzzleNumber, duration: Date.now() - startTime }),
    };
  }

  try {
    const backfill = await backfillHistory(database, puzzleNumber);
    if (backfill.inserted > 0) {
      console.log(`[publish-puzzle] Backfilled ${backfill.inserted} past puzzles from legacy word list`);
    }

    const { scheduled, unusedWordsRemaining } = await scheduleUpcoming(database, puzzleNumber + 1, SCHEDULE_AHEAD_DAYS);
    console.log(`[publish-puzzle] Scheduled ${scheduled.length} new puzzles (next ${SCHEDULE_AHEAD_DAYS} days covered)`);

    if (unusedWordsRemaining < LOW_WORDS_THRESHOLD) {
      console.warn(`[publish-puzzle] Only ${unusedWordsRemaining} never-used words left — add words to data/answers.js (words will start repeating)`);
    }

    const publishResult = await database.collection('puzzles').updateOne(
      { puzzleNumber, published: { $ne: true } },
      { $set: { published: true, publishedAt: now, updatedAt: now } }
    );

    const duration = Date.now() - startTime;
    console.log(`[publish-puzzle] Done for puzzle #${puzzleNumber} (${date}) in ${duration}ms`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: publishResult.modifiedCount ? 'published' : 'already-published',
        date,
        puzzleNumber,
        backfilled: backfill.inserted,
        scheduled: scheduled.length,
        unusedWordsRemaining,
        duration,
      }),
    };
  } catch (err) {
    console.error('[publish-puzzle] Scheduling failed:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ status: 'error', error: err.message, date, puzzleNumber }),
    };
  }
};
