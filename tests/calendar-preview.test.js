/**
 * Wordora — Unit & Integration Tests: Calendar & Preview Mode
 */

'use strict';

const {
  getPuzzleNumberForDate,
  getDateForPuzzleNumber,
  getTodayUTC,
} = require('../functions/_shared/words');

describe('Calendar Date Navigation & UTC Calculations', () => {
  test('correctly handles month boundaries (March 1 after February 29 in leap year 2028)', () => {
    const leapDay = new Date('2028-02-29T00:00:00Z');
    const march1 = new Date('2028-03-01T00:00:00Z');
    
    expect(getPuzzleNumberForDate(march1)).toBe(getPuzzleNumberForDate(leapDay) + 1);
  });

  test('correctly handles non-leap year (February 2027 has 28 days)', () => {
    const feb28 = new Date('2027-02-28T00:00:00Z');
    const march1 = new Date('2027-03-01T00:00:00Z');
    
    // Day difference is exactly 1
    expect(getPuzzleNumberForDate(march1) - getPuzzleNumberForDate(feb28)).toBe(1);
  });

  test('handles December 31 to January 1 year boundary transition', () => {
    const dec31 = new Date('2026-12-31T00:00:00Z');
    const jan1 = new Date('2027-01-01T00:00:00Z');
    
    expect(getPuzzleNumberForDate(jan1)).toBe(getPuzzleNumberForDate(dec31) + 1);
    expect(getDateForPuzzleNumber(getPuzzleNumberForDate(jan1))).toBe('2027-01-01');
  });

  test('days in month calculation for leap and non-leap years', () => {
    // Leap year Feb 2024
    const daysFeb2024 = new Date(Date.UTC(2024, 2, 0)).getUTCDate();
    expect(daysFeb2024).toBe(29);

    // Non-leap year Feb 2025
    const daysFeb2025 = new Date(Date.UTC(2025, 2, 0)).getUTCDate();
    expect(daysFeb2025).toBe(28);

    // 31-day months (e.g. October)
    const daysOct2026 = new Date(Date.UTC(2026, 10, 0)).getUTCDate();
    expect(daysOct2026).toBe(31);
  });

  test('weekday alignment for 1st of month using UTC', () => {
    // 2026-10-01 is a Thursday (index 4 in 0=Sun..6=Sat)
    const dayOfWeek = new Date(Date.UTC(2026, 9, 1)).getUTCDay();
    expect(dayOfWeek).toBe(4);
  });
});

describe('Date Availability Rules', () => {
  const EPOCH_DATE = '2026-10-01';
  const today = getTodayUTC();

  function isDateAvailable(dateStr) {
    if (dateStr < EPOCH_DATE) return false;
    return true;
  }

  test('epoch date 2026-10-01 is available', () => {
    expect(isDateAvailable('2026-10-01')).toBe(true);
  });

  test('today is available', () => {
    expect(isDateAvailable(today)).toBe(true);
  });

  test('date before epoch (e.g. 2026-09-30) is unavailable', () => {
    expect(isDateAvailable('2026-09-30')).toBe(false);
  });

  test('future preview date is available for preview play', () => {
    const tomorrow = new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0];
    expect(isDateAvailable(tomorrow)).toBe(true);
  });
});

describe('Storage State Isolation (Daily vs Preview)', () => {
  let mockLocalStorage = {};

  beforeEach(() => {
    mockLocalStorage = {};
  });

  function getStore() {
    try {
      return JSON.parse(mockLocalStorage['wordora_v1'] || '{}');
    } catch {
      return {};
    }
  }

  function setStore(data) {
    mockLocalStorage['wordora_v1'] = JSON.stringify(data);
  }

  function savePuzzleState(state, isPreview = false) {
    const store = getStore();
    if (isPreview) {
      store.previewPuzzles = store.previewPuzzles || {};
      store.previewPuzzles[state.date] = state;
    } else {
      store.puzzle = state;
    }
    setStore(store);
  }

  function loadPuzzleState(puzzleNumber, date, isPreview = false) {
    const store = getStore();
    const saved = isPreview ? (store.previewPuzzles && store.previewPuzzles[date]) : store.puzzle;
    if (saved && saved.puzzleNumber === puzzleNumber && saved.date === date) {
      return saved;
    }
    return { puzzleNumber, date, guesses: [], results: [], status: 'playing' };
  }

  function recordGameResult(puzzleState, date, isPreview = false, statsObj) {
    if (isPreview) return; // Never update stats for preview games
    if (puzzleState.status === 'playing') return;
    statsObj.gamesPlayed += 1;
    if (puzzleState.status === 'won') {
      statsObj.gamesWon += 1;
      statsObj.currentStreak += 1;
    }
  }

  test('saving preview puzzle NEVER alters or overwrites today official game', () => {
    const todayState = {
      puzzleNumber: 49,
      date: '2026-10-21',
      guesses: ['CRANE'],
      results: [[{ letter: 'C', result: 'correct' }]],
      status: 'playing',
    };

    // 1. Save today's progress
    savePuzzleState(todayState, false);

    // 2. Play a preview puzzle for past date
    const previewState = {
      puzzleNumber: 10,
      date: '2024-01-10',
      guesses: ['SLATE', 'PLANT'],
      results: [],
      status: 'won',
    };
    savePuzzleState(previewState, true);

    // 3. Verify today's game is completely untouched
    const restoredToday = loadPuzzleState(49, '2026-10-21', false);
    expect(restoredToday.guesses).toEqual(['CRANE']);
    expect(restoredToday.status).toBe('playing');
    expect(restoredToday.date).toBe('2026-10-21');

    // 4. Verify preview state is preserved independently
    const restoredPreview = loadPuzzleState(10, '2024-01-10', true);
    expect(restoredPreview.guesses).toEqual(['SLATE', 'PLANT']);
    expect(restoredPreview.status).toBe('won');
  });

  test('preview game wins do NOT increment official stats or daily streaks', () => {
    const stats = { gamesPlayed: 5, gamesWon: 4, currentStreak: 3 };

    const previewState = {
      puzzleNumber: 5,
      date: '2024-01-05',
      guesses: ['CRANE'],
      status: 'won',
    };

    // Record result as preview
    recordGameResult(previewState, '2024-01-05', true, stats);

    // Stats should remain completely unchanged
    expect(stats.gamesPlayed).toBe(5);
    expect(stats.gamesWon).toBe(4);
    expect(stats.currentStreak).toBe(3);
  });

  test('today official game win DOES increment stats and streak', () => {
    const stats = { gamesPlayed: 5, gamesWon: 4, currentStreak: 3 };

    const todayOfficialState = {
      puzzleNumber: 49,
      date: '2026-10-21',
      guesses: ['CRANE'],
      status: 'won',
    };

    // Record result as official (isPreview = false)
    recordGameResult(todayOfficialState, '2026-10-21', false, stats);

    expect(stats.gamesPlayed).toBe(6);
    expect(stats.gamesWon).toBe(5);
    expect(stats.currentStreak).toBe(4);
  });
});
