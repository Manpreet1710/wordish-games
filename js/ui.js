/**
 * Wordora — UI Module
 * 
 * All DOM manipulation and animation logic.
 * Separated from game logic for testability.
 */

'use strict';

import { RESULT, WORD_LENGTH, MAX_ATTEMPTS, formatDateDisplay } from './game.js';

// ─────────────────────────────────────────────────────────────
// Board
// ─────────────────────────────────────────────────────────────

/**
 * Creates the 6x5 game board grid.
 * @param {HTMLElement} boardEl
 */
export function createBoard(boardEl) {
  boardEl.innerHTML = '';
  for (let row = 0; row < MAX_ATTEMPTS; row++) {
    for (let col = 0; col < WORD_LENGTH; col++) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.dataset.row = row;
      tile.dataset.col = col;
      tile.dataset.state = 'empty';
      tile.setAttribute('aria-label', `Row ${row + 1}, letter ${col + 1}`);
      boardEl.appendChild(tile);
    }
  }
}

/**
 * Gets a tile element by row and column.
 * @param {HTMLElement} boardEl
 * @param {number} row
 * @param {number} col
 * @returns {HTMLElement}
 */
export function getTile(boardEl, row, col) {
  return boardEl.querySelector(`[data-row="${row}"][data-col="${col}"]`);
}

/**
 * Gets all tiles in a row.
 * @param {HTMLElement} boardEl
 * @param {number} row
 * @returns {HTMLElement[]}
 */
export function getRowTiles(boardEl, row) {
  return Array.from(boardEl.querySelectorAll(`[data-row="${row}"]`));
}

/**
 * Updates a tile's displayed letter.
 * @param {HTMLElement} tile
 * @param {string} letter
 */
export function setTileLetter(tile, letter) {
  tile.textContent = letter;
  tile.dataset.letter = letter;
  tile.dataset.state = letter ? 'tbd' : 'empty';
  tile.setAttribute('aria-label', letter ? `Letter ${letter}` : 'Empty');
}

/**
 * Reveals a row of tiles with flip animation.
 * Each tile flips with a staggered delay.
 * 
 * @param {HTMLElement} boardEl
 * @param {number} row
 * @param {Array<{letter: string, result: string}>} results
 * @param {Function} onComplete - Called after all animations finish
 */
export function revealRow(boardEl, row, results, onComplete) {
  const tiles = getRowTiles(boardEl, row);
  const flipDuration = 500;
  const staggerDelay = 300;

  tiles.forEach((tile, i) => {
    const { result } = results[i];

    setTimeout(() => {
      tile.classList.add('flip');

      // Apply result state at midpoint of flip (when tile is face-down)
      setTimeout(() => {
        tile.dataset.state = result;
        tile.setAttribute('aria-label', `${tile.textContent} — ${resultLabel(result)}`);
      }, flipDuration / 2);

      if (i === tiles.length - 1) {
        setTimeout(() => {
          tile.classList.remove('flip');
          if (onComplete) onComplete();
        }, flipDuration);
      } else {
        setTimeout(() => tile.classList.remove('flip'), flipDuration);
      }
    }, i * staggerDelay);
  });
}

/**
 * Returns a human-readable label for a tile result.
 * @param {string} result
 * @returns {string}
 */
function resultLabel(result) {
  switch (result) {
    case RESULT.CORRECT: return 'correct position';
    case RESULT.PRESENT: return 'wrong position';
    case RESULT.ABSENT:  return 'not in word';
    default:             return '';
  }
}

/**
 * Plays win bounce animation on tiles in a row.
 * @param {HTMLElement} boardEl
 * @param {number} row
 */
export function playWinAnimation(boardEl, row) {
  const tiles = getRowTiles(boardEl, row);
  tiles.forEach((tile, i) => {
    setTimeout(() => {
      tile.classList.add('bounce');
      tile.addEventListener('animationend', () => tile.classList.remove('bounce'), { once: true });
    }, i * 100);
  });
}

/**
 * Plays shake animation on an invalid row.
 * @param {HTMLElement} boardEl
 * @param {number} row
 */
export function playShakeAnimation(boardEl, row) {
  const tiles = getRowTiles(boardEl, row);
  // Wrap all tiles in a row container for shake (already in grid — animate each)
  tiles.forEach(tile => {
    tile.classList.add('shake');
    tile.addEventListener('animationend', () => tile.classList.remove('shake'), { once: true });
  });
}

/**
 * Restores a previously played row from saved state (no animation).
 * @param {HTMLElement} boardEl
 * @param {number} row
 * @param {string} guess
 * @param {Array<{letter: string, result: string}>} results
 */
export function restoreRow(boardEl, row, guess, results) {
  const tiles = getRowTiles(boardEl, row);
  tiles.forEach((tile, i) => {
    tile.textContent = guess[i];
    tile.dataset.letter = guess[i];
    tile.dataset.state = results[i].result;
    tile.setAttribute('aria-label', `${guess[i]} — ${resultLabel(results[i].result)}`);
  });
}

/**
 * Updates the current input row with typed letters.
 * @param {HTMLElement} boardEl
 * @param {number} row
 * @param {string} currentInput - Letters typed so far
 */
export function updateInputRow(boardEl, row, currentInput) {
  const tiles = getRowTiles(boardEl, row);
  tiles.forEach((tile, i) => {
    const letter = currentInput[i] || '';
    tile.textContent = letter;
    tile.dataset.letter = letter || undefined;
    tile.dataset.state = letter ? 'tbd' : 'empty';
    tile.setAttribute('aria-label', letter ? `Letter ${letter}` : 'Empty');
  });
}

// ─────────────────────────────────────────────────────────────
// Keyboard
// ─────────────────────────────────────────────────────────────

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '←'],
];

/**
 * Creates the on-screen keyboard.
 * @param {HTMLElement} keyboardEl
 * @param {Function} onKey - Called with the key value when pressed
 */
export function createKeyboard(keyboardEl, onKey) {
  keyboardEl.innerHTML = '';

  KEYBOARD_ROWS.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.className = 'keyboard-row';

    row.forEach(key => {
      const btn = document.createElement('button');
      btn.className = 'key';
      btn.type = 'button';
      btn.dataset.key = key;

      if (key === 'ENTER') {
        btn.classList.add('wide');
        btn.setAttribute('aria-label', 'Enter — submit guess');
        btn.innerHTML = `
          <svg class="key-icon" viewBox="0 0 24 24" aria-hidden="true">
            <polyline points="9 10 4 15 9 20"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/>
          </svg>`;
      } else if (key === '←') {
        btn.classList.add('wide');
        btn.setAttribute('aria-label', 'Backspace — delete letter');
        btn.dataset.key = 'BACKSPACE';
        btn.innerHTML = `
          <svg class="key-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/>
            <line x1="18" y1="9" x2="13" y2="14"/><line x1="13" y1="9" x2="18" y2="14"/>
          </svg>`;
      } else {
        btn.textContent = key;
        btn.setAttribute('aria-label', `Letter ${key}`);
      }

      btn.addEventListener('click', () => onKey(btn.dataset.key));
      // Touch: prevent double-click delay
      btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        onKey(btn.dataset.key);
      }, { passive: false });

      rowEl.appendChild(btn);
    });

    keyboardEl.appendChild(rowEl);
  });
}

/**
 * Updates keyboard key colors based on game state.
 * @param {HTMLElement} keyboardEl
 * @param {Object.<string, string>} keyboardState - { LETTER: 'correct'|'present'|'absent' }
 */
export function updateKeyboard(keyboardEl, keyboardState) {
  for (const [letter, result] of Object.entries(keyboardState)) {
    const key = keyboardEl.querySelector(`[data-key="${letter}"]`);
    if (key) {
      key.dataset.state = result;
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Toast
// ─────────────────────────────────────────────────────────────

let toastTimeout = null;

/**
 * Shows a toast notification.
 * @param {HTMLElement} containerEl
 * @param {string} message
 * @param {number} [duration=1800]
 */
export function showToast(containerEl, message, duration = 1800) {
  // Remove existing toasts
  while (containerEl.firstChild) {
    containerEl.removeChild(containerEl.firstChild);
  }
  if (toastTimeout) {
    clearTimeout(toastTimeout);
    toastTimeout = null;
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  containerEl.appendChild(toast);

  toastTimeout = setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
    toastTimeout = null;
  }, duration);
}

// ─────────────────────────────────────────────────────────────
// Puzzle Header & Date Display
// ─────────────────────────────────────────────────────────────

/**
 * Updates the puzzle number display in the header.
 * @param {number} puzzleNumber
 */
export function updatePuzzleNumber(puzzleNumber) {
  const el = document.getElementById('puzzle-number');
  if (el) el.textContent = `Puzzle #${puzzleNumber}`;
}

/**
 * Updates the date selector button text in the header.
 * @param {string} dateStr - YYYY-MM-DD
 */
export function updateDateDisplay(dateStr) {
  const el = document.getElementById('date-display');
  if (el) el.textContent = formatDateDisplay(dateStr);
}

/**
 * Shows the preview mode banner with the active preview date.
 * @param {string} dateStr - YYYY-MM-DD
 */
export function showPreviewBanner(dateStr) {
  const banner = document.getElementById('preview-banner');
  const label = document.getElementById('preview-date-label');
  if (label) label.textContent = formatDateDisplay(dateStr);
  if (banner) banner.removeAttribute('hidden');
}

/**
 * Hides the preview mode banner.
 */
export function hidePreviewBanner() {
  const banner = document.getElementById('preview-banner');
  if (banner) banner.setAttribute('hidden', '');
}
