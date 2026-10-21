/**
 * Wordora — API Client
 * 
 * Wraps fetch calls to Netlify Functions with:
 * - Typed request/response handling
 * - Timeout support
 * - Error normalization
 * - Local development detection
 */

'use strict';

const API_BASE = '/.netlify/functions';
const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Wraps fetch with a timeout.
 * @param {string} url
 * @param {RequestInit} options
 * @param {number} timeoutMs
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Parses a fetch response to JSON, handling non-2xx status codes.
 * @param {Response} response
 * @returns {Promise<Object>}
 */
async function parseResponse(response) {
  let data;
  try {
    data = await response.json();
  } catch {
    data = { error: 'Invalid server response' };
  }

  if (!response.ok) {
    const error = new Error(data?.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.code = data?.code;
    error.data = data;
    throw error;
  }

  return data;
}

/**
 * GET /.netlify/functions/get-puzzle
 * Returns current puzzle metadata (no answer).
 * 
 * @returns {Promise<{puzzleNumber: number, date: string, maxAttempts: number, wordLength: number, nextPuzzleAt: string}>}
 */
export async function getPuzzle(date = null) {
  const url = date ? `${API_BASE}/get-puzzle?date=${encodeURIComponent(date)}` : `${API_BASE}/get-puzzle`;
  const response = await fetchWithTimeout(url);
  return parseResponse(response);
}

/**
 * POST /.netlify/functions/submit-guess
 * Submits a guess and returns tile evaluation results.
 * 
 * @param {Object} payload
 * @param {string} payload.sessionId
 * @param {string} payload.guess
 * @param {number} payload.puzzleNumber
 * @param {string} payload.date
 * @returns {Promise<{results: Array, attemptsUsed: number, status: string, answer: string|null, message: string|null}>}
 */
export async function submitGuess(payload) {
  const response = await fetchWithTimeout(
    `${API_BASE}/submit-guess`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );
  return parseResponse(response);
}

/**
 * GET /.netlify/functions/get-stats
 * Returns aggregated public daily statistics.
 * 
 * @returns {Promise<Object>}
 */
export async function getGlobalStats() {
  const response = await fetchWithTimeout(`${API_BASE}/get-stats`);
  return parseResponse(response);
}
