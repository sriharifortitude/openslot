import { useId } from 'react';

import { formatTime, t } from '@/i18n/format';
import type { Locale } from '@/i18n/messages';

export interface SlotPickerProps {
  readonly locale: Locale;
  readonly timeZone: string;
  readonly slots: ReadonlyArray<{ start: string; end: string }>;
  readonly selected: string | null;
  readonly onSelect: (start: string) => void;
  readonly loading: boolean;
}

/**
 * Time slots as a radio group rather than a row of buttons. A radio group
 * is what this is -- choose one of several -- and a screen reader announces
 * it as "1 of 12" with the group's label, which a list of buttons does not.
 * Native radios, visually restyled; the keyboard behaviour (arrows move,
 * Space selects) comes for free and cannot be got wrong.
 *
 * The count is announced through a live region when it changes, so someone
 * who cannot see the list update knows the date they just chose has, say,
 * four times available.
 */
export function SlotPicker({ locale, timeZone, slots, selected, onSelect, loading }: SlotPickerProps): React.JSX.Element {
  const legendId = useId();

  return (
    <fieldset className="slots" aria-busy={loading}>
      <legend id={legendId}>{t(locale, 'slots.legend')}</legend>
      <p role="status" className="slots-status">
        {loading ? t(locale, 'slots.loading') : slots.length === 0 ? t(locale, 'slots.none') : t(locale, 'slots.count', { count: slots.length })}
      </p>
      {slots.length > 0 && (
        <div className="slot-list">
          {slots.map((slot) => {
            const id = `slot-${slot.start}`;
            return (
              <div key={slot.start} className="slot">
                <input type="radio" id={id} name="slot" value={slot.start} checked={selected === slot.start} onChange={() => onSelect(slot.start)} />
                <label htmlFor={id}>
                  <time dateTime={slot.start}>{formatTime(locale, slot.start, timeZone)}</time>
                </label>
              </div>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
