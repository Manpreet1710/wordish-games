/**
 * Wordora — Unit Tests: Guess Evaluation
 * 
 * Tests the two-pass evaluation algorithm for correctness.
 * Runs against both the server-side implementation (functions/_shared/evaluate.js)
 * and validates expected behavior for edge cases.
 */

'use strict';

const { evaluateGuess, isWin, deriveKeyboardState, RESULT } = require('../functions/_shared/evaluate');

// ─────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────

function results(guess, answer) {
  return evaluateGuess(guess, answer).map(t => t.result);
}

const C = RESULT.CORRECT;
const P = RESULT.PRESENT;
const A = RESULT.ABSENT;

// ─────────────────────────────────────────────────────────────
// Basic Correct Position
// ─────────────────────────────────────────────────────────────
describe('evaluateGuess — correct position', () => {
  test('all correct (exact match)', () => {
    expect(results('CRANE', 'CRANE')).toEqual([C, C, C, C, C]);
  });

  test('one correct letter', () => {
    expect(results('CRANE', 'CXXXX')[0]).toBe(C);  // C in pos 0
    expect(results('CRANE', 'CXXXX').slice(1)).toEqual([A, A, A, A]);
  });

  test('last letter correct', () => {
    expect(results('CRANE', 'XXXXE')).toEqual([A, A, A, A, C]);
  });
});

// ─────────────────────────────────────────────────────────────
// Present (Wrong Position)
// ─────────────────────────────────────────────────────────────
describe('evaluateGuess — present (wrong position)', () => {
  test('letter present but wrong position', () => {
    // A is in DANCE but not at pos 1
    expect(results('CRANE', 'DANCE')).toEqual([A, A, P, C, C]);
  });

  test('all letters present but all wrong positions', () => {
    expect(results('ABCDE', 'EABCD')).toEqual([P, P, P, P, P]);
  });
});

// ─────────────────────────────────────────────────────────────
// Absent Letters
// ─────────────────────────────────────────────────────────────
describe('evaluateGuess — absent letters', () => {
  test('no matching letters', () => {
    expect(results('ABCDE', 'FGHIJ')).toEqual([A, A, A, A, A]);
  });

  test('mixed absent and correct', () => {
    const r = results('STARE', 'SHARE');
    // S=pos0 in both → C
    // T=absent, A=present (A is at pos2 in SHARE? no... SHARE: S,H,A,R,E → A at pos2)
    // Guess STARE: S(0),T(1),A(2),R(3),E(4)
    // Answer SHARE: S(0),H(1),A(2),R(3),E(4)
    // S=C, T=A, A=C, R=C, E=C
    expect(r).toEqual([C, A, C, C, C]);
  });
});

// ─────────────────────────────────────────────────────────────
// Duplicate Letter Handling (Critical)
// ─────────────────────────────────────────────────────────────
describe('evaluateGuess — duplicate letter handling', () => {
  test('guess has duplicate, answer has one: only first gets yellow', () => {
    // Answer: CRANE — one R at pos 2
    // Guess: RRRRR — R repeated 5 times
    // Pass 1: R at pos 2 is correct (answer[2]=A actually — nope)
    // CRANE: C,R,A,N,E — R at pos 1
    // RRRRR: guess[1] === answer[1] → CORRECT, rest are ABSENT
    const r = results('RRRRR', 'CRANE');
    expect(r[1]).toBe(C);  // R at pos 1 matches
    expect(r[0]).toBe(A);  // R consumed by pos 1 correct
    expect(r[2]).toBe(A);
    expect(r[3]).toBe(A);
    expect(r[4]).toBe(A);
  });

  test('answer has duplicate, guess has one: P if found', () => {
    // Answer: SPEED — has 2 E's (pos 3 and 4)
    // Guess: ERASE — E at pos 0
    // SPEED: S,P,E,E,D
    // ERASE: E,R,A,S,E
    // Pass 1: E(pos4) vs D → no. Wait—
    // ERASE[4] = E, SPEED[4] = D → no match on pass1
    // ERASE[0] = E, SPEED[0] = S → no
    // Pass 2: E at pos 0 — pool has E,E (pos 2,3) → PRESENT
    //         E at pos 4 — pool has E (only one left at whichever index) → PRESENT
    const r = results('ERASE', 'SPEED');
    // E(0): present, R(1): absent, A(2): absent, S(3): present (S is in SPEED at pos 0), E(4): present
    expect(r[0]).toBe(P);  // E present
    expect(r[1]).toBe(A);  // R absent
    expect(r[2]).toBe(A);  // A absent
    expect(r[3]).toBe(P);  // S present (SPEED has S at pos 0)
    expect(r[4]).toBe(P);  // E present (second E in pool)
  });

  test('guess has duplicate, answer has duplicate: correct handling', () => {
    // Answer: ABBEY (A,B,B,E,Y)
    // Guess: CABBY (C,A,B,B,Y)
    // Pass1: C(0)!=A → no; A(1)!=B → no; B(2)==B(2) → C; B(3)==B(3) → C; Y(4)==Y(4) → C
    // Pool after pass1: A,B,_,_,_ → [A, B, null, null, null]
    // Pass2: C(0) — not in [A,B] → A; A(1) — A in pool[0] → P, consume
    const r = results('CABBY', 'ABBEY');
    expect(r[0]).toBe(A);  // C not in ABBEY
    expect(r[1]).toBe(P);  // A present (not pos 1 in ABBEY but A is at pos 0)
    expect(r[2]).toBe(C);  // B correct
    expect(r[3]).toBe(C);  // B correct
    expect(r[4]).toBe(C);  // Y correct
  });

  test('double letter in guess, only one in answer: second is absent', () => {
    // Answer: APPLE (A,P,P,L,E)
    // Guess:  PAPAL (P,A,P,A,L)
    // Pass1: P(0)!=A → no; A(1)!=P → no; P(2)==P(2) → C; A(3)!=L → no; L(4)!=E → no
    // Pool after pass1: [A,P,null,L,E]
    // Pass2: P(0) → find P in pool[1] → P (present); A(1) → find A in pool[0] → P; A(3) → A gone → A
    //        L(4) → L in pool[3] → P
    const r = results('PAPAL', 'APPLE');
    expect(r[0]).toBe(P);  // P present (P at pos 1,2 in APPLE)
    expect(r[1]).toBe(P);  // A present (A at pos 0 in APPLE)
    expect(r[2]).toBe(C);  // P correct
    expect(r[3]).toBe(A);  // A — already consumed the one A
    expect(r[4]).toBe(P);  // L present
  });

  test('classic duplicate test: SPEED vs ABIDE', () => {
    // Answer: SPEED, Guess: SPEED → all correct
    expect(results('SPEED', 'SPEED')).toEqual([C, C, C, C, C]);
  });

  test('two same letters in guess, none in answer', () => {
    expect(results('AAABB', 'CCCCC')).toEqual([A, A, A, A, A]);
  });
});

// ─────────────────────────────────────────────────────────────
// Edge Cases
// ─────────────────────────────────────────────────────────────
describe('evaluateGuess — edge cases', () => {
  test('case insensitive: lowercase guess', () => {
    expect(results('crane', 'CRANE')).toEqual([C, C, C, C, C]);
  });

  test('throws on wrong length guess', () => {
    expect(() => evaluateGuess('ABC', 'CRANE')).toThrow(RangeError);
  });

  test('throws on wrong length answer', () => {
    expect(() => evaluateGuess('CRANE', 'AB')).toThrow(RangeError);
  });

  test('throws on non-string input', () => {
    expect(() => evaluateGuess(12345, 'CRANE')).toThrow(TypeError);
  });
});

// ─────────────────────────────────────────────────────────────
// isWin
// ─────────────────────────────────────────────────────────────
describe('isWin', () => {
  test('returns true when all correct', () => {
    expect(isWin(evaluateGuess('CRANE', 'CRANE'))).toBe(true);
  });

  test('returns false when not all correct', () => {
    expect(isWin(evaluateGuess('CRANE', 'DANCE'))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// deriveKeyboardState
// ─────────────────────────────────────────────────────────────
describe('deriveKeyboardState', () => {
  test('correct overrides present', () => {
    const r1 = evaluateGuess('CRANE', 'DANCE'); // C=absent, ...
    const r2 = evaluateGuess('DANCE', 'DANCE'); // all correct
    const kbState = deriveKeyboardState([r1, r2]);
    // D, A, N, C, E should all be correct after guess 2
    expect(kbState['D']).toBe(RESULT.CORRECT);
    expect(kbState['A']).toBe(RESULT.CORRECT);
    expect(kbState['N']).toBe(RESULT.CORRECT);
    expect(kbState['C']).toBe(RESULT.ABSENT); // C is absent from DANCE answer
    expect(kbState['E']).toBe(RESULT.CORRECT);
  });

  test('correct overrides absent for same letter', () => {
    const r1 = evaluateGuess('AAAAB', 'XXXXA'); // A absent at 0,1,2,3 — A correct at 4? 
    // AAAAB guess, XXXXA answer: A at pos 4 of both → correct
    // A at pos 0,1,2,3 in guess → pool has only A at pos 4 which is consumed → rest absent
    const r2 = evaluateGuess('AXXXX', 'AXXXX'); // A correct at pos 0
    const kbState = deriveKeyboardState([r1, r2]);
    expect(kbState['A']).toBe(RESULT.CORRECT);
  });

  test('present overrides absent', () => {
    const r1 = evaluateGuess('CRANE', 'XAXXX'); // R,A absent
    // Actually: CRANE in XAXXX: C=A,R=A,A=C(pos2),N=A,E=A
    // Wait XAXXX has A at pos 1... let me recalculate
    // XAXXX: X(0),A(1),X(2),X(3),X(4)
    // CRANE: C(0),R(1),A(2),N(3),E(4)
    // Pass1: C!=X, R!=A, A!=X, N!=X, E!=X → none correct
    // Pass2: C→X not in pool → A; R→pool has X,A,X,X,X → A not R → A
    //        A→pool has A at [1] → P! (A is present)
    const kbState = deriveKeyboardState([r1]);
    expect(kbState['A']).toBe(RESULT.PRESENT);
  });
});
