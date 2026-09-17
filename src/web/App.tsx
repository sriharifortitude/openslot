import { useEffect, useId, useState } from 'react';
import { Temporal } from 'temporal-polyfill';

import { formatDate, formatMoney, formatTime, t, zoneLabel } from '@/i18n/format';
import { LOCALES, type Locale } from '@/i18n/messages';
import { BookingForm } from './components/BookingForm';
import { Calendar } from './components/Calendar';
import { SlotPicker } from './components/SlotPicker';

interface Business {
  name: string;
  timeZone: string;
  currency: string;
  services: Array<{ id: string; name: string; description: string; durationMinutes: number; priceMinor: number }>;
}
interface Slot {
  start: string;
  end: string;
}
interface Confirmation {
  reference: string;
  start: string;
}

const LOCALE_NAMES: Record<Locale, string> = { en: 'English', de: 'Deutsch', fr: 'Français' };

function detectLocale(): Locale {
  const stored = localStorage.getItem('locale');
  if (stored !== null && (LOCALES as readonly string[]).includes(stored)) return stored as Locale;
  const preferred = navigator.language.slice(0, 2);
  return (LOCALES as readonly string[]).includes(preferred) ? (preferred as Locale) : 'en';
}

export function App(): React.JSX.Element {
  const [locale, setLocale] = useState<Locale>(detectLocale);
  const [business, setBusiness] = useState<Business | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [month, setMonth] = useState(() => Temporal.Now.plainDateISO().toString().slice(0, 7));
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [start, setStart] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<'taken' | 'generic' | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const serviceLegendId = useId();

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = t(locale, 'app.title');
    localStorage.setItem('locale', locale);
  }, [locale]);

  useEffect(() => {
    void fetch(`/api/business?locale=${locale}`)
      .then((r) => r.json() as Promise<Business>)
      .then(setBusiness);
  }, [locale]);

  useEffect(() => {
    if (serviceId === null) return;
    void fetch(`/api/services/${serviceId}/availability?month=${month}`)
      .then((r) => r.json() as Promise<{ dates: string[] }>)
      .then((data) => setAvailableDates(new Set(data.dates)));
  }, [serviceId, month]);

  useEffect(() => {
    if (serviceId === null || date === null) return;
    setSlotsLoading(true);
    setStart(null);
    void fetch(`/api/services/${serviceId}/slots?date=${date}`)
      .then((r) => r.json() as Promise<{ slots: Slot[] }>)
      .then((data) => setSlots(data.slots))
      .finally(() => setSlotsLoading(false));
  }, [serviceId, date]);

  const today = Temporal.Now.plainDateISO(business?.timeZone ?? 'UTC').toString();
  const service = business?.services.find((s) => s.id === serviceId) ?? null;

  const book = async (customer: { name: string; email: string; notes?: string }): Promise<void> => {
    if (serviceId === null || start === null) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ serviceId, start, locale, customer }),
      });
      if (response.status === 201) {
        const data = (await response.json()) as { reference: string; start: string };
        setConfirmation({ reference: data.reference, start: data.start });
      } else if (response.status === 409) {
        setServerError('taken');
        // The slot they chose is gone; drop it from the list they are looking at.
        setSlots((current) => current.filter((s) => s.start !== start));
        setStart(null);
      } else {
        setServerError('generic');
      }
    } catch {
      setServerError('generic');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = (): void => {
    setConfirmation(null);
    setServiceId(null);
    setDate(null);
    setSlots([]);
    setStart(null);
    setServerError(null);
  };

  return (
    <>
      <a href="#main" className="skip-link">
        {t(locale, 'app.skipToContent')}
      </a>
      <header className="topbar">
        <h1>{business?.name ?? '…'}</h1>
        <div className="locale-switch">
          <label htmlFor="locale">{t(locale, 'locale.label')}</label>
          <select id="locale" value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
            {LOCALES.map((code) => (
              <option key={code} value={code} lang={code}>
                {LOCALE_NAMES[code]}
              </option>
            ))}
          </select>
        </div>
      </header>

      <main id="main">
        {confirmation !== null && business !== null ? (
          <section className="confirmed" aria-labelledby="confirmed-title">
            <h2 id="confirmed-title">{t(locale, 'confirmed.title')}</h2>
            <p>{t(locale, 'confirmed.body', { date: formatDate(locale, confirmation.start, business.timeZone), time: formatTime(locale, confirmation.start, business.timeZone) })}</p>
            <p>
              <strong>{t(locale, 'confirmed.reference', { reference: confirmation.reference })}</strong>
            </p>
            <button type="button" onClick={reset}>
              {t(locale, 'confirmed.another')}
            </button>
          </section>
        ) : (
          <>
            <h2 className="visually-hidden">{t(locale, 'app.title')}</h2>

            <fieldset className="services">
              <legend id={serviceLegendId}>{t(locale, 'service.legend')}</legend>
              {business?.services.map((s) => (
                <div key={s.id} className="service">
                  <input type="radio" id={`service-${s.id}`} name="service" value={s.id} checked={serviceId === s.id} onChange={() => { setServiceId(s.id); setDate(null); setSlots([]); setStart(null); }} />
                  <label htmlFor={`service-${s.id}`}>
                    <span className="service-name">{s.name}</span>
                    <span className="service-meta">
                      {t(locale, 'service.duration', { minutes: s.durationMinutes })} · {formatMoney(locale, s.priceMinor, business.currency)}
                    </span>
                  </label>
                </div>
              ))}
            </fieldset>

            {service !== null && business !== null && (
              <section aria-labelledby="calendar-legend">
                <h3 id="calendar-legend" className="section-title">
                  {t(locale, 'calendar.legend')}
                </h3>
                <Calendar locale={locale} month={month} onMonthChange={setMonth} availableDates={availableDates} selected={date} onSelect={setDate} today={today} />
                <p className="hint">{t(locale, 'slots.timeZoneNote', { zone: zoneLabel(locale, business.timeZone) })}</p>
              </section>
            )}

            {date !== null && business !== null && <SlotPicker locale={locale} timeZone={business.timeZone} slots={slots} selected={start} onSelect={setStart} loading={slotsLoading} />}

            {start !== null && service !== null && business !== null && (
              <>
                <section aria-labelledby="summary-legend" className="summary">
                  <h3 id="summary-legend" className="section-title">
                    {t(locale, 'summary.legend')}
                  </h3>
                  <p>
                    {service.name} — {t(locale, 'summary.when', { date: formatDate(locale, start, business.timeZone), time: formatTime(locale, start, business.timeZone) })}
                  </p>
                </section>
                <BookingForm locale={locale} submitting={submitting} serverError={serverError} onSubmit={(customer) => void book(customer)} />
              </>
            )}
          </>
        )}
      </main>
    </>
  );
}
