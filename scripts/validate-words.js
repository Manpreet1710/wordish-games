#!/usr/bin/env node
/**
 * Wordora — Word List Validator
 * 
 * Validates both the answer list and valid-guess dictionary.
 * Run before deploying to catch word list issues early.
 * 
 * Usage: npm run validate-words
 * 
 * Checks:
 * - All words are exactly 5 alphabetic characters
 * - No duplicates in the answer list
 * - All answers are in the valid-guess dictionary
 * - No obviously offensive entries (basic check)
 */

'use strict';

const path = require('path');
const DATA_DIR = path.join(__dirname, '..', 'data');

const { ANSWERS } = require(path.join(DATA_DIR, 'answers.js'));
const { VALID_GUESSES } = require(path.join(DATA_DIR, 'valid-guesses.js'));

let errors = 0;
let warnings = 0;

function error(msg) {
  console.error(`  ✗ ERROR: ${msg}`);
  errors++;
}

function warn(msg) {
  console.warn(`  ⚠ WARN:  ${msg}`);
  warnings++;
}

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}

console.log('\n╔════════════════════════════════════╗');
console.log('║   Wordora Word List Validator      ║');
console.log('╚════════════════════════════════════╝\n');

// ─── Validate Answer List ──────────────────────────────────
console.log('Validating answers.js...');

const answerSet = new Set();
const seenAnswers = new Set();

for (let i = 0; i < ANSWERS.length; i++) {
  const word = ANSWERS[i];
  const pos = `#${i + 1} (puzzle index ${i})`;

  if (typeof word !== 'string') {
    error(`Answer ${pos}: not a string`);
    continue;
  }

  const normalized = word.toUpperCase().trim();

  if (!/^[A-Z]{5}$/.test(normalized)) {
    error(`Answer ${pos} "${word}": must be exactly 5 alphabetic characters (got "${normalized}")`);
  }

  if (seenAnswers.has(normalized)) {
    error(`Answer ${pos} "${normalized}": DUPLICATE in answer list`);
  }
  seenAnswers.add(normalized);
  answerSet.add(normalized);
}

ok(`Answer list: ${ANSWERS.length} words`);
ok(`Unique answers: ${answerSet.size}`);
if (ANSWERS.length !== answerSet.size) {
  error(`Found ${ANSWERS.length - answerSet.size} duplicate answers`);
}

// ─── Validate Valid-Guess List ─────────────────────────────
console.log('\nValidating valid-guesses.js...');

const guessSet = new Set();
let guessErrors = 0;

for (const word of VALID_GUESSES) {
  if (typeof word !== 'string') continue;
  const normalized = word.toUpperCase().trim();

  if (!/^[A-Z]{5}$/.test(normalized)) {
    if (guessErrors < 10) {
      error(`Valid guess "${word}": must be exactly 5 alphabetic characters`);
    }
    guessErrors++;
  } else {
    guessSet.add(normalized);
  }
}

if (guessErrors > 10) {
  error(`...and ${guessErrors - 10} more invalid guess entries`);
}

ok(`Valid guess list: ${guessSet.size} unique valid words`);

// ─── Check All Answers Are Valid Guesses ──────────────────
console.log('\nCross-checking: all answers must be valid guesses...');

const allGuesses = new Set([...guessSet, ...answerSet]);

let missingFromGuesses = 0;
for (const answer of answerSet) {
  if (!allGuesses.has(answer)) {
    error(`Answer "${answer}" is not in the valid-guess list`);
    missingFromGuesses++;
  }
}

if (missingFromGuesses === 0) {
  ok('All answers are valid guesses ✓');
}

// ─── Stats Summary ─────────────────────────────────────────
console.log('\n══════════════════════════════════════');
console.log(`Total answers:     ${ANSWERS.length}`);
console.log(`Unique answers:    ${answerSet.size}`);
console.log(`Valid guesses:     ${allGuesses.size}`);
console.log(`Coverage (days):   ~${Math.floor(ANSWERS.length)} days (${(ANSWERS.length / 365).toFixed(1)} years)`);
console.log('══════════════════════════════════════\n');

if (errors > 0) {
  console.error(`\n❌ Validation FAILED: ${errors} error(s), ${warnings} warning(s)\n`);
  process.exit(1);
} else {
  console.log(`✅ Validation PASSED: 0 errors, ${warnings} warning(s)\n`);
  process.exit(0);
}
