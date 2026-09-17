import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Temporal } from 'temporal-polyfill';

import { formatDayOfMonth, formatFullDate, formatMonthYear, t, weekdayNames } from '@/i18n/format';
import type { Locale } from '@/i18n/messages';

/**
 * A month calendar implementing the WAI-ARIA date-picker grid pattern.
 *
 * The rules that make it usable without a mouse, all of which are tested:
 *
 *   - It is a real <table> with role="grid": screen readers announce row and
 *     column position, and the weekday header is associated with each cell.
 *   - One cell is in the tab order at a time (roving tabindex). Tab enters
 *     the grid on the selected or first available day; Tab again leaves it.
 *     Thirty-one tab stops would be a hostile control.
 *   - Arrow keys move by day and week, Home/End to the row's ends, PageUp
 *     and PageDown by month. Focus follows, so a screen reader announces the
 *     day it lands on.
 *   - Days with no availability are real buttons with aria-disabled, not
 *     removed from the DOM: they stay navigable so the grid shape is stable,
 *     and the accessible name says why they cannot be chosen.
 *   - The selected day carries aria-selected, and today carries an
 *     aria-label suffix rather than colour alone.
 */

export interface CalendarProps {
  readonly locale: Locale;
  /** "YYYY-MM" of the visible month. */
  readonly month: string;
  readonly onMonthChange: (month: string) => void;
  /** ISO dates in the visible month that have availability. */
  readonly availableDates: ReadonlySet<string>;
  readonly selected: string | null;
  readonly onSelect: (isoDate: string) => void;
  readonly today: string;
  readonly loading?: boolean;
}

export function Calendar({ locale, month, onMonthChange, availableDates, selected, onSelect, today, loading = false }: CalendarProps): React.JSX.Element {
  const first = Temporal.PlainDate.from(`${month}-01`);
  const daysInMonth = first.daysInMonth;
  const leadingBlanks = first.dayOfWeek - 1; // Monday-first grid
  const names = weekdayNames(locale);
  const labelId = useId();
  const instructionsId = useId();

  const [focused, setFocused] = useState<string>(() => selected ?? firstAvailable(month, availableDates) ?? first.toString());
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());

  // When the month changes the focused day may no longer be visible; move
  // it to the same day-of-month, clamped, so PageUp/PageDown feel continuous.
  useEffect(() => {
    if (!focused.startsWith(month)) {
      const day = Math.min(Number(focused.slice(8)), daysInMonth);
      setFocused(`${month}-${String(day).padStart(2, '0')}`);
    }
  }, [month, focused, daysInMonth]);

  const moveFocus = (target: Temporal.PlainDate): void => {
    const iso = target.toString();
    if (!iso.startsWith(month)) onMonthChange(iso.slice(0, 7));
    setFocused(iso);
    // Focus after render so the button exists.
    queueMicrotask(() => cellRefs.current.get(iso)?.focus());
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTableElement>): void => {
    const current = Temporal.PlainDate.from(focused);
    const handlers: Record<string, () => Temporal.PlainDate> = {
      ArrowRight: () => current.add({ days: 1 }),
      ArrowLeft: () => current.subtract({ days: 1 }),
      ArrowDown: () => current.add({ weeks: 1 }),
      ArrowUp: () => current.subtract({ weeks: 1 }),
      Home: () => current.subtract({ days: current.dayOfWeek - 1 }),
      End: () => current.add({ days: 7 - current.dayOfWeek }),
      PageDown: () => current.add({ months: 1 }),
      PageUp: () => current.subtract({ months: 1 }),
    };
    const handler = handlers[event.key];
    if (handler === undefined) return;
    event.preventDefault();
    moveFocus(handler());
  };

  const cells: Array<string | null> = [...Array<null>(leadingBlanks).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: Array<Array<string | null>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div className="calendar">
      <div className="calendar-header">
        <button type="button" className="icon-button" onClick={() => onMonthChange(first.subtract({ months: 1 }).toString().slice(0, 7))} aria-label={t(locale, 'calendar.previousMonth')}>
          <span aria-hidden="true">‹</span>
        </button>
        <h3 id={labelId} aria-live="polite">
          {formatMonthYear(locale, `${month}-01`)}
        </h3>
        <button type="button" className="icon-button" onClick={() => onMonthChange(first.add({ months: 1 }).toString().slice(0, 7))} aria-label={t(locale, 'calendar.nextMonth')}>
          <span aria-hidden="true">›</span>
        </button>
      </div>
      <p id={instructionsId} className="visually-hidden">
        {t(locale, 'calendar.instructions')}
      </p>

      {/* The APG date-picker pattern is a <table role="grid">: the table gives
          screen readers row/column semantics for free and the grid role adds
          the single-tab-stop keyboard contract. jsx-a11y flags the combination
          as a matter of policy; here it is the documented pattern. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role */}
      <table role="grid" aria-labelledby={labelId} aria-describedby={instructionsId} aria-busy={loading} onKeyDown={onKeyDown} className="calendar-grid">
        <thead>
          <tr>
            {names.short.map((short, index) => (
              <th key={short} scope="col" abbr={names.long[index]}>
                <span aria-hidden="true">{short}</span>
                <span className="visually-hidden">{names.long[index]}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, weekIndex) => (
            <tr key={weekIndex}>
              {week.map((iso, dayIndex) =>
                iso === null ? (
                  <td key={`blank-${weekIndex}-${dayIndex}`} aria-hidden="true" />
                ) : (
                  <td key={iso} role="gridcell" aria-selected={selected === iso}>
                    <DayButton
                      ref={(el) => {
                        if (el) cellRefs.current.set(iso, el);
                        else cellRefs.current.delete(iso);
                      }}
                      locale={locale}
                      iso={iso}
                      available={availableDates.has(iso)}
                      isToday={iso === today}
                      isSelected={selected === iso}
                      tabbable={focused === iso}
                      onFocus={() => setFocused(iso)}
                      onSelect={() => onSelect(iso)}
                    />
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface DayButtonProps {
  readonly locale: Locale;
  readonly iso: string;
  readonly available: boolean;
  readonly isToday: boolean;
  readonly isSelected: boolean;
  readonly tabbable: boolean;
  readonly onFocus: () => void;
  readonly onSelect: () => void;
  readonly ref: (el: HTMLButtonElement | null) => void;
}

function DayButton({ locale, iso, available, isToday, isSelected, tabbable, onFocus, onSelect, ref }: DayButtonProps): React.JSX.Element {
  const label = [formatFullDate(locale, iso), isToday ? t(locale, 'calendar.today') : null, isSelected ? t(locale, 'calendar.selected') : null, available ? null : t(locale, 'calendar.unavailable')]
    .filter((part) => part !== null)
    .join(', ');

  return (
    <button
      ref={ref}
      type="button"
      className={['day', available ? 'day-available' : 'day-unavailable', isToday ? 'day-today' : '', isSelected ? 'day-selected' : ''].join(' ').trim()}
      tabIndex={tabbable ? 0 : -1}
      aria-label={label}
      aria-disabled={!available}
      aria-current={isToday ? 'date' : undefined}
      onFocus={onFocus}
      onClick={() => {
        if (available) onSelect();
      }}
    >
      <span aria-hidden="true">{formatDayOfMonth(locale, iso)}</span>
    </button>
  );
}

function firstAvailable(month: string, available: ReadonlySet<string>): string | undefined {
  return [...available].filter((d) => d.startsWith(month)).sort()[0];
}
