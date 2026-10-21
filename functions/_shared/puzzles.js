/**
 * Puzzle answer schedule (MongoDB `puzzles` collection is the source of truth).
 *
 * - Each puzzle number gets its answer written ONCE and never changes afterwards.
 *   Adding words to data/answers.js therefore never shifts past or current puzzles.
 * - The daily cron keeps SCHEDULE_AHEAD_DAYS of future puzzles pre-assigned, so a
 *   missed cron run (or several) does not interrupt the game.
 * - New words are chosen never-used first, then least-recently-used, in answer-list order.
 * - History before the schedule existed is backfilled from the legacy formula
 *   (ANSWERS[(n - 1) % length]) so those puzzles keep the answers players already saw.
 * - If MongoDB is unavailable or a puzzle is missing, answers fall back to the legacy formula.
 */

'use strict';

const { getAnswers, getAnswerForPuzzle: getLegacyAnswer, getDateForPuzzleNumber } = require('./words');

const SCHEDULE_AHEAD_DAYS = parseInt(process.env.SCHEDULE_AHEAD_DAYS || '30', 10);
const BACKFILL_BATCH_SIZE = 500;

// puzzleNumber -> answer. Assigned answers are immutable, so caching per instance is safe.
const answerCache = new Map();

/**
 * Resolves the answer for a puzzle: DB schedule first, legacy formula as fallback.
 *
 * @param {import('mongodb').Db|null} db
 * @param {number} puzzleNumber
 * @returns {Promise<string>} Uppercase 5-letter answer
 */
async function resolveAnswer(db, puzzleNumber) {
  if (answerCache.has(puzzleNumber)) return answerCache.get(puzzleNumber);

  if (db) {
    try {
      const doc = await db.collection('puzzles').findOne(
        { puzzleNumber },
        { projection: { answer: 1 } }
      );
      if (doc && doc.answer) {
        answerCache.set(puzzleNumber, doc.answer);
        return doc.answer;
      }
      console.error(`[puzzles] No scheduled answer for puzzle #${puzzleNumber}; using legacy word list`);
    } catch (err) {
      console.error(`[puzzles] Answer lookup failed for puzzle #${puzzleNumber}; using legacy word list:`, err.message);
    }
  }

  // Not cached, so the DB answer is picked up again once it is reachable
  return getLegacyAnswer(puzzleNumber);
}

/**
 * Writes legacy-formula answers for puzzles 1..upToPuzzleNumber that have no record.
 * Never overwrites existing records. Cheap no-op once history is complete.
 *
 * @param {import('mongodb').Db} db
 * @param {number} upToPuzzleNumber
 * @param {{ dryRun?: boolean }} [options]
 * @returns {Promise<{ missing: number, inserted: number }>}
 */
async function backfillHistory(db, upToPuzzleNumber, { dryRun = false } = {}) {
  const puzzles = db.collection('puzzles');

  const existingCount = await puzzles.countDocuments({ puzzleNumber: { $lte: upToPuzzleNumber } });
  if (existingCount >= upToPuzzleNumber) return { missing: 0, inserted: 0 };

  const existing = new Set(
    (await puzzles.find({ puzzleNumber: { $lte: upToPuzzleNumber } }, { projection: { puzzleNumber: 1 } }).toArray())
      .map(d => d.puzzleNumber)
  );

  const now = new Date();
  const ops = [];
  for (let n = 1; n <= upToPuzzleNumber; n++) {
    if (existing.has(n)) continue;
    ops.push({
      updateOne: {
        filter: { puzzleNumber: n },
        update: {
          $setOnInsert: {
            puzzleNumber: n,
            date: getDateForPuzzleNumber(n),
            answer: getLegacyAnswer(n),
            source: 'legacy',
            published: true,
            publishedAt: null,
            createdAt: now,
            updatedAt: now,
          },
        },
        upsert: true,
      },
    });
  }

  if (dryRun) return { missing: ops.length, inserted: 0 };

  let inserted = 0;
  for (let i = 0; i < ops.length; i += BACKFILL_BATCH_SIZE) {
    const result = await puzzles.bulkWrite(ops.slice(i, i + BACKFILL_BATCH_SIZE), { ordered: false });
    inserted += result.upsertedCount;
  }
  return { missing: ops.length, inserted };
}

/**
 * Ensures puzzles fromPuzzleNumber..fromPuzzleNumber+days-1 have an assigned answer.
 * Existing assignments (including manual edits) are never changed.
 *
 * @param {import('mongodb').Db} db
 * @param {number} fromPuzzleNumber
 * @param {number} [days]
 * @param {{ dryRun?: boolean }} [options]
 * @returns {Promise<{ scheduled: Array<{puzzleNumber: number, date: string}>, unusedWordsRemaining: number }>}
 */
async function scheduleUpcoming(db, fromPuzzleNumber, days = SCHEDULE_AHEAD_DAYS, { dryRun = false } = {}) {
  const puzzles = db.collection('puzzles');
  const toPuzzleNumber = fromPuzzleNumber + days - 1;

  const alreadyScheduled = new Set(
    (await puzzles.find(
      { puzzleNumber: { $gte: fromPuzzleNumber, $lte: toPuzzleNumber } },
      { projection: { puzzleNumber: 1 } }
    ).toArray()).map(d => d.puzzleNumber)
  );

  // word -> most recent puzzle number it was (or will be) the answer for
  const lastUsed = new Map(
    (await puzzles.aggregate([
      { $group: { _id: '$answer', lastPuzzleNumber: { $max: '$puzzleNumber' } } },
    ]).toArray()).map(d => [d._id, d.lastPuzzleNumber])
  );

  // Never-used words first (list order), then least recently used
  const answers = getAnswers();
  const queue = answers
    .map((word, index) => ({ word, index, last: lastUsed.has(word) ? lastUsed.get(word) : -Infinity }))
    .sort((a, b) => (a.last - b.last) || (a.index - b.index));


  const now = new Date();
  const scheduled = [];
  for (let n = fromPuzzleNumber; n <= toPuzzleNumber; n++) {
    if (alreadyScheduled.has(n)) continue;

    // Rotate: the chosen word becomes the most recently used
    const pick = queue.shift();
    pick.last = n;
    queue.push(pick);

    const date = getDateForPuzzleNumber(n);
    if (!dryRun) {
      try {
        const result = await puzzles.updateOne(
          { puzzleNumber: n },
          {
            $setOnInsert: {
              puzzleNumber: n,
              date,
              answer: pick.word,
              source: 'scheduler',
              published: false,
              publishedAt: null,
              createdAt: now,
              updatedAt: now,
            },
          },
          { upsert: true }
        );
        if (!result.upsertedCount) continue; // Another run assigned it first
      } catch (err) {
        if (err.code === 11000) continue; // Concurrent insert won the race
        throw err;
      }
    }
    scheduled.push({ puzzleNumber: n, date });
  }

  return {
    scheduled,
    unusedWordsRemaining: queue.filter(c => c.last === -Infinity).length,
  };
}

module.exports = {
  SCHEDULE_AHEAD_DAYS,
  resolveAnswer,
  backfillHistory,
  scheduleUpcoming,
};
