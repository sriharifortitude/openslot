import { MESSAGES, type Locale, type MessageKey } from './messages.js';

/**
 * Message formatting: `{name}` substitution and a deliberately small subset
 * of ICU plural syntax -- `{count, plural, one {...} other {...}}` -- backed
 * by Intl.PluralRules so the category choice is the runtime's, not a
 * hand-written rule that is wrong for French (where 0 is singular).
 */
/**
 * The message locale is a two-letter key; the Intl locale is a full tag.
 * Bare "en" resolves to en-US in every engine, which gives a European
 * customer "10/5/2026" and "9:00 AM". This product ships to Europe, so
 * English means British conventions: day-first dates and 24-hour times.
 */
const INTL: Record<Locale, string> = { en: 'en-GB', de: 'de-DE', fr: 'fr-FR' };

export function t(locale: Locale, key: MessageKey, values: Readonly<Record<string, string | number>> = {}): string {
  const template = MESSAGES[locale][key];
  return template
    .replace(/\{(\w+),\s*plural,\s*((?:\w+\s*\{[^}]*\}\s*)+)\}/g, (_match, name: string, forms: string) => {
      const count = Number(values[name] ?? 0);
      const category = new Intl.PluralRules(INTL[locale]).select(count);
      const options = new Map<string, string>();
      for (const [, cat, text] of forms.matchAll(/(\w+)\s*\{([^}]*)\}/g)) options.set(cat!, text!);
      const chosen = options.get(category) ?? options.get('other') ?? '';
      return chosen.replace('#', new Intl.NumberFormat(INTL[locale]).format(count));
    })
    .replace(/\{(\w+)\}/g, (_match, name: string) => {
      const value = values[name];
      return value === undefined ? `{${name}}` : String(value);
    });
}

/**
 * Dates and times are formatted for the customer's locale in the business's
 * zone. The zone is the business's on purpose: a Lisbon customer booking a
 * Berlin dentist needs to arrive at 09:00 Berlin time, and showing them 08:00
 * without saying which zone is how people miss appointments. The zone note
 * in the UI says which it is.
 */
export function formatDate(locale: Locale, instant: string, timeZone: string): string {
  return new Intl.DateTimeFormat(INTL[locale], { dateStyle: 'full', timeZone }).format(new Date(instant));
}

export function formatTime(locale: Locale, instant: string, timeZone: string): string {
  return new Intl.DateTimeFormat(INTL[locale], { timeStyle: 'short', timeZone }).format(new Date(instant));
}

export function formatDayOfMonth(locale: Locale, isoDate: string): string {
  return new Intl.DateTimeFormat(INTL[locale], { day: 'numeric', timeZone: 'UTC' }).format(new Date(`${isoDate}T00:00:00Z`));
}

export function formatMonthYear(locale: Locale, isoDate: string): string {
  return new Intl.DateTimeFormat(INTL[locale], { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${isoDate}T00:00:00Z`));
}

/** Accessible name for a calendar cell: "Tuesday 13 January 2026". */
export function formatFullDate(locale: Locale, isoDate: string): string {
  return new Intl.DateTimeFormat(INTL[locale], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${isoDate}T00:00:00Z`));
}

export function weekdayNames(locale: Locale): { long: string[]; short: string[] } {
  // 2024-01-01 is a Monday; ISO weeks start Monday.
  const days = Array.from({ length: 7 }, (_, index) => new Date(Date.UTC(2024, 0, 1 + index)));
  return {
    long: days.map((day) => new Intl.DateTimeFormat(INTL[locale], { weekday: 'long', timeZone: 'UTC' }).format(day)),
    short: days.map((day) => new Intl.DateTimeFormat(INTL[locale], { weekday: 'short', timeZone: 'UTC' }).format(day)),
  };
}

export function formatMoney(locale: Locale, amountMinor: number, currency: string): string {
  return new Intl.NumberFormat(INTL[locale], { style: 'currency', currency }).format(amountMinor / 100);
}

/** A human label for an IANA zone in the locale, e.g. "Mitteleuropäische Zeit". */
export function zoneLabel(locale: Locale, timeZone: string): string {
  const parts = new Intl.DateTimeFormat(INTL[locale], { timeZone, timeZoneName: 'long' }).formatToParts(new Date());
  return parts.find((part) => part.type === 'timeZoneName')?.value ?? timeZone;
}
