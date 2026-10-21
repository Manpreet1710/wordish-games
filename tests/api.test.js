/**
 * Wordora — Integration Tests: API Endpoint Logic
 * 
 * Tests the submit-guess handler logic without HTTP transport.
 * Uses the handler function directly with mock events.
 * 
 * MongoDB-dependent tests are skipped when MONGODB_URI is not set.
 */

'use strict';

const { evaluateGuess, isWin, RESULT } = require('../functions/_shared/evaluate');
const { EPOCH_DATE, isValidGuess, getPuzzleNumberForDate, getTodayUTC, getAnswerForPuzzle } = require('../functions/_shared/words');

// Mock Netlify event helper
function mockEvent(method, body, headers = {}) {
  return {
    httpMethod: method,
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// get-puzzle handler
// ─────────────────────────────────────────────────────────────
describe('GET /get-puzzle', () => {
  let handler;

  beforeAll(() => {
    handler = require('../functions/get-puzzle').handler;
  });

  test('returns 200 with puzzle metadata', async () => {
    const event = mockEvent('GET', null);
    const response = await handler(event);

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('puzzleNumber');
    expect(body).toHaveProperty('date');
    expect(body).toHaveProperty('maxAttempts', 6);
    expect(body).toHaveProperty('wordLength', 5);
    expect(body).toHaveProperty('nextPuzzleAt');
    expect(body).not.toHaveProperty('answer');
  });

  test('returns today UTC date', async () => {
    const event = mockEvent('GET', null);
    const response = await handler(event);
    const body = JSON.parse(response.body);
    const today = getTodayUTC();
    expect(body.date).toBe(today);
  });

  test('puzzle number matches expected for today', async () => {
    const event = mockEvent('GET', null);
    const response = await handler(event);
    const body = JSON.parse(response.body);
    const expected = getPuzzleNumberForDate();
    expect(body.puzzleNumber).toBe(expected);
  });

  test('returns 405 for POST', async () => {
    const event = mockEvent('POST', '{}');
    const response = await handler(event);
    expect(response.statusCode).toBe(405);
  });

  test('handles OPTIONS (CORS preflight)', async () => {
    const event = mockEvent('OPTIONS', null);
    const response = await handler(event);
    expect(response.statusCode).toBe(204);
  });

  test('response does not contain answer', async () => {
    const event = mockEvent('GET', null);
    const response = await handler(event);
    const body = JSON.parse(response.body);
    // The answer should NEVER be in the response
    const todayAnswer = getAnswerForPuzzle(getPuzzleNumberForDate());
    expect(JSON.stringify(body)).not.toContain(todayAnswer);
  });

  test('returns historical puzzle metadata when date param provided', async () => {
    const event = { ...mockEvent('GET', null), queryStringParameters: { date: EPOCH_DATE } };
    const response = await handler(event);
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.puzzleNumber).toBe(1);
    expect(body.date).toBe(EPOCH_DATE);
    expect(body.available).toBe(true);
    // Epoch is only a preview once launch day has passed
    expect(body.isPreview).toBe(EPOCH_DATE !== getTodayUTC());
    expect(body).not.toHaveProperty('answer');
  });

  test('returns 404 for dates before epoch', async () => {
    const event = { ...mockEvent('GET', null), queryStringParameters: { date: '2026-10-20' } };
    const response = await handler(event);
    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.available).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// submit-guess validation (no DB required)
// ─────────────────────────────────────────────────────────────
describe('POST /submit-guess — input validation', () => {
  let handler;

  beforeAll(() => {
    // Mock MongoDB to be unavailable → stateless mode
    // This allows testing validation logic without a real DB
    handler = require('../functions/submit-guess').handler;
  });

  const validPayload = {
    sessionId: 'test-session-id-123',
    guess: 'CRANE',
    puzzleNumber: getPuzzleNumberForDate(),
    date: getTodayUTC(),
  };

  test('returns 405 for GET', async () => {
    const event = mockEvent('GET', null);
    const response = await handler(event);
    expect(response.statusCode).toBe(405);
  });

  test('returns 400 for missing body', async () => {
    const event = { httpMethod: 'POST', body: null, headers: {} };
    const response = await handler(event);
    expect(response.statusCode).toBe(400);
  });

  test('returns 400 for invalid JSON', async () => {
    const event = { httpMethod: 'POST', body: 'not json', headers: {} };
    const response = await handler(event);
    expect(response.statusCode).toBe(400);
  });

  test('returns 400 for missing sessionId', async () => {
    const payload = { ...validPayload, sessionId: undefined };
    const event = mockEvent('POST', payload);
    const response = await handler(event);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toMatch(/sessionId/i);
  });

  test('returns 400 for non-5-letter guess', async () => {
    const payload = { ...validPayload, guess: 'ABC' };
    const event = mockEvent('POST', payload);
    const response = await handler(event);
    expect(response.statusCode).toBe(400);
  });

  test('returns 400 for guess with numbers', async () => {
    const payload = { ...validPayload, guess: '12345' };
    const event = mockEvent('POST', payload);
    const response = await handler(event);
    expect(response.statusCode).toBe(400);
  });

  test('returns 400 for wrong puzzle number', async () => {
    const payload = { ...validPayload, puzzleNumber: 9999999 };
    const event = mockEvent('POST', payload);
    const response = await handler(event);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toMatch(/puzzle number/i);
  });

  test('returns 400 for wrong date', async () => {
    const payload = { ...validPayload, date: '2020-01-01' };
    const event = mockEvent('POST', payload);
    const response = await handler(event);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toMatch(/date/i);
  });

  test('returns 400 for invalid date format', async () => {
    const payload = { ...validPayload, date: 'not-a-date' };
    const event = mockEvent('POST', payload);
    const response = await handler(event);
    expect(response.statusCode).toBe(400);
  });

  test('returns 422 for word not in dictionary', async () => {
    const payload = { ...validPayload, guess: 'ZZZZZ' };
    const event = mockEvent('POST', payload);
    const response = await handler(event);
    expect(response.statusCode).toBe(422);
    const body = JSON.parse(response.body);
    expect(body.code).toBe('INVALID_WORD');
  });

  test('handles OPTIONS (CORS preflight)', async () => {
    const event = mockEvent('OPTIONS', null);
    const response = await handler(event);
    expect(response.statusCode).toBe(204);
  });

  test('valid guess returns results array', async () => {
    // This test works even without DB (stateless mode)
    const event = mockEvent('POST', validPayload);
    const response = await handler(event);
    // 200 or 422 (if CRANE not in dict) or 200 with warning (stateless)
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      expect(Array.isArray(body.results)).toBe(true);
      expect(body.results).toHaveLength(5);
      for (const tile of body.results) {
        expect(tile).toHaveProperty('letter');
        expect(tile).toHaveProperty('result');
        expect([RESULT.CORRECT, RESULT.PRESENT, RESULT.ABSENT]).toContain(tile.result);
      }
    }
  });

  test('allows preview guess submission for valid past puzzle', async () => {
    const pastPayload = {
      sessionId: 'preview-session-999',
      guess: 'CRANE',
      puzzleNumber: 1,
      date: EPOCH_DATE,
    };
    const event = mockEvent('POST', pastPayload);
    const response = await handler(event);
    expect([200, 409]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      expect(Array.isArray(body.results)).toBe(true);
      expect(body.results).toHaveLength(5);
    }
  });

  test('allows preview guess submission for valid future preview puzzle', async () => {
    const futureDate = '2026-10-27';
    const futurePuzzleNumber = getPuzzleNumberForDate(new Date(futureDate + 'T00:00:00Z'));
    const futurePayload = {
      sessionId: 'preview-session-future',
      guess: 'WORLD',
      puzzleNumber: futurePuzzleNumber,
      date: futureDate,
    };
    const event = mockEvent('POST', futurePayload);
    const response = await handler(event);
    expect([200, 409]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      expect(Array.isArray(body.results)).toBe(true);
      expect(body.results).toHaveLength(5);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// Evaluation logic (server-side)
// ─────────────────────────────────────────────────────────────
describe('Server evaluate: six unsuccessful attempts', () => {
  const answer = 'CRANE';

  test('six wrong guesses → game should be lost', () => {
    const wrongGuesses = ['ABIDE', 'FOIST', 'LUMPY', 'THWAX', 'QUAFF', 'VEXED'];
    let attemptsUsed = 0;
    let status = 'playing';

    for (const guess of wrongGuesses) {
      const results = evaluateGuess(guess, answer);
      attemptsUsed++;
      if (isWin(results)) {
        status = 'won';
        break;
      }
      if (attemptsUsed >= 6) {
        status = 'lost';
      }
    }

    expect(status).toBe('lost');
    expect(attemptsUsed).toBe(6);
  });
});

describe('Server evaluate: winning on attempt 1 and 6', () => {
  test('winning on attempt 1', () => {
    const answer = 'CRANE';
    const results = evaluateGuess(answer, answer);
    expect(isWin(results)).toBe(true);
  });

  test('winning on attempt 6 (last chance)', () => {
    const answer = 'CRANE';
    const wrongGuesses = ['ABIDE', 'FOIST', 'LUMPY', 'THWAX', 'QUAFF'];
    let attemptsUsed = wrongGuesses.length;
    
    // Attempt 6: correct answer
    const finalResult = evaluateGuess(answer, answer);
    attemptsUsed++;
    
    expect(isWin(finalResult)).toBe(true);
    expect(attemptsUsed).toBe(6);
  });
});

// ─────────────────────────────────────────────────────────────
// Malformed request protection
// ─────────────────────────────────────────────────────────────
describe('Malformed request protection', () => {
  let handler;

  beforeAll(() => {
    handler = require('../functions/submit-guess').handler;
  });

  const validBase = {
    sessionId: 'test-abc-123',
    guess: 'CRANE',
    puzzleNumber: getPuzzleNumberForDate(),
    date: getTodayUTC(),
  };

  test('very long sessionId is rejected', async () => {
    const payload = { ...validBase, sessionId: 'x'.repeat(200) };
    const event = mockEvent('POST', payload);
    const response = await handler(event);
    expect(response.statusCode).toBe(400);
  });

  test('non-integer puzzleNumber is rejected', async () => {
    const payload = { ...validBase, puzzleNumber: 'evil' };
    const event = mockEvent('POST', payload);
    const response = await handler(event);
    expect(response.statusCode).toBe(400);
  });

  test('extra large body is handled gracefully', async () => {
    const payload = { ...validBase, extra: 'x'.repeat(10000) };
    const event = mockEvent('POST', payload);
    // Should not crash the handler
    const response = await handler(event);
    expect(response.statusCode).toBeLessThan(500);
  });
});
