/**
 * Wordora — Game Logic (Client-Side)
 * 
 * Implements the same two-pass evaluation algorithm as the server.
 * Used for optimistic local updates before server response arrives.
 * 
 * The SERVER is authoritative — client-side evaluation is for UX only.
 */

'use strict';

export const RESULT = {
  CORRECT: 'correct',
  PRESENT: 'present',
  ABSENT: 'absent',
};

export const STATUS = {
  PLAYING: 'playing',
  WON: 'won',
  LOST: 'lost',
};

export const MAX_ATTEMPTS = 6;
export const WORD_LENGTH = 5;

// Epoch for puzzle number calculation
export const EPOCH = new Date('2024-01-01T00:00:00Z');

/**
 * Gets today's UTC date string.
 * @returns {string} YYYY-MM-DD
 */
export function getTodayUTC() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Gets current puzzle number based on UTC date.
 * @returns {number}
 */
export function getCurrentPuzzleNumber() {
  const now = new Date();
  const today = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  ));
  const diffDays = Math.floor((today - EPOCH) / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1);
}

/**
 * Gets puzzle number for a specific UTC date string or Date object.
 * @param {string|Date} dateInput - YYYY-MM-DD string or Date
 * @returns {number}
 */
export function getPuzzleNumberForDate(dateInput) {
  let dateObj;
  if (typeof dateInput === 'string') {
    dateObj = new Date(dateInput + 'T00:00:00Z');
  } else if (dateInput instanceof Date) {
    dateObj = new Date(Date.UTC(dateInput.getUTCFullYear(), dateInput.getUTCMonth(), dateInput.getUTCDate()));
  } else {
    dateObj = new Date();
  }
  const diffDays = Math.floor((dateObj - EPOCH) / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1);
}

/**
 * Gets UTC date string (YYYY-MM-DD) for a given puzzle number.
 * @param {number} puzzleNumber
 * @returns {string}
 */
export function getDateForPuzzleNumber(puzzleNumber) {
  const d = new Date(EPOCH.getTime() + (puzzleNumber - 1) * 24 * 60 * 60 * 1000);
  return d.toISOString().split('T')[0];
}

/**
 * Formats a YYYY-MM-DD date into a friendly display string (e.g. "Oct 21, 2026").
 * Uses UTC components to avoid timezone shifts.
 * @param {string} dateStr
 * @returns {string}
 */
export function formatDateDisplay(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[month] || ''} ${day}, ${year}`;
}

/**
 * Evaluates a guess against the answer using the two-pass algorithm.
 * Matches the server-side implementation in functions/_shared/evaluate.js
 * 
 * @param {string} guess - Uppercase 5-letter guess
 * @param {string} answer - Uppercase 5-letter answer
 * @returns {Array<{letter: string, result: string}>}
 */
export function evaluateGuess(guess, answer) {
  const g = guess.toUpperCase();
  const a = answer.toUpperCase();

  const results = Array.from({ length: 5 }, (_, i) => ({
    letter: g[i],
    result: RESULT.ABSENT,
  }));

  const answerPool = [...a];

  // Pass 1: Exact matches
  for (let i = 0; i < 5; i++) {
    if (g[i] === a[i]) {
      results[i].result = RESULT.CORRECT;
      answerPool[i] = null;
    }
  }

  // Pass 2: Present but wrong position
  for (let i = 0; i < 5; i++) {
    if (results[i].result === RESULT.CORRECT) continue;
    const poolIdx = answerPool.indexOf(g[i]);
    if (poolIdx !== -1) {
      results[i].result = RESULT.PRESENT;
      answerPool[poolIdx] = null;
    }
  }

  return results;
}

/**
 * Checks if all tiles are correct (win condition).
 * @param {Array} results
 * @returns {boolean}
 */
export function isWin(results) {
  return results.every(t => t.result === RESULT.CORRECT);
}

/**
 * Derives keyboard letter state from all evaluated guesses.
 * Priority: correct > present > absent
 * 
 * @param {Array<Array<{letter: string, result: string}>>} allResults
 * @returns {Object.<string, string>}
 */
export function deriveKeyboardState(allResults) {
  const priority = { [RESULT.CORRECT]: 2, [RESULT.PRESENT]: 1, [RESULT.ABSENT]: 0 };
  const state = {};

  for (const guessResults of allResults) {
    for (const { letter, result } of guessResults) {
      if (state[letter] === undefined || priority[result] > priority[state[letter]]) {
        state[letter] = result;
      }
    }
  }

  return state;
}

/**
 * Generates the win message based on attempt count.
 * @param {number} attempts
 * @returns {string}
 */
export function getWinMessage(attempts) {
  const messages = ['Genius!', 'Magnificent!', 'Impressive!', 'Splendid!', 'Great!', 'Phew!'];
  return messages[Math.min(attempts - 1, messages.length - 1)];
}

// Server clock sync: anchored to performance.now() so changing the OS clock
// after load does not affect it. Null until the server has responded.
let serverClock = null;

/**
 * Records the server's trusted time from a get-puzzle response.
 * @param {string} serverTimeIso - ISO timestamp from the server
 */
export function syncServerTime(serverTimeIso) {
  const serverMs = Date.parse(serverTimeIso);
  if (isNaN(serverMs)) return;
  serverClock = { serverMs, perfMs: performance.now() };
}

/**
 * Current time, from the server clock when synced, else the local clock.
 * @returns {number} epoch ms
 */
export function getTrustedNowMs() {
  if (!serverClock) return Date.now();
  return serverClock.serverMs + (performance.now() - serverClock.perfMs);
}

/**
 * Gets milliseconds until next UTC midnight.
 * @returns {number}
 */
export function getMsUntilNextPuzzle() {
  const now = new Date(getTrustedNowMs());
  const tomorrow = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1
  ));
  return tomorrow.getTime() - now.getTime();
}

/**
 * Formats milliseconds as HH:MM:SS countdown string.
 * @param {number} ms
 * @returns {string}
 */
export function formatCountdown(ms) {
  if (ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}
