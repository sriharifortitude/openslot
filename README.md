# openslot

An appointment-booking page for a single practice or studio, built so that
it can be bought by a European business after June 2025 — which means it
has to be usable with a keyboard and a screen reader, read correctly in
the customer's language, and never produce a slot that does not exist on
the day the clocks change.

It is the size of thing a physiotherapist, a hairdresser or a tax adviser
actually needs: one business, a few services, opening hours, a calendar,
a form. What makes it worth reading is what happens underneath: the slot
engine, the accessibility work, and the double-booking guard.

## What it does

- Publishes services with durations, prices and per-service buffers, and
  the business's opening hours (several blocks a day, per weekday).
- Computes bookable slots for any date in the business's time zone, with
  lead time, existing appointments and their buffers taken into account.
  Slots are computed in wall-clock time and only then resolved to
  instants, so DST transitions produce exactly the slots a receptionist
  would offer. Tested on both the spring-forward gap and the fall-back
  overlap.
- A booking page in English, German and French — chosen by the browser's
  language, switchable — with dates, times, currency and plural forms
  formatted by `Intl` for each locale. English means British conventions
  (day-first, 24-hour), not US.
- A calendar that follows the WAI-ARIA date-picker grid pattern: one tab
  stop, arrow keys by day and week, Home/End, PageUp/PageDown, unavailable
  days announced as such. Slots and services are native radio groups.
  Forms validate on submit with an error summary that links to each field.
- A booking reference the customer can read out over the phone, a lookup
  endpoint that returns the appointment without the customer's personal
  data, and a cancel endpoint.
- Double bookings are prevented by a partial unique index, not a lock; the
  loser of a race gets a 409 and a fresh slot list.

## Running it

    docker compose up -d --wait        # Postgres 17 on 127.0.0.1:5435
    cp .env.example .env
    npm install
    npx prisma migrate deploy
    npm run db:seed                    # "Physio Mitte", Berlin, three services
    npm run dev:api                    # API on :4100
    npm run dev:web                    # Vite on :5173, proxies /api

For a production build, `npm run build` produces `dist/api` and `dist/web`;
`node dist/api/api/server.js` serves both from one port.

## Checks

    npm run typecheck
    npm run lint                       # typescript-eslint strict + jsx-a11y strict
    npm test                           # slot engine, hand-computed expectations
    npm run test:a11y                  # axe-core + keyboard tests in jsdom
    npm run test:integration           # API against the real database

The accessibility suite is described in [ACCESSIBILITY.md](ACCESSIBILITY.md),
which also lists — as carefully as the passing checks — what has **not**
been verified. Automated tests catch structural defects; they do not
replace a screen-reader walk-through, and this repository does not claim
one.

## Design notes

The decisions that shaped the code are in `docs/adr/`:

1. [Temporal for slot arithmetic](docs/adr/0001-temporal-for-slot-arithmetic.md)
   — wall-clock arithmetic in the business zone, at the cost of a 200 kB
   polyfill until browsers ship it natively.
2. [Intl and a typed message table, no i18n framework](docs/adr/0002-intl-without-an-i18n-framework.md)
   — a missing translation is a compile error.
3. [Native radio groups; a custom grid only for the calendar](docs/adr/0003-native-form-controls-for-selection.md)
   — two of three selection controls have no bespoke keyboard code.
4. [A unique constraint as the double-booking guard](docs/adr/0004-unique-constraint-as-double-booking-guard.md)
   — including the overlap case it does not cover and what would.

## What it deliberately does not do

- **No admin UI.** Services and hours are seeded or edited in the database.
  For a single practice that is set once and left; an admin screen is the
  obvious next feature and would need the auth this repository lacks.
- **No email.** The confirmation page shows the reference and tells the
  customer to keep it; nothing is sent. A sender would be a queue consumer
  fed from the bookings table, not a change to the API.
- **No multi-tenancy.** One business per deployment. Services and hours
  carry a `businessId` so the model can grow, but nothing enforces
  isolation and `GET /api/business` returns the first row.
- **No rate limiting.** `POST /api/bookings` and the reference lookup and
  cancel routes need it; the reference is drawn from the CSPRNG with about
  2^40 possibilities, which resists guessing but not indefinitely. A
  reverse proxy's job in deployment; noted so it is not forgotten.
- **Overlapping-but-not-identical starts** across services in the same
  millisecond are not caught by the unique index. ADR 4 explains the
  window and the `EXCLUDE` constraint that would close it.

## Licence

Business Source License 1.1. Free for evaluation, development and
non-commercial use; production use needs a commercial licence. Converts to
Apache 2.0 on 2030-09-17. See [LICENSE](LICENSE).
