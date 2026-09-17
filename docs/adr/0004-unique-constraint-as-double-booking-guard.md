# 4. A unique constraint, not a lock, prevents double booking

Status: accepted — 2026-09-16

## Context

Two customers can submit the same slot within the same second. The API
checks the slot against a freshly computed list before writing, but two
requests can both pass that check. The classic answers are a `SELECT ... FOR
UPDATE` on the service row (serialises every booking for the service), an
advisory lock keyed on the slot, or `SERIALIZABLE` isolation with retry.

## Decision

Rely on a partial unique index:

    @@unique([serviceId, startsAt, status])   -- status = confirmed

Two confirmed bookings cannot share a service and a start instant. The API
still runs the "would we offer this?" check first — it catches the common
case with a clear 409 and never touches the table — and treats Prisma's
`P2002` as the same 409 when the check races.

## Consequences

- No lock, no retry loop, no serialisation of unrelated bookings. Under
  concurrent load exactly one insert wins; the integration test fires six
  simultaneous requests and asserts one 201 and five 409s.
- Cancelled rows do not participate: the tuple includes `status`, so a slot
  that was booked and cancelled can be booked again, and the history of the
  cancelled booking is kept.
- The constraint guards **identical starts**, not overlaps. Two services
  with different durations on the same business calendar could, in theory,
  both pass the availability check for overlapping-but-not-identical
  instants in the same millisecond. The availability check reads all
  confirmed bookings across the business and applies buffers, so the window
  is a single round-trip wide; closing it fully would need an exclusion
  constraint on a `tstzrange` (`EXCLUDE USING gist`), which Prisma cannot
  express in its schema and would live in a hand-written migration. That is
  the documented next step if a deployment's traffic ever makes the window
  matter; for a single practice it does not.
- The bookings→service relation deliberately has no `ON DELETE CASCADE`. A
  service being retired must not erase appointment history; services are
  deactivated (`active = false`), not deleted.
