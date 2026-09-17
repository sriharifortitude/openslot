# 3. Native radio groups for services and times; a custom grid only for the calendar

Status: accepted — 2026-09-16

## Context

The page has three "choose one of several" controls: service, date, time.
Booking widgets commonly render all three as rows of styled `<div>`s or
`<button>`s with `aria-pressed`, which loses the group semantics ("3 of 12")
and the keyboard behaviour that a screen-reader user expects from a set of
mutually exclusive options.

## Decision

- **Service and time** are native `<input type="radio">` groups inside a
  `<fieldset>` with a `<legend>`. They are restyled with CSS (`accent-color`,
  `:has(:checked)`), not replaced. Arrow keys move and select, Space selects,
  the group is announced with its legend and position. None of that is code
  in this repository.
- **Date** is the one control where a native element does not fit: a month
  grid needs two-dimensional arrow navigation and one tab stop for up to 31
  cells. It implements the WAI-ARIA Authoring Practices date-picker grid on a
  real `<table role="grid">`, with a roving tabindex, so the table's row and
  column semantics come free and the grid role adds the keyboard contract.
  The keyboard behaviour is tested key by key.

`jsx-a11y/no-noninteractive-element-to-interactive-role` flags
`<table role="grid">`; it is disabled on that one line with a comment. The
rule is a good default and the APG pattern is the documented exception.

## Consequences

- Two of the three controls have no bespoke keyboard code and cannot regress.
- The slot list re-renders as a new radio group when the date changes; the
  count is announced through a `role="status"` region so the change is
  perceivable without vision.
- Radio inputs cannot express "unavailable but present" the way the grid
  does with `aria-disabled`; unavailable times are simply not listed, and the
  status text says "No times are available on this date" when the list is
  empty. For dates, keeping unavailable cells in the grid was chosen because
  a grid with holes is confusing to navigate.
- The calendar is the only component with meaningful a11y risk, and it has
  the majority of the a11y test suite.
