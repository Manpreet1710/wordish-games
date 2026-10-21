/**
 * Wordora — Dialogs Module
 * 
 * Manages Help, Statistics, and Settings modals.
 * Each dialog is a singleton overlay rendered in the HTML.
 */

'use strict';

import { loadStats, loadSettings, saveSettings } from './storage.js';
import { generateShareText, shareResult } from './share.js';
import { getMsUntilNextPuzzle, formatCountdown } from './game.js';

// Dialog IDs
const DIALOG_HELP = 'dialog-help';
const DIALOG_STATS = 'dialog-stats';
const DIALOG_SETTINGS = 'dialog-settings';

let _countdownInterval = null;

// ─────────────────────────────────────────────────────────────
// Generic Dialog Controls
// ─────────────────────────────────────────────────────────────

/**
 * Opens a dialog overlay.
 * @param {string} dialogId
 */
export function openDialog(dialogId) {
  const overlay = document.getElementById(dialogId);
  if (!overlay) return;

  // Close any other open dialogs first
  document.querySelectorAll('.dialog-overlay.open').forEach(el => {
    if (el.id !== dialogId) closeDialog(el.id);
  });

  overlay.classList.add('open');
  overlay.removeAttribute('hidden');
  overlay.setAttribute('aria-hidden', 'false');

  // Trap focus inside dialog
  const dialog = overlay.querySelector('.dialog');
  const firstFocusable = dialog?.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  firstFocusable?.focus();

  // Close on overlay click
  overlay.addEventListener('click', handleOverlayClick);

  // Refresh content if needed
  if (dialogId === DIALOG_STATS) {
    renderStatsContent();
  }
}

/**
 * Closes a dialog overlay.
 * @param {string} dialogId
 */
export function closeDialog(dialogId) {
  const overlay = document.getElementById(dialogId);
  if (!overlay) return;

  overlay.classList.remove('open');
  overlay.setAttribute('hidden', '');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.removeEventListener('click', handleOverlayClick);

  if (dialogId === DIALOG_STATS && _countdownInterval) {
    clearInterval(_countdownInterval);
    _countdownInterval = null;
  }
}

function handleOverlayClick(e) {
  if (e.target === e.currentTarget) {
    closeDialog(e.currentTarget.id);
  }
}

// Close on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.dialog-overlay.open').forEach(el => closeDialog(el.id));
  }
});

// ─────────────────────────────────────────────────────────────
// Stats Dialog
// ─────────────────────────────────────────────────────────────

/**
 * Renders the stats dialog content from localStorage.
 */
function renderStatsContent() {
  const stats = loadStats();

  // Summary numbers
  const el = id => document.getElementById(id);
  setTextSafe(el('stat-played'), stats.gamesPlayed);
  setTextSafe(el('stat-win-pct'), stats.gamesPlayed > 0
    ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100)
    : 0);
  setTextSafe(el('stat-streak'), stats.currentStreak);
  setTextSafe(el('stat-max-streak'), stats.maxStreak);

  // Guess distribution bars
  const maxVal = Math.max(...stats.distribution, 1);
  for (let i = 0; i < 6; i++) {
    const bar = document.getElementById(`dist-bar-${i + 1}`);
    const count = document.getElementById(`dist-count-${i + 1}`);
    if (bar) {
      const pct = Math.max(7, Math.round((stats.distribution[i] / maxVal) * 100));
      bar.style.width = `${pct}%`;
      if (count) count.textContent = stats.distribution[i];
    }
  }

  // Countdown to next puzzle
  startCountdown();
}

function startCountdown() {
  const el = document.getElementById('countdown');
  if (!el) return;

  if (_countdownInterval) clearInterval(_countdownInterval);

  function tick() {
    const ms = getMsUntilNextPuzzle();
    el.textContent = formatCountdown(ms);
    if (ms <= 0) {
      clearInterval(_countdownInterval);
      _countdownInterval = null;
    }
  }

  tick();
  _countdownInterval = setInterval(tick, 1000);
}

function setTextSafe(el, value) {
  if (el) el.textContent = value;
}

// ─────────────────────────────────────────────────────────────
// Stats with game result
// ─────────────────────────────────────────────────────────────

/**
 * Populates the stats dialog with game result context.
 * Called after a game ends.
 * 
 * @param {Object} params
 * @param {string} params.status - 'won' | 'lost'
 * @param {number} params.attemptsUsed
 * @param {number} params.puzzleNumber
 * @param {string} params.answer - Revealed answer (only after game over)
 * @param {Array} params.allResults - All guess results
 * @param {string} params.message
 */
export function showGameResult({ status, attemptsUsed, puzzleNumber, answer, allResults, message }) {
  const banner = document.getElementById('game-result-banner');
  if (banner) {
    banner.className = `game-result-banner${status === 'lost' ? ' lost' : ''}`;
    banner.removeAttribute('hidden');

    const emoji = document.getElementById('result-emoji');
    const msg = document.getElementById('result-message');
    const attempts = document.getElementById('result-attempts');

    if (emoji) emoji.textContent = status === 'won' ? '🎉' : '😔';
    if (msg) msg.textContent = message || (status === 'won' ? 'You got it!' : `The word was ${answer}`);
    if (attempts) attempts.textContent = status === 'won'
      ? `${attemptsUsed}/6 attempts`
      : `Better luck next time!`;
  }

  // Set up share button
  const shareBtn = document.getElementById('share-btn');
  if (shareBtn) {
    const shareText = generateShareText(puzzleNumber, status, attemptsUsed, allResults);

    // Show share preview
    const preview = document.getElementById('share-preview');
    if (preview) preview.textContent = shareText;

    shareBtn.onclick = async () => {
      const result = await shareResult(shareText);
      const toastContainer = document.getElementById('toast-container');
      if (toastContainer) {
        const { showToast } = await import('./ui.js');
        if (result === 'copied') showToast(toastContainer, 'Result copied to clipboard!');
        else if (result === 'shared') showToast(toastContainer, 'Shared!');
        else showToast(toastContainer, 'Unable to share. Try copying manually.');
      }
    };
  }

  openDialog(DIALOG_STATS);
}

// ─────────────────────────────────────────────────────────────
// Settings Dialog
// ─────────────────────────────────────────────────────────────

/**
 * Initializes settings controls from stored values.
 */
export function initSettings() {
  const settings = loadSettings();

  const darkToggle = document.getElementById('toggle-dark-mode');
  const motionToggle = document.getElementById('toggle-reduced-motion');

  if (darkToggle) {
    darkToggle.checked = settings.darkMode;
    darkToggle.addEventListener('change', () => {
      const val = darkToggle.checked;
      saveSettings({ darkMode: val });
      applyTheme(val);
    });
  }

  if (motionToggle) {
    motionToggle.checked = settings.reducedMotion;
    motionToggle.addEventListener('change', () => {
      const val = motionToggle.checked;
      saveSettings({ reducedMotion: val });
      applyReducedMotion(val);
    });
  }

  // Apply stored settings on load
  applyTheme(settings.darkMode);
  applyReducedMotion(settings.reducedMotion);
}

/**
 * Applies dark/light theme.
 * @param {boolean} isDark
 */
export function applyTheme(isDark) {
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';

  // Sync system preference detection
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) meta.content = isDark ? 'dark' : 'light';
}

/**
 * Applies reduced motion preference.
 * @param {boolean} reduced
 */
export function applyReducedMotion(reduced) {
  document.documentElement.dataset.reducedMotion = reduced ? 'true' : 'false';
}

// ─────────────────────────────────────────────────────────────
// Wire up close buttons (called from app.js on DOMContentLoaded)
// ─────────────────────────────────────────────────────────────

export function initDialogCloseButtons() {
  document.querySelectorAll('[data-close-dialog]').forEach(btn => {
    btn.addEventListener('click', () => {
      const dialogId = btn.dataset.closeDialog;
      closeDialog(dialogId);
    });
  });
}
