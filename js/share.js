/**
 * Wordora — Share Feature
 * 
 * Generates an emoji grid for sharing game results.
 * - Never includes the answer word
 * - Uses only tile result emojis
 * - Copies to clipboard or falls back to Web Share API
 */

'use strict';

import { RESULT } from './game.js';

const EMOJI = {
  [RESULT.CORRECT]: '🟩',
  [RESULT.PRESENT]: '🟨',
  [RESULT.ABSENT]:  '⬛',
};

/**
 * Generates the shareable emoji string.
 * 
 * @param {number} puzzleNumber
 * @param {string} status - 'won' | 'lost'
 * @param {number} attemptsUsed
 * @param {Array<Array<{result: string}>>} allResults
 * @returns {string}
 */
export function generateShareText(puzzleNumber, status, attemptsUsed, allResults) {
  const header = `Wordora #${puzzleNumber} ${status === 'won' ? attemptsUsed : 'X'}/6`;

  const grid = allResults
    .map(row => row.map(tile => EMOJI[tile.result] || EMOJI[RESULT.ABSENT]).join(''))
    .join('\n');

  const footer = 'wordora.netlify.app';

  return `${header}\n\n${grid}\n\n${footer}`;
}

/**
 * Shares the result using Web Share API or falls back to clipboard copy.
 * Returns a message describing what happened.
 * 
 * @param {string} text - Share text
 * @returns {Promise<'shared'|'copied'|'error'>}
 */
export async function shareResult(text) {
  // Try Web Share API (mobile browsers)
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return 'shared';
    } catch (err) {
      if (err.name !== 'AbortError') {
        // Fallthrough to clipboard
      } else {
        return 'error';
      }
    }
  }

  // Clipboard API
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return 'copied';
    } catch {
      // Fallthrough to manual copy
    }
  }

  // Legacy clipboard via textarea
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
    document.body.appendChild(el);
    el.focus();
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    return 'copied';
  } catch {
    return 'error';
  }
}
