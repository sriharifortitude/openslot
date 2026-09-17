import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

// A physiotherapy practice in Berlin. Real enough to click through, obviously fictional.
await db.booking.deleteMany();
await db.service.deleteMany();
await db.openingHours.deleteMany();
await db.business.deleteMany();

await db.business.create({
  data: {
    name: 'Physio Mitte',
    timeZone: 'Europe/Berlin',
    currency: 'EUR',
    leadMinutes: 120,
    hours: {
      create: [1, 2, 3, 4, 5].flatMap((day) => [
        { dayOfWeek: day, opens: '08:00', closes: '12:30' },
        { dayOfWeek: day, opens: '13:30', closes: '18:00' },
      ]),
    },
    services: {
      create: [
        { name: { en: 'Initial consultation', de: 'Erstgespräch', fr: 'Première consultation' }, durationMinutes: 45, bufferMinutes: 15, priceMinor: 8500 },
        { name: { en: 'Follow-up session', de: 'Folgebehandlung', fr: 'Séance de suivi' }, durationMinutes: 30, bufferMinutes: 10, priceMinor: 6000 },
        { name: { en: 'Sports massage', de: 'Sportmassage', fr: 'Massage sportif' }, durationMinutes: 60, bufferMinutes: 15, priceMinor: 9500 },
      ],
    },
  },
});

await db.$disconnect();
process.stdout.write('seeded\n');
