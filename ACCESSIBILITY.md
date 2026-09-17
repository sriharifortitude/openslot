# Accessibility statement

openslot's booking page is built to conform to **WCAG 2.2 Level AA**. This
document says what has been verified, how, and what has not.

The European Accessibility Act (Directive 2019/882) applies to e-commerce
services from 28 June 2025 and references EN 301 549, which in turn
incorporates WCAG 2.1 AA; 2.2 is a superset. A deployment of openslot is
one component of a service and this statement covers that component only.

## Verified by automated tests

Run with `npm run test:a11y`. Every test lives in `tests/a11y/`.

| Requirement | How it is checked |
| --- | --- |
| No axe-core violations on any component, in the initial state and after a failed form submit | `axe.run` on the rendered DOM, asserted equal to `[]` |
| Calendar has one tab stop; Tab enters on the first available day | Filter buttons by `tabIndex === 0`; drive `userEvent.tab()` |
| Arrow keys, Home, End, PageUp, PageDown move focus by day, week, row and month, including across month boundaries | `userEvent.keyboard`, assert `document.activeElement`'s accessible name |
| Enter selects; the cell gets `aria-selected`, the name gets ", Selected" | Query `role="gridcell"` with `selected: true` |
| Unavailable days are focusable, `aria-disabled`, not selectable, and say "No appointments available" in their name | Click and assert the handler was not called |
| Today carries `aria-current="date"` and ", Today" in its name | Attribute assertion |
| Weekday headers are `columnheader`s with the full name available to assistive tech | Count and text assertions |
| Time slots are a radio group named by its legend; arrow keys move and select | Keyboard drive, assert `onSelect` calls |
| Slot count is announced via `role="status"` with correct plural forms in en/de/fr | Text assertions per locale |
| Form does not validate on keystroke; on submit every error is in a `role="alert"` region, linked to its field, and the first invalid field is focused | Type, submit, assert alert contents and focus |
| Invalid fields have `aria-invalid` and an `aria-describedby` that includes both the hint and the error | `toHaveAccessibleDescription` |
| Submit button is disabled and `aria-busy` while submitting | Attribute assertions |
| All of the above hold in German and French, not only English | Locale-parameterised tests |

## Verified by inspection

- **Contrast.** Every foreground/background pair in `src/web/styles.css`
  was computed with the WCAG relative-luminance formula: body text 17.8:1,
  muted text 7.8:1 (6.9:1 on the unavailable-day fill), accent with white
  6.6:1 in both directions, error text on its background 6.7:1, control
  borders 4.6:1 against white (1.4.11 requires 3:1). All text pairs exceed
  AA; all but the accent and error pairs exceed AAA. axe's contrast rule is
  disabled in jsdom because there is no layout engine; the computation is
  the substitute, and the numbers are in the stylesheet's header comment.
- **Focus appearance (2.4.11, 2.4.13).** A 3 px near-black ring offset 2 px
  with a white gap drawn beneath it, on every focusable element, never
  suppressed. The gap is what keeps it visible on the selected day's blue
  fill (the ring colour alone would be 2.7:1 against it) and where adjacent
  cells touch.
- **Target size (2.5.8).** Day cells have `min-height: 2.75rem` (44 px at
  the default font size) and fill their column; radio inputs are 20 px but
  their label is the click target.
- **No animation**, so 2.3.3 is satisfied trivially.

## Not verified — needed before a production deployment

These are the checks that need a browser and assistive technology, which
the test environment does not have. They are listed so nobody mistakes the
automated suite for a full audit.

- **Screen reader walk-throughs** with NVDA + Firefox, JAWS + Chrome,
  VoiceOver + Safari (macOS and iOS), TalkBack + Chrome. The markup follows
  the APG patterns those readers are tested against, but the announcements
  have not been listened to.
- **Reflow (1.4.10)** at 320 px and **zoom** at 200 % / 400 % in a real
  layout engine.
- **Voice control** (Dragon, Voice Control): all controls are native or
  standard-pattern with visible labels matching accessible names, which is
  the requirement for 2.5.3, but this has not been exercised.
- **Native-speaker review** of the German and French strings. They are
  grammatical and in the formal register but no translator has signed them
  off.
- **The month heading is `aria-live="polite"`.** Whether announcing every
  month change helps or interrupts when a user pages through several
  months has not been assessed; it may be better limited to button-driven
  changes.
- **Cognitive load** has not been evaluated with users. The page is one
  linear flow with no time limit, which is the intent.

## Reporting a problem

Open an issue describing the assistive technology, browser and steps.
Accessibility defects are treated as bugs, not enhancements.
