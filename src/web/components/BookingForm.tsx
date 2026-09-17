import { useId, useRef, useState, type FormEvent } from 'react';

import { t } from '@/i18n/format';
import type { Locale } from '@/i18n/messages';

export interface BookingFormProps {
  readonly locale: Locale;
  readonly submitting: boolean;
  readonly serverError: 'taken' | 'generic' | null;
  readonly onSubmit: (customer: { name: string; email: string; notes?: string }) => void;
}

type Field = 'name' | 'email';

/** FormData values can be files; these fields never are. */
function text(data: FormData, field: string): string {
  const value = data.get(field);
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Validation is on submit, not on every keystroke: an error that appears
 * while someone is still typing their email is noise, and for a screen
 * reader user it is interrupting noise. On submit, the first invalid field
 * receives focus and every error is listed in a live region, so the
 * feedback is both located and announced.
 */
export function BookingForm({ locale, submitting, serverError, onSubmit }: BookingFormProps): React.JSX.Element {
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const ids = { name: useId(), email: useId(), emailHint: useId(), notes: useId(), errors: useId() };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = text(data, 'name');
    const email = text(data, 'email');
    const notes = text(data, 'notes');

    const next: Partial<Record<Field, string>> = {};
    if (name === '') next.name = t(locale, 'form.error.required');
    if (email === '') next.email = t(locale, 'form.error.required');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = t(locale, 'form.error.email');
    setErrors(next);

    if (next.name !== undefined) return nameRef.current?.focus();
    if (next.email !== undefined) return emailRef.current?.focus();

    onSubmit({ name, email, ...(notes === '' ? {} : { notes }) });
  };

  const errorList = Object.entries(errors);
  const serverMessage = serverError === 'taken' ? t(locale, 'form.error.taken') : serverError === 'generic' ? t(locale, 'form.error.generic') : null;

  return (
    <form onSubmit={handleSubmit} noValidate aria-describedby={errorList.length > 0 || serverMessage !== null ? ids.errors : undefined}>
      <fieldset>
        <legend>{t(locale, 'form.legend')}</legend>

        <div role="alert" id={ids.errors} className={errorList.length > 0 || serverMessage !== null ? 'form-errors' : 'visually-hidden'}>
          {serverMessage !== null && <p>{serverMessage}</p>}
          {errorList.length > 0 && (
            <ul>
              {errorList.map(([field, message]) => (
                <li key={field}>
                  <a href={`#${ids[field as Field]}`}>{message}</a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="field">
          <label htmlFor={ids.name}>{t(locale, 'form.name')}</label>
          <input ref={nameRef} id={ids.name} name="name" type="text" autoComplete="name" required aria-invalid={errors.name !== undefined} aria-describedby={errors.name === undefined ? undefined : `${ids.name}-error`} />
          {errors.name !== undefined && (
            <p id={`${ids.name}-error`} className="field-error">
              {errors.name}
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor={ids.email}>{t(locale, 'form.email')}</label>
          <input ref={emailRef} id={ids.email} name="email" type="email" autoComplete="email" required aria-invalid={errors.email !== undefined} aria-describedby={[ids.emailHint, errors.email === undefined ? null : `${ids.email}-error`].filter(Boolean).join(' ')} />
          <p id={ids.emailHint} className="hint">
            {t(locale, 'form.email.hint')}
          </p>
          {errors.email !== undefined && (
            <p id={`${ids.email}-error`} className="field-error">
              {errors.email}
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor={ids.notes}>{t(locale, 'form.notes')}</label>
          <textarea id={ids.notes} name="notes" rows={3} />
        </div>

        <button type="submit" disabled={submitting} aria-busy={submitting}>
          {submitting ? t(locale, 'form.submitting') : t(locale, 'form.submit')}
        </button>
      </fieldset>
    </form>
  );
}
