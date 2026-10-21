/**
 * Wordora — Unit Tests: DB Puzzle Schedule (functions/_shared/puzzles.js)
 *
 * Uses a minimal in-memory stand-in for the MongoDB `puzzles` collection.
 */

'use strict';

const { getAnswerForPuzzle, getAnswers } = require('../functions/_shared/words');

/**
 * In-memory fake of the subset of the MongoDB API used by puzzles.js.
 */
function createFakeDb(initialDocs = []) {
  const docs = new Map(initialDocs.map(d => [d.puzzleNumber, { ...d }]));

  const matches = (doc, filter) => Object.entries(filter).every(([key, cond]) => {
    const value = doc[key];
    if (cond && typeof cond === 'object') {
      if ('$lte' in cond && !(value <= cond.$lte)) return false;
      if ('$gte' in cond && !(value >= cond.$gte)) return false;
      if ('$ne' in cond && value === cond.$ne) return false;
      return true;
    }
    return value === cond;
  });

  const upsert = (filter, update) => {
    const existing = docs.get(filter.puzzleNumber);
    if (existing) return { upsertedCount: 0 };
    docs.set(filter.puzzleNumber, { ...update.$setOnInsert });
    return { upsertedCount: 1 };
  };

  const collection = {
    findOne: async (filter) => [...docs.values()].find(d => matches(d, filter)) || null,
    find: (filter) => ({ toArray: async () => [...docs.values()].filter(d => matches(d, filter)) }),
    countDocuments: async (filter) => [...docs.values()].filter(d => matches(d, filter)).length,
    aggregate: () => ({
      toArray: async () => {
        const last = new Map();
        for (const d of docs.values()) last.set(d.answer, Math.max(last.get(d.answer) ?? -Infinity, d.puzzleNumber));
        return [...last].map(([_id, lastPuzzleNumber]) => ({ _id, lastPuzzleNumber }));
      },
    }),
    updateOne: async (filter, update) => upsert(filter, update),
    bulkWrite: async (ops) => ({
      upsertedCount: ops.reduce((sum, op) => sum + upsert(op.updateOne.filter, op.updateOne.update).upsertedCount, 0),
    }),
  };

  return { db: { collection: () => collection }, docs };
}

/** Fresh module instance so the answer cache and mocks don't leak between tests. */
function loadPuzzles({ extraWords = [] } = {}) {
  jest.resetModules();
  if (extraWords.length) {
    const words = require('../functions/_shared/words');
    const base = words.getAnswers();
    jest.doMock('../functions/_shared/words', () => ({ ...words, getAnswers: () => [...base, ...extraWords] }));
  }
  return require('../functions/_shared/puzzles');
}

afterEach(() => {
  jest.dontMock('../functions/_shared/words');
});

describe('backfillHistory', () => {
  test('fills past puzzles with legacy formula answers', async () => {
    const { backfillHistory } = loadPuzzles();
    const { db, docs } = createFakeDb();

    const result = await backfillHistory(db, 1000);

    expect(result.inserted).toBe(1000);
    for (const n of [1, 500, 784, 1000]) {
      expect(docs.get(n).answer).toBe(getAnswerForPuzzle(n));
      expect(docs.get(n).source).toBe('legacy');
    }
  });

  test('is idempotent and never overwrites existing records', async () => {
    const { backfillHistory } = loadPuzzles();
    const { db, docs } = createFakeDb([{ puzzleNumber: 5, answer: 'MANUL' }]);

    await backfillHistory(db, 10);
    const second = await backfillHistory(db, 10);

    expect(second.inserted).toBe(0);
    expect(docs.get(5).answer).toBe('MANUL');
    expect(docs.size).toBe(10);
  });

  test('dry run writes nothing', async () => {
    const { backfillHistory } = loadPuzzles();
    const { db, docs } = createFakeDb();

    const result = await backfillHistory(db, 50, { dryRun: true });

    expect(result.missing).toBe(50);
    expect(docs.size).toBe(0);
  });
});

describe('scheduleUpcoming', () => {
  const TODAY = 1025;

  test('with no new words, continues exactly like the legacy formula', async () => {
    const { backfillHistory, scheduleUpcoming } = loadPuzzles();
    const { db, docs } = createFakeDb();
    await backfillHistory(db, TODAY);

    const { scheduled } = await scheduleUpcoming(db, TODAY + 1, 30);

    expect(scheduled).toHaveLength(30);
    for (let n = TODAY + 1; n <= TODAY + 30; n++) {
      expect(docs.get(n).answer).toBe(getAnswerForPuzzle(n));
    }
  });

  test('picks never-used words first and leaves history untouched', async () => {
    const extraWords = ['QUIRK', 'ZESTY'];
    const { backfillHistory, scheduleUpcoming } = loadPuzzles({ extraWords });
    const { db, docs } = createFakeDb();
    await backfillHistory(db, TODAY);
    const todayAnswerBefore = docs.get(TODAY).answer;

    const { unusedWordsRemaining } = await scheduleUpcoming(db, TODAY + 1, 5);

    expect(docs.get(TODAY + 1).answer).toBe('QUIRK');
    expect(docs.get(TODAY + 2).answer).toBe('ZESTY');
    expect(docs.get(TODAY).answer).toBe(todayAnswerBefore);
    expect(unusedWordsRemaining).toBe(0);
  });

  test('does not repeat a word within the scheduled window', async () => {
    const { backfillHistory, scheduleUpcoming } = loadPuzzles();
    const { db, docs } = createFakeDb();
    await backfillHistory(db, TODAY);

    await scheduleUpcoming(db, TODAY + 1, 100);

    const upcoming = [];
    for (let n = TODAY + 1; n <= TODAY + 100; n++) upcoming.push(docs.get(n).answer);
    expect(new Set(upcoming).size).toBe(100);
  });

  test('never changes already-scheduled puzzles', async () => {
    const { backfillHistory, scheduleUpcoming } = loadPuzzles();
    const { db, docs } = createFakeDb([{ puzzleNumber: TODAY + 3, answer: 'MANUL' }]);
    await backfillHistory(db, TODAY);

    const { scheduled } = await scheduleUpcoming(db, TODAY + 1, 5);

    expect(scheduled).toHaveLength(4);
    expect(docs.get(TODAY + 3).answer).toBe('MANUL');
  });

  test('only uses words from the answer list', async () => {
    const { backfillHistory, scheduleUpcoming } = loadPuzzles();
    const { db, docs } = createFakeDb();
    await backfillHistory(db, TODAY);
    await scheduleUpcoming(db, TODAY + 1, 30);

    const pool = new Set(getAnswers());
    for (let n = TODAY + 1; n <= TODAY + 30; n++) expect(pool.has(docs.get(n).answer)).toBe(true);
  });
});

describe('resolveAnswer', () => {
  test('returns the scheduled answer from the DB', async () => {
    const { resolveAnswer } = loadPuzzles();
    const { db } = createFakeDb([{ puzzleNumber: 42, answer: 'MANUL' }]);

    expect(await resolveAnswer(db, 42)).toBe('MANUL');
  });

  test('falls back to the legacy formula when the DB is unavailable', async () => {
    const { resolveAnswer } = loadPuzzles();

    expect(await resolveAnswer(null, 42)).toBe(getAnswerForPuzzle(42));
  });

  test('falls back to the legacy formula when the puzzle is not scheduled', async () => {
    const { resolveAnswer } = loadPuzzles();
    const { db } = createFakeDb();
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(await resolveAnswer(db, 42)).toBe(getAnswerForPuzzle(42));
    spy.mockRestore();
  });
});
