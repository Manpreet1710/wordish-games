/**
 * Server-side guess evaluation logic for Wordora.
 * 
 * Uses a correct two-pass algorithm that handles duplicate letters accurately.
 * 
 * Pass 1: Mark exact matches (green) — consumes one instance of the answer letter.
 * Pass 2: Mark present-but-wrong-position (yellow) for remaining unmatched letters.
 * 
 * This file is shared between Netlify Functions and test suites.
 * Do NOT import browser-specific APIs here.
 */

'use strict';

/**
 * Tile result constants
 * @enum {string}
 */
const RESULT = {
  CORRECT: 'correct',   // Green — right letter, right position
  PRESENT: 'present',   // Yellow — right letter, wrong position
  ABSENT: 'absent',     // Gray — letter not in remaining answer
};

/**
 * Evaluates a 5-letter guess against a 5-letter answer.
 * 
 * Algorithm (two-pass, handles duplicates correctly):
 * 
 * Pass 1 — Exact matches:
 *   For each position i, if guess[i] === answer[i], mark CORRECT.
 *   Remove matched answer letters from the "available pool".
 * 
 * Pass 2 — Present but wrong position:
 *   For each position i not already marked CORRECT:
 *     If guess[i] exists in the remaining answer pool, mark PRESENT
 *     and consume one instance from the pool.
 *   Otherwise, mark ABSENT.
 * 
 * @param {string} guess - The player's 5-letter guess (uppercase)
 * @param {string} answer - The correct 5-letter answer (uppercase)
 * @returns {Array<{letter: string, result: string}>} Array of 5 tile results
 * 
 * @example
 * evaluateGuess('CRANE', 'DANCE')
 * // [
 * //   { letter: 'C', result: 'absent' },
 * //   { letter: 'R', result: 'absent' },
 * //   { letter: 'A', result: 'present' },
 * //   { letter: 'N', result: 'correct' },
 * //   { letter: 'E', result: 'correct' },
 * // ]
 */
function evaluateGuess(guess, answer) {
  if (typeof guess !== 'string' || typeof answer !== 'string') {
    throw new TypeError('guess and answer must be strings');
  }

  const g = guess.toUpperCase();
  const a = answer.toUpperCase();

  if (g.length !== 5 || a.length !== 5) {
    throw new RangeError('guess and answer must each be exactly 5 characters');
  }

  const results = Array(5).fill(null).map((_, i) => ({
    letter: g[i],
    result: RESULT.ABSENT,
  }));

  // Pool tracks unmatched answer letters for Pass 2
  const answerPool = a.split('');

  // Pass 1: Exact position matches (green)
  for (let i = 0; i < 5; i++) {
    if (g[i] === a[i]) {
      results[i].result = RESULT.CORRECT;
      answerPool[i] = null; // Consume this letter from the pool
    }
  }

  // Pass 2: Present-but-wrong-position (yellow) for remaining
  for (let i = 0; i < 5; i++) {
    if (results[i].result === RESULT.CORRECT) continue;

    const poolIndex = answerPool.indexOf(g[i]);
    if (poolIndex !== -1) {
      results[i].result = RESULT.PRESENT;
      answerPool[poolIndex] = null; // Consume to prevent double-counting
    }
    // else: remains ABSENT
  }

  return results;
}

/**
 * Checks whether the guess is an exact match (all CORRECT).
 * 
 * @param {Array<{result: string}>} results - Output of evaluateGuess()
 * @returns {boolean}
 */
function isWin(results) {
  return results.every(tile => tile.result === RESULT.CORRECT);
}

/**
 * Derives keyboard letter state from all submitted guess results.
 * Priority: correct > present > absent
 * 
 * @param {Array<Array<{letter: string, result: string}>>} allResults
 * @returns {Object.<string, string>} Map of letter -> best result so far
 */
function deriveKeyboardState(allResults) {
  const priority = { [RESULT.CORRECT]: 2, [RESULT.PRESENT]: 1, [RESULT.ABSENT]: 0 };
  const state = {};

  for (const guessResults of allResults) {
    for (const { letter, result } of guessResults) {
      const current = state[letter];
      if (current === undefined || priority[result] > priority[current]) {
        state[letter] = result;
      }
    }
  }

  return state;
}

module.exports = { evaluateGuess, isWin, deriveKeyboardState, RESULT };
