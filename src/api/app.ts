import { PrismaClient } from '@prisma/client';
import { Hono } from 'hono';
import { Temporal } from 'temporal-polyfill';
import { z } from 'zod';

import { availableSlots, isOfferable, type AvailabilityInput } from '../core/slots.js';
import { LOCALES, type Locale } from '../i18n/messages.js';

/**
 * A small public API: what can be booked, when, and a booking endpoint.
 * There is no authentication because there is nothing to protect on the
 * read side -- opening hours are public -- and the write side is guarded by
 * validation and a database constraint rather than identity.
 */

export const db = new PrismaClient();

const localeSchema = z.enum(LOCALES);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function localised(value: unknown, locale: Locale): string {
  if (typeof value !== 'object' || value === null) return '';
  const record = value as Record<string, unknown>;
  const chosen = record[locale] ?? record['en'];
  return typeof chosen === 'string' ? chosen : '';
}

/**
 * One instant format everywhere. Slots come from Temporal ("...:00Z");
 * rows come back from Prisma as Date ("...:00.000Z"). A client comparing
 * the two by string -- which the web UI does -- must never see both.
 */
const iso = (date: Date): string => Temporal.Instant.fromEpochMilliseconds(date.getTime()).toString();

/** Six characters, no ambiguous glyphs. Read out over the phone. */
function reference(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

async function loadAvailability(serviceId: string): Promise<Omit<AvailabilityInput, 'date'> | null> {
  const service = await db.service.findFirst({ where: { id: serviceId, active: true }, include: { business: { include: { hours: true } } } });
  if (service === null) return null;

  // Only confirmed bookings block time. A cancelled slot is free again.
  // Each block is extended by the buffer of the service that was booked,
  // so the engine never needs to know which service an appointment was for.
  const bookings = await db.booking.findMany({
    where: { service: { businessId: service.businessId }, status: 'confirmed', endsAt: { gte: new Date() } },
    select: { startsAt: true, endsAt: true, service: { select: { bufferMinutes: true } } },
  });
  const busy = bookings.map((b) => ({ start: iso(b.startsAt), end: iso(new Date(b.endsAt.getTime() + b.service.bufferMinutes * 60_000)) }));

  return {
    timeZone: service.business.timeZone,
    hours: service.business.hours.map((rule) => ({ dayOfWeek: rule.dayOfWeek, opens: rule.opens, closes: rule.closes })),
    service: { id: service.id, durationMinutes: service.durationMinutes, bufferMinutes: service.bufferMinutes },
    busy,
    leadMinutes: service.business.leadMinutes,
  };
}

export function buildApp(): Hono {
  const app = new Hono();

  app.get('/api/health', (c) => c.json({ ok: true }));

  app.get('/api/business', async (c) => {
    const business = await db.business.findFirst({ include: { services: { where: { active: true } } } });
    if (business === null) return c.json({ error: 'Not configured.' }, 404);
    const locale = localeSchema.catch('en').parse(c.req.query('locale'));
    return c.json({
      name: business.name,
      timeZone: business.timeZone,
      currency: business.currency,
      services: business.services.map((service) => ({
        id: service.id,
        name: localised(service.name, locale),
        description: localised(service.description, locale),
        durationMinutes: service.durationMinutes,
        priceMinor: service.priceMinor,
      })),
    });
  });

  /**
   * Which dates in a month have at least one slot. The calendar uses this to
   * mark days as bookable before the customer picks one, which is what lets
   * it say "no appointments available" on a cell instead of making the
   * customer click and find out.
   */
  app.get('/api/services/:id/availability', async (c) => {
    const month = z.string().regex(/^\d{4}-\d{2}$/).safeParse(c.req.query('month'));
    if (!month.success) return c.json({ error: 'month must be YYYY-MM' }, 400);

    const availability = await loadAvailability(c.req.param('id'));
    if (availability === null) return c.json({ error: 'Service not found.' }, 404);

    const first = Temporal.PlainDate.from(`${month.data}-01`);
    const dates: string[] = [];
    for (let day = first; day.month === first.month; day = day.add({ days: 1 })) {
      if (availableSlots({ ...availability, date: day.toString() }).length > 0) dates.push(day.toString());
    }
    return c.json({ timeZone: availability.timeZone, dates });
  });

  app.get('/api/services/:id/slots', async (c) => {
    const date = isoDate.safeParse(c.req.query('date'));
    if (!date.success) return c.json({ error: 'date must be YYYY-MM-DD' }, 400);

    const availability = await loadAvailability(c.req.param('id'));
    if (availability === null) return c.json({ error: 'Service not found.' }, 404);

    return c.json({ timeZone: availability.timeZone, slots: availableSlots({ ...availability, date: date.data }) });
  });

  const bookingSchema = z.object({
    serviceId: z.string().uuid(),
    start: z.string().datetime({ offset: true }),
    locale: localeSchema,
    customer: z.object({
      name: z.string().trim().min(1).max(200),
      email: z.string().trim().email().max(254),
      notes: z.string().trim().max(2000).optional(),
    }),
  });

  app.post('/api/bookings', async (c) => {
    const parsed = bookingSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'invalid', issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) }, 400);
    const body = parsed.data;

    const availability = await loadAvailability(body.serviceId);
    if (availability === null) return c.json({ error: 'Service not found.' }, 404);

    // The client picked from a list the server produced; the server checks
    // the pick against a fresh list anyway. Between the two requests
    // another customer may have taken it, or the client may have been
    // edited. Either way, an instant the business would not offer now is
    // refused before it reaches the database.
    const start = Temporal.Instant.from(body.start);
    const date = start.toZonedDateTimeISO(availability.timeZone).toPlainDate().toString();
    if (!isOfferable({ ...availability, date }, body.start)) return c.json({ error: 'slot_unavailable' }, 409);

    const end = start.add({ minutes: availability.service.durationMinutes });

    try {
      const booking = await db.booking.create({
        data: {
          reference: reference(),
          serviceId: body.serviceId,
          startsAt: new Date(start.epochMilliseconds),
          endsAt: new Date(end.epochMilliseconds),
          customerName: body.customer.name,
          customerEmail: body.customer.email,
          customerNotes: body.customer.notes ?? null,
          locale: body.locale,
        },
      });
      return c.json({ id: booking.id, reference: booking.reference, start: iso(booking.startsAt), end: iso(booking.endsAt) }, 201);
    } catch (error) {
      // Two customers, same slot, same instant: the check above passed for
      // both and the unique constraint decides. The loser gets a 409 and a
      // fresh slot list, not a 500.
      if (error instanceof Error && 'code' in error && error.code === 'P2002') return c.json({ error: 'slot_unavailable' }, 409);
      throw error;
    }
  });

  app.get('/api/bookings/:reference', async (c) => {
    const booking = await db.booking.findUnique({ where: { reference: c.req.param('reference').toUpperCase() }, include: { service: { include: { business: true } } } });
    if (booking === null) return c.json({ error: 'Not found.' }, 404);
    // Deliberately not returning the customer's name or email: the reference
    // is short enough to guess at scale, and it appears on a screen. What it
    // unlocks is the appointment time and the cancel action, not identity.
    return c.json({ reference: booking.reference, status: booking.status, start: iso(booking.startsAt), end: iso(booking.endsAt), timeZone: booking.service.business.timeZone });
  });

  app.post('/api/bookings/:reference/cancel', async (c) => {
    const result = await db.booking.updateMany({ where: { reference: c.req.param('reference').toUpperCase(), status: 'confirmed' }, data: { status: 'cancelled', cancelledAt: new Date() } });
    return result.count === 0 ? c.json({ error: 'Not found or already cancelled.' }, 404) : c.json({ ok: true });
  });

  return app;
}
