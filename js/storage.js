/**
 * Wordora — localStorage Utilities
 * 
 * Handles all localStorage reads/writes with:
 * - Graceful fallback when localStorage is unavailable
 * - Schema versioning and corrupt data recovery
 * - UTC-date-based puzzle progress isolation
 * - No personal data beyond game state
 */

'use strict';

const STORAGE_KEY = 'wordora_v1';
const STATS_KEY = 'wordora_stats_v1';

// In-memory fallback when localStorage is unavailable
let _memoryStore = null;

/**
 * Tests whether localStorage is available.
 * @returns {boolean}
 */
function isStorageAvailable() {
  try {
    const test = '__wordora_test__';
    localStorage.setItem(test, '1');
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

const storageAvailable = isStorageAvailable();

function getStore() {
  if (!storageAvailable) return _memoryStore || {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return parsed;
  } catch {
    return {};
  }
}

function setStore(data) {
  if (!storageAvailable) {
    _memoryStore = data;
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or blocked — silently fail
  }
}

// ─────────────────────────────────────────────────────────────
// Puzzle Progress
// ─────────────────────────────────────────────────────────────

/**
 * Default puzzle state structure.
 */
function defaultPuzzleState(puzzleNumber, date) {
  return {
    puzzleNumber,
    date,
    guesses: [],        // Array of uppercase 5-letter strings
    results: [],        // Array of result arrays from evaluateGuess
    status: 'playing',  // 'playing' | 'won' | 'lost'
    keyboardState: {},  // { LETTER: 'correct'|'present'|'absent' }
  };
}

/**
 * Loads today's puzzle state.
 * Returns default state if no saved data or if saved data is for a different puzzle.
 * 
 * @param {number} puzzleNumber
 * @param {string} date - YYYY-MM-DD UTC
 * @returns {Object} Puzzle state
 */
function loadPuzzleState(puzzleNumber, date, isPreview = false) {
  const store = getStore();
  const saved = isPreview
    ? (store.previewPuzzles && store.previewPuzzles[date])
    : store.puzzle;

  // Validate saved data belongs to current puzzle
  if (
    saved &&
    typeof saved === 'object' &&
    saved.puzzleNumber === puzzleNumber &&
    saved.date === date &&
    Array.isArray(saved.guesses) &&
    Array.isArray(saved.results) &&
    ['playing', 'won', 'lost'].includes(saved.status)
  ) {
    return saved;
  }

  // Different puzzle or corrupt data — return fresh state
  return defaultPuzzleState(puzzleNumber, date);
}

/**
 * Saves puzzle state to localStorage.
 * Isolates preview puzzles in store.previewPuzzles so today's puzzle is untouched.
 * 
 * @param {Object} state
 * @param {boolean} [isPreview=false]
 */
function savePuzzleState(state, isPreview = false) {
  const store = getStore();
  if (isPreview) {
    if (!store.previewPuzzles || typeof store.previewPuzzles !== 'object') {
      store.previewPuzzles = {};
    }
    store.previewPuzzles[state.date] = state;
  } else {
    store.puzzle = state;
  }
  setStore(store);
}

// ─────────────────────────────────────────────────────────────
// Player Statistics
// ─────────────────────────────────────────────────────────────

/**
 * Default statistics structure.
 */
function defaultStats() {
  return {
    gamesPlayed: 0,
    gamesWon: 0,
    currentStreak: 0,
    maxStreak: 0,
    lastCompletedDate: null,   // YYYY-MM-DD UTC
    lastWonDate: null,
    distribution: [0, 0, 0, 0, 0, 0], // Win on attempt 1-6
  };
}

/**
 * Loads player statistics.
 * @returns {Object}
 */
function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return defaultStats();
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return defaultStats();
    // Merge with defaults to handle schema additions
    return { ...defaultStats(), ...parsed };
  } catch {
    return defaultStats();
  }
}

/**
 * Saves player statistics.
 * @param {Object} stats
 */
function saveStats(stats) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // Silently fail
  }
}

/**
 * Updates statistics after a completed game.
 * Idempotent: will not double-count if called multiple times for the same puzzle.
 * Preview games NEVER update official statistics or streaks.
 * 
 * @param {Object} puzzleState - Completed puzzle state
 * @param {string} date - YYYY-MM-DD UTC
 * @param {boolean} [isPreview=false]
 */
function recordGameResult(puzzleState, date, isPreview = false) {
  if (isPreview) return; // Preview games never affect official stats
  if (puzzleState.status === 'playing') return; // Not finished

  const stats = loadStats();

  // Idempotency: don't record twice for the same date
  if (stats.lastCompletedDate === date) return;

  stats.gamesPlayed += 1;

  if (puzzleState.status === 'won') {
    stats.gamesWon += 1;
    const attemptIndex = puzzleState.guesses.length - 1;
    if (attemptIndex >= 0 && attemptIndex < 6) {
      stats.distribution[attemptIndex] += 1;
    }

    // Streak logic: must have played yesterday to continue streak
    if (stats.lastWonDate) {
      const prevDate = new Date(stats.lastWonDate + 'T00:00:00Z');
      const todayDate = new Date(date + 'T00:00:00Z');
      const diffDays = Math.round((todayDate - prevDate) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        stats.currentStreak += 1;
      } else if (diffDays > 1) {
        // Missed a day — streak broken
        stats.currentStreak = 1;
      }
    } else {
      stats.currentStreak = 1;
    }

    stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
    stats.lastWonDate = date;
  } else {
    // Lost — break streak
    stats.currentStreak = 0;
  }

  stats.lastCompletedDate = date;

  saveStats(stats);
}

// ─────────────────────────────────────────────────────────────
// Session ID
// ─────────────────────────────────────────────────────────────

/**
 * Returns a stable session ID for the current player.
 * Generated once per device, persisted in localStorage.
 * Not cryptographically tied to identity — used for server-side game state.
 * 
 * @returns {string}
 */
function getSessionId() {
  const store = getStore();
  if (store.sessionId && typeof store.sessionId === 'string' && store.sessionId.length > 8) {
    return store.sessionId;
  }

  // Generate a UUID-like ID
  const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

  store.sessionId = id;
  setStore(store);
  return id;
}

// ─────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────

/**
 * Returns user settings with defaults.
 * @returns {{ darkMode: boolean, reducedMotion: boolean }}
 */
function loadSettings() {
  const store = getStore();
  return {
    darkMode: store.settings?.darkMode ?? false,
    reducedMotion: store.settings?.reducedMotion ?? false,
  };
}

/**
 * Saves user settings.
 * @param {Object} settings
 */
function saveSettings(settings) {
  const store = getStore();
  store.settings = { ...loadSettings(), ...settings };
  setStore(store);
}

export {
  loadPuzzleState,
  savePuzzleState,
  loadStats,
  saveStats,
  recordGameResult,
  getSessionId,
  loadSettings,
  saveSettings,
};
