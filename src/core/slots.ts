import { Temporal } from 'temporal-polyfill';

/**
 * Slot generation.
 *
 * Every rule about when a business is open is expressed in the business's
 * own time zone, as wall-clock times: "Tuesdays 09:00-17:00". Every slot the
 * customer sees is an instant. The conversion between the two is where
 * booking systems break twice a year, and the reason this module uses
 * Temporal rather than Date arithmetic:
 *
 *   - On the spring-forward day, 02:30 does not exist. A naive "start at
 *     09:00, add 30 minutes repeatedly" is fine; "list every half hour from
 *     midnight" produces a slot nobody can book.
 *   - On the fall-back day, 02:30 exists twice. A slot keyed by wall-clock
 *     time is ambiguous; a slot keyed by instant is not.
 *   - A customer in Lisbon booking a Berlin dentist sees 09:00 as 08:00.
 *     The instant is the same; only the label changes.
 *
 * Temporal.ZonedDateTime carries the zone with the value, so the arithmetic
 * is right by construction and the tests below are checks, not hopes.
 */

export interface OpeningHours {
  /** 1 = Monday ... 7 = Sunday, per ISO 8601 and Temporal.dayOfWeek. */
  readonly dayOfWeek: number;
  /** "09:00" wall-clock in the business zone. */
  readonly opens: string;
  /** "17:00", exclusive. */
  readonly closes: string;
}

export interface Service {
  readonly id: string;
  readonly durationMinutes: number;
  /** Gap after each appointment before the next can start. */
  readonly bufferMinutes: number;
}

export interface Busy {
  /**
   * ISO instant strings, [start, end). `end` is the end of the blocked time,
   * i.e. the appointment plus the buffer of the service that was booked.
   * The buffer belongs to the appointment it follows, not to whatever is
   * asked for next: a massage needs its cleanup time whether the next
   * customer wants a massage or a ten-minute check-up.
   */
  readonly start: string;
  readonly end: string;
}

export interface Slot {
  /** ISO instant, UTC. What the API returns and the database stores. */
  readonly start: string;
  readonly end: string;
}

export interface AvailabilityInput {
  readonly timeZone: string;
  readonly hours: readonly OpeningHours[];
  readonly service: Service;
  /** Existing appointments, as instants. */
  readonly busy: readonly Busy[];
  /** Calendar date in the business zone, "YYYY-MM-DD". */
  readonly date: string;
  /** Slots starting before this instant are not offered. Defaults to now. */
  readonly notBefore?: Temporal.Instant;
  /** Minimum lead time. Defaults to 0. */
  readonly leadMinutes?: number;
  /** Slot start granularity. Defaults to the service duration. */
  readonly stepMinutes?: number;
}

/**
 * Every bookable slot on `date` for `service`, as instants. Empty on a closed
 * day. Slots are offered only when the whole appointment fits inside opening
 * hours and neither it nor its own buffer overlaps a blocked interval.
 */
export function availableSlots(input: AvailabilityInput): Slot[] {
  const zone = input.timeZone;
  const date = Temporal.PlainDate.from(input.date);
  const rules = input.hours.filter((rule) => rule.dayOfWeek === date.dayOfWeek);
  if (rules.length === 0) return [];

  const step = Temporal.Duration.from({ minutes: input.stepMinutes ?? input.service.durationMinutes });
  const length = Temporal.Duration.from({ minutes: input.service.durationMinutes });
  const buffer = Temporal.Duration.from({ minutes: input.service.bufferMinutes });

  const earliest = (input.notBefore ?? Temporal.Now.instant()).add({ minutes: input.leadMinutes ?? 0 });

  const busy = input.busy.map((entry) => ({ start: Temporal.Instant.from(entry.start), end: Temporal.Instant.from(entry.end) }));

  const slots: Slot[] = [];

  for (const rule of rules) {
    // Wall-clock open/close on this calendar date, then resolved to instants.
    // 'compatible' disambiguation is Temporal's default: a time in the
    // fall-back overlap takes the earlier offset, a time in the spring-forward
    // gap moves forward. Both are what a receptionist would do.
    let cursor = date.toZonedDateTime({ timeZone: zone, plainTime: Temporal.PlainTime.from(rule.opens) });
    const closes = date.toZonedDateTime({ timeZone: zone, plainTime: Temporal.PlainTime.from(rule.closes) });

    while (Temporal.ZonedDateTime.compare(cursor.add(length), closes) <= 0) {
      const start = cursor.toInstant();
      const end = cursor.add(length).toInstant();
      // This appointment's own buffer must also be clear before the next one.
      const blockedUntil = end.add(buffer);

      const tooSoon = Temporal.Instant.compare(start, earliest) < 0;
      const overlaps = busy.some((b) => Temporal.Instant.compare(start, b.end) < 0 && Temporal.Instant.compare(blockedUntil, b.start) > 0);

      if (!tooSoon && !overlaps) slots.push({ start: start.toString(), end: end.toString() });

      // Advance in the zone, not in absolute time: 30 minutes of wall clock,
      // which across a DST transition is not 30 minutes of instant.
      cursor = cursor.add(step);
    }
  }

  return slots.sort((a, b) => Temporal.Instant.compare(Temporal.Instant.from(a.start), Temporal.Instant.from(b.start)));
}

/**
 * Whether a proposed appointment is one the business would have offered.
 * The API calls this before writing, so a client that constructs its own
 * instant -- or replays a slot from yesterday's list -- cannot book outside
 * hours or on top of someone else.
 */
export function isOfferable(input: AvailabilityInput, start: string): boolean {
  return availableSlots(input).some((slot) => slot.start === Temporal.Instant.from(start).toString());
}

/** The calendar dates in `zone` covering a range of instants, inclusive. */
export function datesBetween(zone: string, from: string, to: string): string[] {
  let cursor = Temporal.Instant.from(from).toZonedDateTimeISO(zone).toPlainDate();
  const last = Temporal.Instant.from(to).toZonedDateTimeISO(zone).toPlainDate();
  const dates: string[] = [];
  while (Temporal.PlainDate.compare(cursor, last) <= 0) {
    dates.push(cursor.toString());
    cursor = cursor.add({ days: 1 });
  }
  return dates;
}
