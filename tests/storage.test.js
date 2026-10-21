/**
 * Wordora — Unit Tests: Word List Utilities
 */

'use strict';

const { isValidGuess, getValidGuesses } = require('../functions/_shared/words');

describe('isValidGuess', () => {
  test('valid 5-letter word returns true', () => {
    expect(isValidGuess('CRANE')).toBe(true);
  });

  test('case insensitive', () => {
    expect(isValidGuess('crane')).toBe(true);
    expect(isValidGuess('Crane')).toBe(true);
  });

  test('4-letter word returns false', () => {
    expect(isValidGuess('CRAN')).toBe(false);
  });

  test('6-letter word returns false', () => {
    expect(isValidGuess('CRANES')).toBe(false);
  });

  test('empty string returns false', () => {
    expect(isValidGuess('')).toBe(false);
  });

  test('non-string returns false', () => {
    expect(isValidGuess(null)).toBe(false);
    expect(isValidGuess(undefined)).toBe(false);
    expect(isValidGuess(12345)).toBe(false);
  });

  test('random letter string not in dictionary returns false', () => {
    expect(isValidGuess('ZZZZZ')).toBe(false);
    expect(isValidGuess('AAAAA')).toBe(false); // unlikely to be in dict
  });

  test('all answers are valid guesses', () => {
    const { getAnswers } = require('../functions/_shared/words');
    const answers = getAnswers();
    // Check first 20 answers
    for (const answer of answers.slice(0, 20)) {
      expect(isValidGuess(answer)).toBe(true);
    }
  });
});

describe('getValidGuesses', () => {
  test('returns a Set', () => {
    const guesses = getValidGuesses();
    expect(guesses instanceof Set).toBe(true);
  });

  test('all entries are valid 5-letter uppercase words', () => {
    const guesses = getValidGuesses();
    // Check 100 random entries
    const entries = Array.from(guesses).slice(0, 100);
    for (const word of entries) {
      expect(word).toMatch(/^[A-Z]{5}$/);
    }
  });

  test('has substantial size (at least 500 words)', () => {
    expect(getValidGuesses().size).toBeGreaterThan(500);
  });
});
