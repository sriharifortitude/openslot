import { Temporal } from 'temporal-polyfill';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp, db } from '@/api/app';

/**
 * Runs against the real database. Each test creates its own business so
 * nothing depends on the seed or on test order.
 */

const app = buildApp();
const json = async <T>(response: Response): Promise<T> => (await response.json()) as T;

let serviceId: string;
let businessId: string;

/** A weekday at least two days out, so lead time never interferes. */
function nextWeekday(): Temporal.PlainDate {
  let day = Temporal.Now.plainDateISO('Europe/Berlin').add({ days: 2 });
  while (day.dayOfWeek > 5) day = day.add({ days: 1 });
  return day;
}

beforeAll(async () => {
  const business = await db.business.create({
    data: {
      name: 'Test Practice',
      timeZone: 'Europe/Berlin',
      currency: 'EUR',
      leadMinutes: 60,
      hours: { create: [1, 2, 3, 4, 5].map((dayOfWeek) => ({ dayOfWeek, opens: '09:00', closes: '11:00' })) },
      services: { create: { name: { en: 'Check-up' }, description: {}, durationMinutes: 30, bufferMinutes: 0, priceMinor: 4000 } },
    },
    include: { services: true },
  });
  businessId = business.id;
  serviceId = business.services[0]!.id;
});

afterAll(async () => {
  // Bookings do not cascade from services on purpose (see schema); clean up by hand.
  await db.booking.deleteMany({ where: { serviceId } });
  await db.business.delete({ where: { id: businessId } });
  await db.$disconnect();
});

describe('GET /api/services/:id/slots', () => {
  it('lists slots in the business zone and hides slots taken by confirmed bookings', async () => {
    const date = nextWeekday().toString();
    const before = await json<{ slots: Array<{ start: string }> }>(await app.request(`/api/services/${serviceId}/slots?date=${date}`));
    expect(before.slots).toHaveLength(4); // 09:00 09:30 10:00 10:30

    const first = before.slots[0]!.start;
    const created = await app.request('/api/bookings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ serviceId, start: first, locale: 'de', customer: { name: 'Max Mustermann', email: 'max@example.org' } }),
    });
    expect(created.status).toBe(201);

    const after = await json<{ slots: Array<{ start: string }> }>(await app.request(`/api/services/${serviceId}/slots?date=${date}`));
    expect(after.slots.map((s) => s.start)).toEqual(before.slots.slice(1).map((s) => s.start));
  });

  it('rejects a malformed date and an unknown service', async () => {
    expect((await app.request(`/api/services/${serviceId}/slots?date=2026-1-1`)).status).toBe(400);
    expect((await app.request(`/api/services/00000000-0000-0000-0000-000000000000/slots?date=2026-10-05`)).status).toBe(404);
  });
});

describe('POST /api/bookings', () => {
  it('refuses an instant the business would not offer, even if well-formed', async () => {
    const date = nextWeekday().toString();
    const outsideHours = Temporal.PlainDate.from(date).toZonedDateTime({ timeZone: 'Europe/Berlin', plainTime: '14:00' }).toInstant().toString();
    const response = await app.request('/api/bookings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ serviceId, start: outsideHours, locale: 'en', customer: { name: 'A', email: 'a@example.org' } }),
    });
    expect(response.status).toBe(409);
    expect(await json<{ error: string }>(response)).toEqual({ error: 'slot_unavailable' });
  });

  it('lets exactly one of two concurrent bookings for the same slot through', async () => {
    const date = nextWeekday().add({ days: 1 }).toString();
    if (Temporal.PlainDate.from(date).dayOfWeek > 5) return; // Friday + 1 is not a working day; skip rather than fake it.
    const { slots } = await json<{ slots: Array<{ start: string }> }>(await app.request(`/api/services/${serviceId}/slots?date=${date}`));
    const start = slots[1]!.start;
    const attempt = async (): Promise<Response> =>
      app.request('/api/bookings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ serviceId, start, locale: 'fr', customer: { name: 'B', email: 'b@example.org' } }),
      });
    const results = await Promise.all(Array.from({ length: 6 }, attempt));
    const statuses = results.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(5);
  });

  it('validates the body and reports paths', async () => {
    const response = await app.request('/api/bookings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ serviceId, start: 'tomorrow', locale: 'xx', customer: { name: '', email: 'nope' } }),
    });
    expect(response.status).toBe(400);
    const body = await json<{ issues: string[] }>(response);
    expect(body.issues.join('\n')).toMatch(/start/);
    expect(body.issues.join('\n')).toMatch(/locale/);
    expect(body.issues.join('\n')).toMatch(/customer\.email/);
  });
});

describe('GET /api/bookings/:reference and cancel', () => {
  it('returns the appointment without personal data, and cancelling frees the slot', async () => {
    const date = nextWeekday().toString();
    const { slots } = await json<{ slots: Array<{ start: string }> }>(await app.request(`/api/services/${serviceId}/slots?date=${date}`));
    const start = slots[slots.length - 1]!.start;
    const created = await json<{ reference: string }>(
      await app.request('/api/bookings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ serviceId, start, locale: 'en', customer: { name: 'Private Person', email: 'private@example.org', notes: 'secret' } }),
      }),
    );

    const lookup = await json<Record<string, unknown>>(await app.request(`/api/bookings/${created.reference.toLowerCase()}`));
    expect(lookup).toMatchObject({ reference: created.reference, status: 'confirmed', start, timeZone: 'Europe/Berlin' });
    expect(JSON.stringify(lookup)).not.toMatch(/Private Person|private@example|secret/);

    expect((await app.request(`/api/bookings/${created.reference}/cancel`, { method: 'POST' })).status).toBe(200);
    expect((await app.request(`/api/bookings/${created.reference}/cancel`, { method: 'POST' })).status).toBe(404);

    const after = await json<{ slots: Array<{ start: string }> }>(await app.request(`/api/services/${serviceId}/slots?date=${date}`));
    expect(after.slots.map((s) => s.start)).toContain(start);
  });
});
