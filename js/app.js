/**
 * Wordora — Main Application Controller
 * 
 * Orchestrates: puzzle loading, input handling, guess submission,
 * state persistence, animations, and dialog management.
 * 
 * Architecture:
 * - The SERVER is authoritative for guess evaluation and game state
 * - The CLIENT maintains optimistic local state for UX responsiveness
 * - localStorage stores progress so page refreshes restore game state
 * - All game-over state is persisted to prevent double-counting
 */

'use strict';

import {
  getCurrentPuzzleNumber,
  getTodayUTC,
  getPuzzleNumberForDate,
  getDateForPuzzleNumber,
  formatDateDisplay,
  evaluateGuess,
  isWin,
  deriveKeyboardState,
  getWinMessage,
  syncServerTime,
  STATUS,
  WORD_LENGTH,
  MAX_ATTEMPTS,
} from './game.js';

import {
  loadPuzzleState,
  savePuzzleState,
  recordGameResult,
  getSessionId,
  loadSettings,
} from './storage.js';

import {
  createBoard,
  createKeyboard,
  updateKeyboard,
  revealRow,
  restoreRow,
  updateInputRow,
  playWinAnimation,
  playShakeAnimation,
  showToast,
  updatePuzzleNumber,
  updateDateDisplay,
  showPreviewBanner,
  hidePreviewBanner,
} from './ui.js';

import {
  getPuzzle,
  submitGuess,
} from './api.js';

import {
  openDialog,
  closeDialog,
  showGameResult,
  initSettings,
  initDialogCloseButtons,
} from './dialogs.js';

import { CalendarDatePicker } from './calendar.js';

// ─────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────
const state = {
  // Today's official puzzle identity
  todayPuzzleNumber: null,
  todayDate: null,

  // Current active puzzle (today or preview date)
  puzzleNumber: null,
  date: null,
  isPreview: false,

  currentRow: 0,
  currentInput: '',
  gameState: null,       // Loaded from localStorage
  isSubmitting: false,
  isGameOver: false,
};

// ─────────────────────────────────────────────────────────────
// DOM Elements & Components
// ─────────────────────────────────────────────────────────────
let boardEl, keyboardEl, toastEl;
let calendar = null;

// ─────────────────────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────────────────────

async function init() {
  boardEl     = document.getElementById('board');
  keyboardEl  = document.getElementById('keyboard');
  toastEl     = document.getElementById('toast-container');

  // Settings (dark mode, reduced motion)
  initSettings();
  initDialogCloseButtons();

  // Header buttons
  document.getElementById('btn-help')?.addEventListener('click', () => openDialog('dialog-help'));
  document.getElementById('btn-stats')?.addEventListener('click', () => openDialog('dialog-stats'));
  document.getElementById('btn-settings')?.addEventListener('click', () => openDialog('dialog-settings'));

  // Return to today button on preview banner
  document.getElementById('btn-return-today')?.addEventListener('click', () => {
    switchToDate(state.todayDate);
  });

  // Create board and keyboard
  createBoard(boardEl);
  createKeyboard(keyboardEl, handleKey);

  // Physical keyboard
  document.addEventListener('keydown', handlePhysicalKey);

  // Load today's puzzle identity
  await loadPuzzleIdentity();

  // Initialize Calendar Date Picker
  const triggerBtn = document.getElementById('btn-date-picker');
  const popoverEl = document.getElementById('calendar-popover');
  if (triggerBtn && popoverEl) {
    calendar = new CalendarDatePicker({
      triggerBtn,
      popoverEl,
      minDate: '2024-01-01',
      getTodayDate: () => state.todayDate,
      getSelectedDate: () => state.date,
      onSelectDate: (selectedDate) => {
        switchToDate(selectedDate);
      },
      onUnavailableDate: (dateStr) => {
        if (dateStr > state.todayDate) {
          showToast(toastEl, 'This puzzle has not been released yet');
        } else {
          showToast(toastEl, 'No puzzle available for this date');
        }
      },
    });
  }

  // Restore saved state for today's puzzle
  loadActivePuzzle();

  // Show help on first visit
  const savedSettings = loadSettings();
  const store = (() => {
    try { return JSON.parse(localStorage.getItem('wordora_v1') || '{}'); } catch { return {}; }
  })();
  if (!store.seenHelp) {
    setTimeout(() => openDialog('dialog-help'), 500);
    const s = store;
    s.seenHelp = true;
    try { localStorage.setItem('wordora_v1', JSON.stringify(s)); } catch {}
  }
}

// ─────────────────────────────────────────────────────────────
// Puzzle Identity
// ─────────────────────────────────────────────────────────────

async function loadPuzzleIdentity() {
  // Determine today's puzzle identity from UTC date (client-side, authoritative)
  state.todayPuzzleNumber = getCurrentPuzzleNumber();
  state.todayDate = getTodayUTC();

  state.puzzleNumber = state.todayPuzzleNumber;
  state.date = state.todayDate;
  state.isPreview = false;

  // Update header display
  updatePuzzleNumber(state.puzzleNumber);
  updateDateDisplay(state.date);

  // Server date is authoritative (client clock may be wrong or stale)
  try {
    const puzzle = await getPuzzle();
    if (puzzle && puzzle.puzzleNumber) {
      if (puzzle.serverTime) syncServerTime(puzzle.serverTime);
      state.todayPuzzleNumber = puzzle.puzzleNumber;
      state.todayDate = puzzle.today || puzzle.date;
      state.puzzleNumber = puzzle.puzzleNumber;
      state.date = state.todayDate;
      updatePuzzleNumber(state.puzzleNumber);
      updateDateDisplay(state.date);
    }
  } catch (err) {
    console.warn('Could not fetch puzzle from server:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────
// Date Switching & Preview Mode
// ─────────────────────────────────────────────────────────────

async function switchToDate(targetDate) {
  if (state.isSubmitting) return;
  if (targetDate === state.date) return;

  const isTargetToday = (targetDate === state.todayDate);

  if (isTargetToday) {
    state.isPreview = false;
    state.date = state.todayDate;
    state.puzzleNumber = state.todayPuzzleNumber;

    updatePuzzleNumber(state.puzzleNumber);
    updateDateDisplay(state.date);
    hidePreviewBanner();
    loadActivePuzzle();
    return;
  }

  // Preview Mode
  try {
    const puzzle = await getPuzzle(targetDate);
    if (!puzzle.available) {
      showToast(toastEl, puzzle.message || 'Puzzle not available for this date');
      return;
    }

    state.isPreview = true;
    state.date = puzzle.date;
    state.puzzleNumber = puzzle.puzzleNumber;

    updatePuzzleNumber(state.puzzleNumber);
    updateDateDisplay(state.date);
    showPreviewBanner(state.date);
    loadActivePuzzle();
  } catch (err) {
    if (targetDate >= '2024-01-01') {
      state.isPreview = true;
      state.date = targetDate;
      state.puzzleNumber = getPuzzleNumberForDate(targetDate);

      updatePuzzleNumber(state.puzzleNumber);
      updateDateDisplay(state.date);
      showPreviewBanner(state.date);
      loadActivePuzzle();
    } else {
      showToast(toastEl, err.message || 'Could not load puzzle for this date');
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Active Puzzle State Loading
// ─────────────────────────────────────────────────────────────

function loadActivePuzzle() {
  createBoard(boardEl);
  createKeyboard(keyboardEl, handleKey);
  state.currentInput = '';

  const savedState = loadPuzzleState(state.puzzleNumber, state.date, state.isPreview);
  state.gameState = savedState;

  // Restore completed rows
  savedState.guesses.forEach((guess, rowIndex) => {
    const results = savedState.results[rowIndex];
    if (results) {
      restoreRow(boardEl, rowIndex, guess, results);
    }
  });

  // Restore keyboard colors
  if (savedState.keyboardState && Object.keys(savedState.keyboardState).length > 0) {
    updateKeyboard(keyboardEl, savedState.keyboardState);
  }

  state.currentRow = savedState.guesses.length;

  if (savedState.status !== STATUS.PLAYING) {
    state.isGameOver = true;
    disableInput();
  } else {
    state.isGameOver = false;
  }
}

// ─────────────────────────────────────────────────────────────
// Input Handling
// ─────────────────────────────────────────────────────────────

function handlePhysicalKey(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  if (e.key === 'Enter') {
    handleKey('ENTER');
  } else if (e.key === 'Backspace' || e.key === 'Delete') {
    handleKey('BACKSPACE');
  } else if (/^[a-zA-Z]$/.test(e.key)) {
    handleKey(e.key.toUpperCase());
  }
}

function handleKey(key) {
  if (state.isGameOver || state.isSubmitting) return;

  if (key === 'ENTER') {
    submitCurrentGuess();
  } else if (key === 'BACKSPACE') {
    if (state.currentInput.length > 0) {
      state.currentInput = state.currentInput.slice(0, -1);
      updateInputRow(boardEl, state.currentRow, state.currentInput);
    }
  } else if (/^[A-Z]$/.test(key) && state.currentInput.length < WORD_LENGTH) {
    state.currentInput += key;
    updateInputRow(boardEl, state.currentRow, state.currentInput);
  }
}

function disableInput() {
  // Visual — keyboard still renders but clicks are ignored via isGameOver flag
}

// ─────────────────────────────────────────────────────────────
// Guess Submission
// ─────────────────────────────────────────────────────────────

async function submitCurrentGuess() {
  if (state.currentInput.length !== WORD_LENGTH) {
    showToast(toastEl, 'Not enough letters');
    playShakeAnimation(boardEl, state.currentRow);
    return;
  }

  if (state.isSubmitting) return;
  state.isSubmitting = true;

  const guess = state.currentInput;

  try {
    const response = await submitGuess({
      sessionId: getSessionId(),
      guess,
      puzzleNumber: state.puzzleNumber,
      date: state.date,
    });

    // Handle invalid word
    if (response.code === 'INVALID_WORD') {
      showToast(toastEl, 'Not in word list');
      playShakeAnimation(boardEl, state.currentRow);
      state.isSubmitting = false;
      return;
    }

    // Handle already-submitted guess
    if (response.code === 'DUPLICATE_GUESS') {
      showToast(toastEl, 'Already guessed that word');
      playShakeAnimation(boardEl, state.currentRow);
      state.isSubmitting = false;
      return;
    }

    const { results, status, answer, message } = response;

    // Reveal tiles with animation
    revealRow(boardEl, state.currentRow, results, () => {
      // After animation completes:

      // Update keyboard
      const allResults = [...(state.gameState.results || []), results];
      const kbState = deriveKeyboardState(allResults);
      updateKeyboard(keyboardEl, kbState);

      // Update game state
      state.gameState.guesses.push(guess);
      state.gameState.results.push(results);
      state.gameState.keyboardState = kbState;
      state.gameState.status = status || (isWin(results) ? STATUS.WON : (state.currentRow + 1 >= MAX_ATTEMPTS ? STATUS.LOST : STATUS.PLAYING));

      state.currentRow += 1;
      state.currentInput = '';

      // Persist state (isolated for preview mode)
      savePuzzleState(state.gameState, state.isPreview);

      // Handle win/loss
      if (state.gameState.status === STATUS.WON) {
        state.isGameOver = true;
        const attempts = state.gameState.guesses.length;
        const winMsg = message || getWinMessage(attempts);

        playWinAnimation(boardEl, state.currentRow - 1);

        setTimeout(() => {
          showToast(toastEl, winMsg, 2500);
        }, 100);

        // Record stats (skipped if preview mode)
        recordGameResult(state.gameState, state.date, state.isPreview);

        // Show result dialog after animation
        setTimeout(() => {
          showGameResult({
            status: STATUS.WON,
            attemptsUsed: attempts,
            puzzleNumber: state.puzzleNumber,
            answer: answer || '',
            allResults: state.gameState.results,
            message: winMsg,
          });
        }, 2200);

      } else if (state.gameState.status === STATUS.LOST) {
        state.isGameOver = true;
        const lostAnswer = answer || '?????';
        showToast(toastEl, lostAnswer, 4000);

        // Record stats (skipped if preview mode)
        recordGameResult(state.gameState, state.date, state.isPreview);

        setTimeout(() => {
          showGameResult({
            status: STATUS.LOST,
            attemptsUsed: MAX_ATTEMPTS,
            puzzleNumber: state.puzzleNumber,
            answer: lostAnswer,
            allResults: state.gameState.results,
            message: `The word was ${lostAnswer}`,
          });
        }, 3500);
      }

      state.isSubmitting = false;
    });

  } catch (err) {
    state.isSubmitting = false;

    if (err.status === 422 || err.code === 'INVALID_WORD') {
      showToast(toastEl, 'Not in word list');
      playShakeAnimation(boardEl, state.currentRow);
    } else if (err.status === 429) {
      showToast(toastEl, 'Too many guesses. Please wait.');
    } else if (err.status === 409) {
      showToast(toastEl, err.message || 'Game already completed');
    } else if (err.status === 403) {
      showToast(toastEl, err.message || 'Puzzle not available');
      playShakeAnimation(boardEl, state.currentRow);
    } else if (err.status === 400) {
      showToast(toastEl, err.message || 'Invalid guess');
      playShakeAnimation(boardEl, state.currentRow);
    } else if (err.name === 'AbortError') {
      showToast(toastEl, 'Request timed out. Check your connection.');
    } else {
      // True network/unreachable error
      console.error('API error:', err.message);
      handleOfflineFallback(guess);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Offline Fallback
// ─────────────────────────────────────────────────────────────

/**
 * When the server is unreachable, attempt local evaluation.
 * Cannot validate guess against dictionary without server.
 * Shows a warning toast.
 */
async function handleOfflineFallback(guess) {
  showToast(toastEl, 'Server unreachable — playing offline', 2500);

  // We can't evaluate without the answer (which is secret).
  // Show a warning and don't consume the attempt.
  // The player must retry when online.
  
  // Note: A more robust offline mode would require bundling the word list
  // which would expose the answer sequence to clients.
  // This is the correct trade-off for maintaining answer secrecy.
  console.warn('Offline fallback: guess not consumed. Server required for evaluation.');
}

// ─────────────────────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
