/**
 * Wordora — Calendar Date Picker Component
 * 
 * Provides an accessible, keyboard-navigable, dark-themed calendar popover
 * for browsing past and available daily puzzles.
 * 
 * All date calculations use UTC to prevent local timezone discrepancies.
 */

'use strict';

import { formatDateDisplay } from './game.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export class CalendarDatePicker {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.triggerBtn - Header button that toggles calendar
   * @param {HTMLElement} options.popoverEl - The calendar popover container
   * @param {string} options.minDate - Epoch date string (YYYY-MM-DD), default '2024-01-01'
   * @param {Function} options.getTodayDate - Returns today's UTC date string
   * @param {Function} options.getSelectedDate - Returns currently selected UTC date string
   * @param {Function} options.onSelectDate - Callback(dateStr) when an available date is selected
   * @param {Function} [options.onUnavailableDate] - Callback(dateStr) when an unavailable date is attempted
   */
  constructor(options) {
    this.triggerBtn = options.triggerBtn;
    this.popoverEl = options.popoverEl;
    this.minDate = options.minDate || '2024-01-01';
    this.getTodayDate = options.getTodayDate;
    this.getSelectedDate = options.getSelectedDate;
    this.onSelectDate = options.onSelectDate;
    this.onUnavailableDate = options.onUnavailableDate || (() => {});

    // Elements inside popover
    this.monthYearEl = this.popoverEl.querySelector('#cal-month-year');
    this.prevBtn = this.popoverEl.querySelector('#cal-prev-month');
    this.nextBtn = this.popoverEl.querySelector('#cal-next-month');
    this.gridEl = this.popoverEl.querySelector('#cal-grid');
    this.jumpTodayBtn = this.popoverEl.querySelector('#cal-jump-today');

    // Calendar view state (UTC year and month 0-11)
    const initialSelected = this.getSelectedDate() || this.getTodayDate() || new Date().toISOString().split('T')[0];
    const parts = String(initialSelected).split('-');
    this.viewYear = parseInt(parts[0], 10) || new Date().getUTCFullYear();
    this.viewMonth = isNaN(parseInt(parts[1], 10)) ? new Date().getUTCMonth() : parseInt(parts[1], 10) - 1;
    this.isOpen = false;

    this.initListeners();
  }

  initListeners() {
    // Toggle calendar on trigger click
    this.triggerBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggle();
    });

    // Month navigation
    this.prevBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.prevMonth();
    });

    this.nextBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.nextMonth();
    });

    // Jump to today
    this.jumpTodayBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const today = this.getTodayDate();
      const parts = today.split('-');
      this.viewYear = parseInt(parts[0], 10);
      this.viewMonth = parseInt(parts[1], 10) - 1;
      this.onSelectDate(today);
      this.close();
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (!this.isOpen) return;
      if (!this.popoverEl.contains(e.target) && !this.triggerBtn.contains(e.target)) {
        this.close();
      }
    });

    // Keyboard navigation (Escape, arrow keys)
    document.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
        this.triggerBtn.focus();
        return;
      }

      // Arrow navigation within the calendar grid
      if (document.activeElement && this.gridEl.contains(document.activeElement)) {
        this.handleGridKeydown(e);
      }
    });

    // Reposition on window resize
    window.addEventListener('resize', () => {
      if (this.isOpen) this.positionPopover();
    });
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    // Sync view month/year to currently selected date on open
    const selected = this.getSelectedDate() || this.getTodayDate() || new Date().toISOString().split('T')[0];
    const parts = String(selected).split('-');
    if (parts.length === 3) {
      this.viewYear = parseInt(parts[0], 10);
      this.viewMonth = parseInt(parts[1], 10) - 1;
    }

    this.render();
    this.popoverEl.removeAttribute('hidden');
    this.triggerBtn.setAttribute('aria-expanded', 'true');
    this.isOpen = true;
    this.positionPopover();

    // Focus current selected day or today
    setTimeout(() => {
      const activeDay = this.gridEl.querySelector('.cal-day-selected') ||
                        this.gridEl.querySelector('.cal-day-today') ||
                        this.gridEl.querySelector('.cal-day:not([disabled])');
      if (activeDay) activeDay.focus();
    }, 50);
  }

  close() {
    if (!this.isOpen) return;
    this.popoverEl.setAttribute('hidden', '');
    this.triggerBtn.setAttribute('aria-expanded', 'false');
    this.isOpen = false;
  }

  prevMonth() {
    this.viewMonth -= 1;
    if (this.viewMonth < 0) {
      this.viewMonth = 11;
      this.viewYear -= 1;
    }
    this.render();
  }

  nextMonth() {
    this.viewMonth += 1;
    if (this.viewMonth > 11) {
      this.viewMonth = 0;
      this.viewYear += 1;
    }
    this.render();
  }

  positionPopover() {
    if (!this.popoverEl || !this.triggerBtn) return;
    // Center aligned relative to .calendar-wrapper
    this.popoverEl.style.left = '50%';
    this.popoverEl.style.transform = 'translateX(-50%)';

    const rect = this.popoverEl.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const margin = 10;

    if (rect.left < margin) {
      const shift = margin - rect.left;
      this.popoverEl.style.transform = `translateX(calc(-50% + ${shift}px))`;
    } else if (rect.right > viewportWidth - margin) {
      const shift = rect.right - (viewportWidth - margin);
      this.popoverEl.style.transform = `translateX(calc(-50% - ${shift}px))`;
    }
  }

  render() {
    const today = this.getTodayDate();
    const selected = this.getSelectedDate();

    // Update Header
    if (this.monthYearEl) {
      this.monthYearEl.textContent = `${MONTH_NAMES[this.viewMonth]} ${this.viewYear}`;
    }

    // Check min / max bounds for month navigation buttons
    const minParts = this.minDate.split('-');
    const minYear = parseInt(minParts[0], 10);
    const minMonth = parseInt(minParts[1], 10) - 1;

    const isAtMinMonth = (this.viewYear < minYear) || (this.viewYear === minYear && this.viewMonth <= minMonth);
    if (this.prevBtn) {
      this.prevBtn.disabled = isAtMinMonth;
      this.prevBtn.setAttribute('aria-disabled', String(isAtMinMonth));
    }

    // Do not allow navigating past today's month
    const todayParts = today ? today.split('-') : [];
    const todayYear = todayParts.length === 3 ? parseInt(todayParts[0], 10) : new Date().getUTCFullYear();
    const todayMonth = todayParts.length === 3 ? parseInt(todayParts[1], 10) - 1 : new Date().getUTCMonth();
    const isAtMaxMonth = (this.viewYear > todayYear) || (this.viewYear === todayYear && this.viewMonth >= todayMonth);
    if (this.nextBtn) {
      this.nextBtn.disabled = isAtMaxMonth;
      this.nextBtn.setAttribute('aria-disabled', String(isAtMaxMonth));
    }

    // Days in current view month (UTC)
    const firstDayOfWeek = new Date(Date.UTC(this.viewYear, this.viewMonth, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(this.viewYear, this.viewMonth + 1, 0)).getUTCDate();

    this.gridEl.innerHTML = '';

    // Empty lead cells for alignment
    for (let i = 0; i < firstDayOfWeek; i++) {
      const emptyCell = document.createElement('div');
      emptyCell.className = 'cal-cell-empty';
      emptyCell.setAttribute('aria-hidden', 'true');
      this.gridEl.appendChild(emptyCell);
    }

    // Day buttons
    for (let day = 1; day <= daysInMonth; day++) {
      const monthStr = String(this.viewMonth + 1).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      const dateStr = `${this.viewYear}-${monthStr}-${dayStr}`;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cal-day';
      btn.textContent = String(day);
      btn.dataset.date = dateStr;

      const isToday = dateStr === today;
      const isSelected = dateStr === selected;
      
      // An available puzzle is any past date up to and including today
      const isAvailable = dateStr >= this.minDate && dateStr <= today;

      if (isToday) btn.classList.add('cal-day-today');
      if (isSelected) {
        btn.classList.add('cal-day-selected');
        btn.setAttribute('aria-selected', 'true');
      } else {
        btn.setAttribute('aria-selected', 'false');
      }

      if (!isAvailable) {
        btn.classList.add('cal-day-disabled');
        btn.setAttribute('aria-disabled', 'true');
        btn.disabled = true;
        btn.title = dateStr > today ? 'Future puzzle not released yet' : 'No puzzle available';
      }

      const formatted = formatDateDisplay(dateStr);
      btn.setAttribute('aria-label', `${formatted}${isToday ? ' (Today)' : ''}${isSelected ? ' (Selected)' : ''}${!isAvailable ? ' (Unavailable)' : ''}`);

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isAvailable) {
          this.onSelectDate(dateStr);
          this.close();
        } else {
          this.onUnavailableDate(dateStr);
        }
      });

      this.gridEl.appendChild(btn);
    }
  }

  handleGridKeydown(e) {
    const currentBtn = document.activeElement;
    if (!currentBtn || !currentBtn.dataset.date) return;

    let delta = 0;
    if (e.key === 'ArrowLeft') delta = -1;
    else if (e.key === 'ArrowRight') delta = 1;
    else if (e.key === 'ArrowUp') delta = -7;
    else if (e.key === 'ArrowDown') delta = 7;
    else return;

    e.preventDefault();

    const allButtons = Array.from(this.gridEl.querySelectorAll('.cal-day'));
    const currentIndex = allButtons.indexOf(currentBtn);
    const targetIndex = currentIndex + delta;

    if (targetIndex >= 0 && targetIndex < allButtons.length) {
      allButtons[targetIndex].focus();
    } else if (delta < 0) {
      // Navigate to previous month
      this.prevMonth();
      const newButtons = Array.from(this.gridEl.querySelectorAll('.cal-day'));
      if (newButtons.length > 0) newButtons[newButtons.length - 1].focus();
    } else if (delta > 0) {
      // Navigate to next month
      this.nextMonth();
      const newButtons = Array.from(this.gridEl.querySelectorAll('.cal-day'));
      if (newButtons.length > 0) newButtons[0].focus();
    }
  }
}
