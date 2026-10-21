/**
 * POST /.netlify/functions/submit-guess
 * 
 * Validates a guess, evaluates it server-side, and returns tile results.
 * 
 * Security model:
 * - Server evaluates the guess against the authoritative answer
 * - Session state (guesses, status) is stored server-side (MongoDB) per sessionId
 * - sessionId is a UUID generated client-side and sent with every request
 * - Not cryptographically unguessable, but sufficient for casual anti-cheat
 * - Rate limited per IP
 * - Puzzle identity verified against UTC date
 * - Answer is NEVER returned until game is over (after 6 attempts or win)
 * 
 * Request body:
 * {
 *   sessionId: string,
 *   guess: string,        // 5 letters
 *   puzzleNumber: number,
 *   date: string,         // YYYY-MM-DD UTC
 * }
 * 
 * Response body (success):
 * {
 *   results: Array<{letter: string, result: 'correct'|'present'|'absent'}>,
 *   attemptsUsed: number,
 *   status: 'playing'|'won'|'lost',
 *   answer: string|null,  // Only revealed when game is over
 *   message: string|null,
 * }
 */

'use strict';

const { evaluateGuess, isWin, RESULT } = require('./_shared/evaluate');
const { EPOCH_DATE, isValidGuess, getPuzzleNumberForDate, getTodayUTC } = require('./_shared/words');
const { resolveAnswer } = require('./_shared/puzzles');
const { getTrustedNow } = require('./_shared/time');
const { checkRateLimit, getClientIP } = require('./_shared/rateLimiter');

let db = null;

async function getDb() {
  if (!db) {
    try {
      const { connectToDatabase } = require('./_shared/db');
      const conn = await connectToDatabase();
      db = conn.db;
    } catch (err) {
      // MongoDB unavailable — fall back to stateless mode
      console.warn('[submit-guess] MongoDB unavailable, running stateless:', err.message);
      db = null;
    }
  }
  return db;
}

const MAX_ATTEMPTS = 6;
const WORD_LENGTH = 5;

/**
 * @param {import('@netlify/functions').HandlerEvent} event
 */
exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  // Rate limiting
  const clientIP = getClientIP(event.headers || {});
  const rateResult = checkRateLimit(clientIP);
  if (!rateResult.allowed) {
    return {
      statusCode: 429,
      headers: {
        ...corsHeaders(),
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Retry-After': String(Math.ceil(rateResult.resetMs / 1000)),
      },
      body: JSON.stringify({ error: 'Too many requests. Please wait and try again.' }),
    };
  }

  // Parse and validate request body
  let body;
  try {
    if (!event.body) throw new Error('Empty request body');
    body = JSON.parse(event.body);
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const { sessionId, guess, puzzleNumber, date } = body;

  // Input validation
  if (!sessionId || typeof sessionId !== 'string' || sessionId.length > 64) {
    return jsonResponse(400, { error: 'Invalid sessionId' });
  }
  if (!guess || typeof guess !== 'string') {
    return jsonResponse(400, { error: 'Missing guess' });
  }

  const normalizedGuess = guess.toUpperCase().trim();

  if (!/^[A-Z]{5}$/.test(normalizedGuess)) {
    return jsonResponse(400, { error: `Guess must be exactly ${WORD_LENGTH} letters` });
  }

  if (typeof puzzleNumber !== 'number' || !Number.isInteger(puzzleNumber) || puzzleNumber < 1) {
    return jsonResponse(400, { error: 'Invalid puzzleNumber' });
  }

  if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return jsonResponse(400, { error: 'Invalid date format (expected YYYY-MM-DD)' });
  }

  // Verify puzzle number matches requested date
  const today = getTodayUTC(await getTrustedNow());
  const dateObj = new Date(date + 'T00:00:00Z');
  if (isNaN(dateObj.getTime()) || dateObj.toISOString().split('T')[0] !== date) {
    return jsonResponse(400, { error: 'Invalid calendar date' });
  }

  if (date < EPOCH_DATE) {
    return jsonResponse(400, { error: `No puzzle exists before Wordora epoch (${EPOCH_DATE})` });
  }

  const expectedPuzzleNumber = getPuzzleNumberForDate(dateObj);
  if (puzzleNumber !== expectedPuzzleNumber) {
    return jsonResponse(400, { error: 'Puzzle number mismatch for requested date' });
  }

  const isPreview = date !== today;

  // Validate guess is in dictionary
  if (!isValidGuess(normalizedGuess)) {
    return jsonResponse(422, { error: 'Not in word list', code: 'INVALID_WORD' });
  }

  // Try to load/create session from MongoDB
  const database = await getDb();

  if (database) {
    // Answer lookup (DB schedule, legacy list as fallback) and session load are independent — run together
    const [answer, session] = await Promise.all([
      resolveAnswer(database, puzzleNumber),
      database.collection('gameSessions').findOne({ sessionId, puzzleNumber }),
    ]);
    return await handleWithDatabase(database, session, sessionId, normalizedGuess, answer, puzzleNumber, date, isPreview);
  } else {
    // Stateless fallback (no session persistence)
    const answer = await resolveAnswer(null, puzzleNumber);
    return handleStateless(normalizedGuess, answer);
  }
};

/**
 * Full server-side session tracking with MongoDB.
 */
async function handleWithDatabase(database, session, sessionId, guess, answer, puzzleNumber, date, isPreview = false) {
  const sessions = database.collection('gameSessions');
  const stats = database.collection('dailyStats');

  if (!session) {
    // New session for this puzzle
    session = {
      sessionId,
      puzzleNumber,
      date,
      isPreview,
      guesses: [],
      status: 'playing',
      attemptsUsed: 0,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours TTL
    };
  }

  // Reject if game already over
  if (session.status !== 'playing') {
    const revealAnswer = session.status !== 'playing' ? answer : null;
    return jsonResponse(409, {
      error: `Game already ${session.status}`,
      status: session.status,
      attemptsUsed: session.attemptsUsed,
      answer: revealAnswer,
    });
  }

  // Reject if max attempts reached
  if (session.attemptsUsed >= MAX_ATTEMPTS) {
    return jsonResponse(409, {
      error: 'No attempts remaining',
      status: 'lost',
      attemptsUsed: session.attemptsUsed,
      answer,
    });
  }

  // Check for duplicate guess
  if (session.guesses.includes(guess)) {
    return jsonResponse(409, { error: 'You already submitted that guess', code: 'DUPLICATE_GUESS' });
  }

  // Evaluate the guess
  const results = evaluateGuess(guess, answer);
  const won = isWin(results);

  session.guesses.push(guess);
  session.attemptsUsed += 1;

  const isLastAttempt = session.attemptsUsed >= MAX_ATTEMPTS;

  if (won) {
    session.status = 'won';
  } else if (isLastAttempt) {
    session.status = 'lost';
  }

  // Persist session (upsert) and update stats concurrently
  await Promise.all([
    sessions.replaceOne(
      { sessionId, puzzleNumber },
      session,
      { upsert: true }
    ),
    isPreview ? null : updateDailyStats(stats, session, date),
  ]);

  // Build response
  const gameOver = session.status !== 'playing';
  const responseAnswer = gameOver ? answer : null;

  let message = null;
  if (session.status === 'won') {
    const msgs = ['Genius!', 'Magnificent!', 'Impressive!', 'Splendid!', 'Great!', 'Phew!'];
    message = msgs[Math.min(session.attemptsUsed - 1, msgs.length - 1)];
  } else if (session.status === 'lost') {
    message = `The word was ${answer}`;
  }

  return jsonResponse(200, {
    results,
    attemptsUsed: session.attemptsUsed,
    status: session.status,
    answer: responseAnswer,
    message,
  });
}

/**
 * Updates daily stats for the official daily game (preview games NEVER modify official stats).
 * Only the first and final guess change any counter, so mid-game guesses skip the DB entirely.
 * Never throws — a stats failure must not fail the guess.
 */
async function updateDailyStats(stats, session, date) {
  const attemptIndex = session.attemptsUsed - 1; // 0-indexed

  const inc = {};
  if (session.attemptsUsed === 1) {
    inc.gamesStarted = 1;
  }
  if (session.status === 'won' || session.status === 'lost') {
    inc.gamesCompleted = 1;
    if (session.status === 'won') {
      inc.gamesWon = 1;
      inc[`attemptsDistribution.${attemptIndex}`] = 1;
    }
  }

  if (Object.keys(inc).length === 0) return;

  try {
    // 1. Ensure today's document exists with baseline structure
    await stats.updateOne(
      { date },
      {
        $setOnInsert: {
          date,
          gamesStarted: 0,
          gamesCompleted: 0,
          gamesWon: 0,
          attemptsDistribution: [0, 0, 0, 0, 0, 0],
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    // 2. Safely increment counters
    await stats.updateOne(
      { date },
      {
        $inc: inc,
        $set: { updatedAt: new Date() },
      }
    );
  } catch (statsErr) {
    // Non-fatal — don't fail the request if stats update fails
    console.error('[submit-guess] Stats update failed:', statsErr.message);
  }
}

/**
 * Stateless fallback — evaluates the guess but cannot track session state.
 * Warns the caller that server-side state is unavailable.
 */
function handleStateless(guess, answer) {
  const results = evaluateGuess(guess, answer);
  const won = isWin(results);

  return jsonResponse(200, {
    results,
    attemptsUsed: null,  // Unknown — client must track
    status: won ? 'won' : 'playing',
    answer: null,
    message: null,
    warning: 'Server session unavailable. Game state managed client-side only.',
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-ID',
  };
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}
