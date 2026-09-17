import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';

import { availableSlots, datesBetween, isOfferable, type AvailabilityInput } from '@/core/slots';

/**
 * Expected instants are written out by hand from the rule and the zone's
 * offset on that date, then compared to the output. Where DST is involved
 * the offset is stated in the test so a reader can check the arithmetic.
 */

const berlin: Omit<AvailabilityInput, 'date'> = {
  timeZone: 'Europe/Berlin',
  // Tuesday 09:00-12:00 and 13:00-17:00 -- a lunch break expressed as two rules.
  hours: [
    { dayOfWeek: 2, opens: '09:00', closes: '12:00' },
    { dayOfWeek: 2, opens: '13:00', closes: '17:00' },
  ],
  service: { id: 'consult', durationMinutes: 30, bufferMinutes: 0 },
  busy: [],
  notBefore: Temporal.Instant.from('2026-01-01T00:00:00Z'),
};

function starts(input: AvailabilityInput): string[] {
  return availableSlots(input).map((slot) => slot.start);
}

describe('availableSlots on an ordinary day', () => {
  // 2026-01-13 is a Tuesday; Berlin is UTC+1 in January.
  const tuesday = { ...berlin, date: '2026-01-13' };

  it('offers every 30-minute slot inside opening hours, in UTC', () => {
    const result = starts(tuesday);
    expect(result[0]).toBe('2026-01-13T08:00:00Z'); // 09:00 CET
    expect(result[5]).toBe('2026-01-13T10:30:00Z'); // 11:30 CET, last before lunch
    expect(result[6]).toBe('2026-01-13T12:00:00Z'); // 13:00 CET
    expect(result.at(-1)).toBe('2026-01-13T15:30:00Z'); // 16:30 CET, ends 17:00
    expect(result).toHaveLength(6 + 8);
  });

  it('does not offer a slot that would end after closing', () => {
    // 45-minute service: 11:15 would end 12:00 (ok); 11:30 would end 12:15 (not ok).
    const result = starts({ ...tuesday, service: { ...tuesday.service, durationMinutes: 45 }, stepMinutes: 15 });
    expect(result).toContain('2026-01-13T10:15:00Z');
    expect(result).not.toContain('2026-01-13T10:30:00Z');
  });

  it('returns nothing on a closed day', () => {
    expect(starts({ ...berlin, date: '2026-01-14' })).toEqual([]); // Wednesday
  });

  it('excludes slots that overlap an existing appointment', () => {
    const result = starts({ ...tuesday, busy: [{ start: '2026-01-13T09:00:00Z', end: '2026-01-13T09:30:00Z' }] });
    expect(result).not.toContain('2026-01-13T09:00:00Z');
    expect(result).toContain('2026-01-13T08:30:00Z');
    expect(result).toContain('2026-01-13T09:30:00Z');
  });

  it("treats a busy block as already including the booked appointment's buffer", () => {
    const result = starts({
      ...tuesday,
      stepMinutes: 15,
      // A 30-minute appointment at 09:00Z whose service carries a 15-minute buffer: blocked until 09:45Z.
      busy: [{ start: '2026-01-13T09:00:00Z', end: '2026-01-13T09:45:00Z' }],
    });
    expect(result).not.toContain('2026-01-13T09:30:00Z');
    expect(result).toContain('2026-01-13T09:45:00Z');
  });

  it("keeps the new appointment's own buffer clear before the next busy block", () => {
    const result = starts({
      ...tuesday,
      service: { ...tuesday.service, bufferMinutes: 15 },
      stepMinutes: 15,
      busy: [{ start: '2026-01-13T10:00:00Z', end: '2026-01-13T10:30:00Z' }],
    });
    // 09:15Z-09:45Z plus buffer to 10:00Z fits; 09:30Z-10:00Z plus buffer to 10:15Z does not.
    expect(result).toContain('2026-01-13T09:15:00Z');
    expect(result).not.toContain('2026-01-13T09:30:00Z');
    expect(result).not.toContain('2026-01-13T09:45:00Z');
  });

  it('does not offer slots in the past or inside the lead time', () => {
    const result = starts({ ...tuesday, notBefore: Temporal.Instant.from('2026-01-13T09:10:00Z'), leadMinutes: 60 });
    // Earliest is 10:10Z; first slot at or after that is 10:30Z.
    expect(result[0]).toBe('2026-01-13T10:30:00Z');
  });
});

describe('availableSlots across daylight-saving transitions', () => {
  /**
   * 2026-03-29 is the spring-forward Sunday in the EU: 02:00 CET becomes
   * 03:00 CEST. Berlin goes from UTC+1 to UTC+2. A business open 09:00-11:00
   * that day has its 09:00 at 07:00Z, not 08:00Z.
   */
  it('uses the post-transition offset on the spring-forward day', () => {
    const result = starts({
      ...berlin,
      hours: [{ dayOfWeek: 7, opens: '09:00', closes: '11:00' }],
      date: '2026-03-29',
    });
    expect(result).toEqual(['2026-03-29T07:00:00Z', '2026-03-29T07:30:00Z', '2026-03-29T08:00:00Z', '2026-03-29T08:30:00Z']);
  });

  /**
   * Opening hours that straddle the gap. 01:30-03:30 wall clock on the
   * spring-forward day is only one real hour: 01:30 CET (00:30Z) to 03:30
   * CEST (01:30Z). Two 30-minute slots, not four. A Date-based loop that
   * adds 30 minutes of wall-clock time would produce the phantom 02:00 and
   * 02:30.
   */
  it('does not offer slots inside the spring-forward gap', () => {
    const result = starts({
      ...berlin,
      hours: [{ dayOfWeek: 7, opens: '01:30', closes: '03:30' }],
      date: '2026-03-29',
    });
    expect(result).toEqual(['2026-03-29T00:30:00Z', '2026-03-29T01:00:00Z']);
  });

  /**
   * 2026-10-25 is the fall-back Sunday: 03:00 CEST becomes 02:00 CET, so
   * 02:00-03:00 wall clock happens twice. Opening 01:30-03:30 spans three
   * real hours. Every instant in the overlap is offered exactly once, with
   * no duplicate wall-clock labels colliding on the same instant.
   */
  it('offers each instant once through the fall-back overlap', () => {
    const result = starts({
      ...berlin,
      hours: [{ dayOfWeek: 7, opens: '01:30', closes: '03:30' }],
      date: '2026-10-25',
    });
    expect(new Set(result).size).toBe(result.length);
    // 01:30 CEST = 23:30Z previous day; 03:30 CET = 02:30Z. Three hours, six slots.
    expect(result[0]).toBe('2026-10-24T23:30:00Z');
    expect(result.at(-1)).toBe('2026-10-25T02:00:00Z');
    expect(result).toHaveLength(6);
  });

  it('keeps the same wall-clock hours in a zone without DST', () => {
    const result = starts({
      ...berlin,
      timeZone: 'Asia/Kolkata',
      hours: [{ dayOfWeek: 7, opens: '09:00', closes: '10:00' }],
      date: '2026-03-29',
    });
    expect(result).toEqual(['2026-03-29T03:30:00Z', '2026-03-29T04:00:00Z']); // UTC+5:30, no change
  });
});

describe('isOfferable', () => {
  const tuesday = { ...berlin, date: '2026-01-13' };

  it('accepts a slot the business offers', () => {
    expect(isOfferable(tuesday, '2026-01-13T08:00:00Z')).toBe(true);
  });

  it('rejects an instant outside hours, off-grid, or during lunch', () => {
    expect(isOfferable(tuesday, '2026-01-13T07:00:00Z')).toBe(false); // 08:00 CET, before opening
    expect(isOfferable(tuesday, '2026-01-13T08:10:00Z')).toBe(false); // not on a 30-minute boundary
    expect(isOfferable(tuesday, '2026-01-13T11:00:00Z')).toBe(false); // 12:00 CET, lunch
  });

  it('normalises the instant before comparing', () => {
    expect(isOfferable(tuesday, '2026-01-13T09:00:00+01:00')).toBe(true);
  });
});

describe('datesBetween', () => {
  it('lists the calendar dates in the zone, inclusive, across a month boundary', () => {
    expect(datesBetween('Europe/Berlin', '2026-01-30T23:30:00Z', '2026-02-01T10:00:00Z')).toEqual([
      '2026-01-31', // 23:30Z on the 30th is already 00:30 on the 31st in Berlin
      '2026-02-01',
    ]);
  });
});
