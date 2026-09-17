# 1. Temporal for slot arithmetic, not Date or a date library

Status: accepted — 2026-09-15

## Context

The slot engine turns a business's opening hours ("Mon–Fri 08:00–12:30 and
13:30–18:00, Europe/Berlin") into bookable instants for a calendar date. The
wall-clock times are what the business thinks in; the instants are what gets
stored and compared. The conversion crosses a DST boundary twice a year, and
that is exactly where booking systems produce a slot at 02:30 that does not
exist, or two slots with the same wall-clock time.

The options were the built-in `Date` (with manual offset handling), a library
(date-fns-tz, Luxon, dayjs+timezone), or the TC39 `Temporal` proposal via a
polyfill.

## Decision

Use `Temporal` through `temporal-polyfill`. All wall-clock arithmetic is done
on a `ZonedDateTime` in the business zone; instants are produced at the
boundary and stored as ISO strings.

## Consequences

- Advancing the cursor by `{ minutes: 30 }` on a `ZonedDateTime` is
  wall-clock arithmetic: across the fall-back hour it produces two distinct
  instants for the same local time, which the tests pin (six slots between
  23:30Z and 02:00Z on 2026-10-25). Across spring-forward, times in the gap
  are shifted forward by the `compatible` disambiguation, which is what a
  receptionist would do.
- No custom offset code exists to get wrong. `Date` was rejected because its
  timezone handling is the host's, not the business's; date-fns-tz was a
  close second but its DST-gap behaviour is a footnote rather than a
  first-class concept.
- The polyfill costs roughly 200 kB uncompressed in the browser bundle
  (about a third of the total). That is the price of correctness here; when
  browsers ship `Temporal` natively the import becomes a no-op.
- `Temporal` is Stage 3. The API surface used here (`PlainDate`,
  `ZonedDateTime`, `Instant`, `Duration`) has been stable since 2023 and is
  what Firefox ships; the risk of a breaking change before native adoption
  is low and confined to one module.
