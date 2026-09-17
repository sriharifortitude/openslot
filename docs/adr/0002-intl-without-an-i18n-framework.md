# 2. Intl APIs and a typed message table, no i18n framework

Status: accepted — 2026-09-15

## Context

The booking page must read naturally in English, German and French, with
dates, times, money and plurals formatted the way each audience expects.
The usual answer is react-intl or i18next plus a message-extraction
pipeline. For a page with three locales and about forty strings, that is a
build step, a runtime dependency, and a JSON format that TypeScript cannot
check.

## Decision

- Messages live in `src/i18n/messages.ts`. The English object is the schema;
  the German and French objects are typed as `Messages`, so a missing or
  misspelled key is a compile error, not an English fallback discovered in
  production.
- Formatting goes through the platform: `Intl.DateTimeFormat`,
  `Intl.NumberFormat` (currency), `Intl.PluralRules`. A small `t()` function
  substitutes `{name}` placeholders and handles the ICU `plural` form, which
  is the only ICU construct the messages use.
- The message locale (`en`, `de`, `fr`) is mapped to a full BCP-47 tag for
  `Intl` (`en-GB`, `de-DE`, `fr-FR`). A bare `en` resolves to US conventions
  in every engine, which would give a European customer "10/5/2026" and
  "9:00 AM".

## Consequences

- Zero i18n runtime; the three message objects are about 4 kB.
- Adding a locale is adding one object and one entry in `LOCALES`; the type
  checker lists every string that needs translating.
- ICU support is deliberately partial. `select` and nested plurals are not
  implemented and would need to be added, or the decision revisited, if a
  message required them. The trade-off is documented in the `t()` comment.
- The German and French strings were written by the author in the formal
  register (*Sie* / *vous*) and have not been reviewed by a native speaker.
  That is a known gap for a production deployment and a translator's task,
  not a code change.
