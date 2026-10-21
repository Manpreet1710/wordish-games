/**
 * Wordora — Unit Tests: Puzzle Numbering & Date Handling
 */

'use strict';

const {
  getPuzzleNumberForDate,
  getDateForPuzzleNumber,
  getTodayUTC,
  getAnswerForPuzzle,
  getAnswers,
} = require('../functions/_shared/words');

// Epoch: 2026-10-01 = puzzle #1
const EPOCH = new Date('2026-10-01T00:00:00Z');

describe('getPuzzleNumberForDate', () => {
  test('epoch date = puzzle #1', () => {
    expect(getPuzzleNumberForDate(EPOCH)).toBe(1);
  });

  test('day after epoch = puzzle #2', () => {
    const day2 = new Date('2026-10-02T00:00:00Z');
    expect(getPuzzleNumberForDate(day2)).toBe(2);
  });

  test('one year later', () => {
    const oneYear = new Date('2027-10-01T00:00:00Z');
    // 365 days (no Feb 29 in between)
    expect(getPuzzleNumberForDate(oneYear)).toBe(366);
  });

  test('handles UTC midnight correctly', () => {
    // 23:59:59 UTC on day 1 should still be puzzle #1
    const endOfDay1 = new Date('2026-10-01T23:59:59Z');
    expect(getPuzzleNumberForDate(endOfDay1)).toBe(1);
    
    // 00:00:00 UTC on day 2 should be puzzle #2
    const startOfDay2 = new Date('2026-10-02T00:00:00Z');
    expect(getPuzzleNumberForDate(startOfDay2)).toBe(2);
  });

  test('does not depend on local timezone', () => {
    // Same instant parsed from different timezone notations should give same puzzle
    const utcMidnight = new Date('2027-06-15T00:00:00Z');
    const sameInstant = new Date('2027-06-15T05:30:00+05:30'); // Same UTC moment
    expect(getPuzzleNumberForDate(utcMidnight)).toBe(getPuzzleNumberForDate(sameInstant));
  });

  test('handles month boundaries', () => {
    const oct31 = new Date('2026-10-31T00:00:00Z');
    const nov1  = new Date('2026-11-01T00:00:00Z');
    expect(getPuzzleNumberForDate(nov1)).toBe(getPuzzleNumberForDate(oct31) + 1);
  });

  test('handles year boundaries', () => {
    const dec31 = new Date('2026-12-31T00:00:00Z');
    const jan1  = new Date('2027-01-01T00:00:00Z');
    expect(getPuzzleNumberForDate(jan1)).toBe(getPuzzleNumberForDate(dec31) + 1);
  });

  test('minimum puzzle number is 1 (no negative)', () => {
    const beforeEpoch = new Date('2026-09-30T00:00:00Z');
    expect(getPuzzleNumberForDate(beforeEpoch)).toBeGreaterThanOrEqual(1);
  });
});

describe('getDateForPuzzleNumber', () => {
  test('puzzle #1 returns epoch date', () => {
    expect(getDateForPuzzleNumber(1)).toBe('2026-10-01');
  });

  test('puzzle #2 returns day after epoch', () => {
    expect(getDateForPuzzleNumber(2)).toBe('2026-10-02');
  });

  test('round-trips with getPuzzleNumberForDate', () => {
    const testDates = [
      '2026-10-01', '2026-10-21', '2026-12-31', '2027-01-01',
      '2027-07-04', '2028-02-29', '2030-01-01',
    ];
    for (const dateStr of testDates) {
      const date = new Date(dateStr + 'T00:00:00Z');
      const puzzleNum = getPuzzleNumberForDate(date);
      const roundTripped = getDateForPuzzleNumber(puzzleNum);
      expect(roundTripped).toBe(dateStr);
    }
  });
});

describe('getTodayUTC', () => {
  test('returns YYYY-MM-DD format', () => {
    const today = getTodayUTC();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('with custom date', () => {
    expect(getTodayUTC(new Date('2024-06-15T12:00:00Z'))).toBe('2024-06-15');
  });

  test('with date at end of UTC day', () => {
    expect(getTodayUTC(new Date('2024-06-15T23:59:59Z'))).toBe('2024-06-15');
  });
});

describe('getAnswerForPuzzle', () => {
  test('legacy fallback is keyed by date (matches answers shown before the epoch change)', () => {
    const answers = getAnswers();
    // 2026-10-21 was puzzle #1025 under the 2024-01-01 epoch
    expect(getAnswerForPuzzle(getPuzzleNumberForDate(new Date('2026-10-21T00:00:00Z'))))
      .toBe(answers[1024 % answers.length]);
  });

  test('returns a 5-letter uppercase string', () => {
    const answer = getAnswerForPuzzle(1);
    expect(answer).toMatch(/^[A-Z]{5}$/);
  });

  test('same puzzle number always returns same answer', () => {
    expect(getAnswerForPuzzle(1)).toBe(getAnswerForPuzzle(1));
    expect(getAnswerForPuzzle(100)).toBe(getAnswerForPuzzle(100));
  });

  test('different puzzle numbers return different (usually) answers', () => {
    // At minimum, the first few should differ
    const first10 = new Set();
    for (let i = 1; i <= 10; i++) {
      first10.add(getAnswerForPuzzle(i));
    }
    expect(first10.size).toBeGreaterThan(1);
  });

  test('cycles through answer list beyond list length', () => {
    const answers = getAnswers();
    const len = answers.length;
    // Puzzle at len+1 should cycle back to first answer
    expect(getAnswerForPuzzle(len + 1)).toBe(getAnswerForPuzzle(1));
  });

  test('throws on invalid puzzle number', () => {
    expect(() => getAnswerForPuzzle(0)).toThrow(RangeError);
    expect(() => getAnswerForPuzzle(-1)).toThrow(RangeError);
    expect(() => getAnswerForPuzzle(1.5)).toThrow(RangeError);
  });

  test('large puzzle numbers work', () => {
    const answer = getAnswerForPuzzle(10000);
    expect(answer).toMatch(/^[A-Z]{5}$/);
  });
});

describe('Answer list integrity', () => {
  let answers;
  beforeAll(() => {
    answers = getAnswers();
  });

  test('has at least 100 answers', () => {
    expect(answers.length).toBeGreaterThanOrEqual(100);
  });

  test('all answers are exactly 5 uppercase letters', () => {
    for (const word of answers) {
      expect(word).toMatch(/^[A-Z]{5}$/);
    }
  });

  test('no duplicate answers', () => {
    const unique = new Set(answers);
    expect(unique.size).toBe(answers.length);
  });
});
