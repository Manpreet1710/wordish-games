/**
 * Word list utilities for Netlify Functions.
 * 
 * Loads and validates the answer list and valid-guess dictionary.
 * Merges answers into valid guesses at startup.
 * 
 * IMPORTANT: This file runs only in Node.js (serverless functions).
 * It must never be imported in browser JavaScript.
 */

'use strict';

const path = require('path');

const fs = require('fs');

// Launch day = puzzle #1. Keep in sync with EPOCH_DATE in js/game.js.
const EPOCH_DATE = '2026-10-01';
const EPOCH = new Date(EPOCH_DATE + 'T00:00:00Z');

// The legacy formula counted days from here. Kept so the fallback matches the answers already shown.
const LEGACY_EPOCH = new Date('2024-01-01T00:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Loads data file either via static require (for esbuild bundling)
 * or by resolving relative candidate paths at runtime.
 */
function loadDataModule(type) {
  if (type === 'answers') {
    try {
      return require('../../data/answers.js');
    } catch {
      // Fallback below
    }
  } else if (type === 'valid-guesses') {
    try {
      return require('../../data/valid-guesses.js');
    } catch {
      // Fallback below
    }
  }

  const filename = type === 'answers' ? 'answers.js' : 'valid-guesses.js';
  const candidatePaths = [
    path.resolve(process.cwd(), 'data', filename),
    path.resolve(__dirname, '..', '..', 'data', filename),
    path.resolve(__dirname, '..', 'data', filename),
    path.resolve(__dirname, 'data', filename),
  ];

  for (const candidate of candidatePaths) {
    try {
      if (fs.existsSync(candidate)) {
        return require(candidate);
      }
    } catch {
      // continue
    }
  }

  throw new Error(`Wordora: Failed to locate data file "${filename}". Searched paths: ${candidatePaths.join(', ')}`);
}

let _answers = null;
let _validGuesses = null;

/**
 * Returns the curated answer list (uppercase strings).
 * Cached after first load.
 * 
 * @returns {string[]}
 */
function getAnswers() {
  if (!_answers) {
    const { ANSWERS } = loadDataModule('answers');
    _answers = ANSWERS.map(w => w.toUpperCase().trim()).filter(w => /^[A-Z]{5}$/.test(w));
  }
  return _answers;
}

/**
 * Returns the full set of valid guesses (includes all answers).
 * Cached after first load.
 * 
 * @returns {Set<string>}
 */
function getValidGuesses() {
  if (!_validGuesses) {
    const { VALID_GUESSES } = loadDataModule('valid-guesses');
    const answers = getAnswers();
    // Merge: all answers are valid guesses
    _validGuesses = new Set([
      ...Array.from(VALID_GUESSES).map(w => w.toUpperCase().trim()),
      ...answers,
    ]);
    // Remove any invalid entries (not exactly 5 alpha chars)
    for (const word of _validGuesses) {
      if (!/^[A-Z]{5}$/.test(word)) {
        _validGuesses.delete(word);
      }
    }
  }
  return _validGuesses;
}

/**
 * Checks whether a word is in the valid-guess dictionary.
 * Case-insensitive.
 * 
 * @param {string} word
 * @returns {boolean}
 */
function isValidGuess(word) {
  if (typeof word !== 'string') return false;
  return getValidGuesses().has(word.toUpperCase().trim());
}

/**
 * LEGACY answer formula: ANSWERS[days since 2024-01-01 % length], keyed by the puzzle's DATE
 * so it never shifts when EPOCH_DATE changes.
 * The live answer comes from the MongoDB schedule (see _shared/puzzles.js);
 * this is only used to backfill history and as a fallback when the DB is down.
 * 
 * @param {number} puzzleNumber - 1-indexed puzzle number
 * @returns {string} Uppercase 5-letter answer
 */
function getAnswerForPuzzle(puzzleNumber) {
  const answers = getAnswers();
  if (!Number.isInteger(puzzleNumber) || puzzleNumber < 1) {
    throw new RangeError(`Invalid puzzle number: ${puzzleNumber}`);
  }
  const date = new Date(EPOCH.getTime() + (puzzleNumber - 1) * DAY_MS);
  const index = Math.round((date - LEGACY_EPOCH) / DAY_MS) % answers.length;
  return answers[index];
}

/**
 * Returns today's puzzle number based on UTC date.
 * 
 * Epoch: EPOCH_DATE (2026-10-01) UTC = puzzle #1
 * 
 * @param {Date} [now] - Optional date for testing
 * @returns {number} Puzzle number (1-indexed)
 */
function getPuzzleNumberForDate(now) {
  const date = now instanceof Date ? now : new Date();
  
  // Use UTC components to get UTC calendar day
  const utcDate = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  ));
  
  const diffMs = utcDate.getTime() - EPOCH.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  return Math.max(1, diffDays + 1); // Minimum puzzle #1
}

/**
 * Returns the UTC date string (YYYY-MM-DD) for a puzzle number.
 * 
 * @param {number} puzzleNumber
 * @returns {string} UTC date string
 */
function getDateForPuzzleNumber(puzzleNumber) {
  const date = new Date(EPOCH.getTime() + (puzzleNumber - 1) * 24 * 60 * 60 * 1000);
  return date.toISOString().split('T')[0];
}

/**
 * Returns today's UTC date as YYYY-MM-DD string.
 * 
 * @param {Date} [now]
 * @returns {string}
 */
function getTodayUTC(now) {
  const date = now instanceof Date ? now : new Date();
  return date.toISOString().split('T')[0];
}

module.exports = {
  EPOCH_DATE,
  getAnswers,
  getValidGuesses,
  isValidGuess,
  getAnswerForPuzzle,
  getPuzzleNumberForDate,
  getDateForPuzzleNumber,
  getTodayUTC,
};
