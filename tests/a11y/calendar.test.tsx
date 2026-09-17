import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Calendar } from '@/web/components/Calendar';
import { violations } from './axe';

const AVAILABLE = new Set(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-13', '2026-10-30']);

function Harness({ onSelect = () => undefined }: { onSelect?: (d: string) => void }): React.JSX.Element {
  const [month, setMonth] = useState('2026-10');
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <Calendar
      locale="en"
      month={month}
      onMonthChange={setMonth}
      availableDates={AVAILABLE}
      selected={selected}
      onSelect={(d) => {
        setSelected(d);
        onSelect(d);
      }}
      today="2026-10-06"
    />
  );
}

/** Tab past the two month buttons onto the grid's single tab stop. */
async function tabIntoGrid(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.tab();
  await user.tab();
  await user.tab();
}

describe('Calendar', () => {
  it('has no axe violations', async () => {
    const { container } = render(<Harness />);
    expect(await violations(container)).toEqual([]);
  });

  it('is a grid labelled by the month heading with column headers for weekdays', () => {
    render(<Harness />);
    const grid = screen.getByRole('grid', { name: 'October 2026' });
    expect(grid).toHaveAccessibleDescription(/arrow keys/i);
    expect(screen.getAllByRole('columnheader')).toHaveLength(7);
  });

  it('has exactly one tab stop inside the grid, on the first available day', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const dayStops = screen.getAllByRole('button').filter((b) => b.tabIndex === 0 && b.classList.contains('day'));
    expect(dayStops).toHaveLength(1);
    await tabIntoGrid(user);
    expect(document.activeElement).toHaveAccessibleName(/Monday, 5 October 2026/);
  });

  it('moves focus with arrow keys, Home and End', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await tabIntoGrid(user);
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toHaveAccessibleName(/6 October 2026, Today/);
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toHaveAccessibleName(/13 October 2026/);
    await user.keyboard('{End}');
    expect(document.activeElement).toHaveAccessibleName(/Sunday, 18 October 2026/);
    await user.keyboard('{Home}');
    expect(document.activeElement).toHaveAccessibleName(/Monday, 12 October 2026/);
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toHaveAccessibleName(/5 October 2026/);
  });

  it('crosses month boundaries by arrow key and by PageDown, keeping focus', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await tabIntoGrid(user);
    await user.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}');
    await waitFor(() => expect(screen.getByRole('grid', { name: 'September 2026' })).toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toHaveAccessibleName(/Wednesday, 30 September 2026/));
    await user.keyboard('{PageDown}');
    await waitFor(() => expect(screen.getByRole('grid', { name: 'October 2026' })).toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toHaveAccessibleName(/30 October 2026/));
  });

  it('selects an available day with Enter and marks it selected', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    await tabIntoGrid(user);
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith('2026-10-05');
    const cell = screen.getByRole('gridcell', { selected: true });
    expect(cell).toHaveTextContent('5');
    expect(screen.getByRole('button', { name: /5 October 2026, Selected/ })).toBeInTheDocument();
  });

  it('keeps unavailable days navigable but not selectable, and says why in the name', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    const unavailable = screen.getByRole('button', { name: /Thursday, 8 October 2026, No appointments available/ });
    expect(unavailable).toHaveAttribute('aria-disabled', 'true');
    await user.click(unavailable);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('marks today with aria-current', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: /6 October 2026, Today/ })).toHaveAttribute('aria-current', 'date');
  });

  it('renders German headers and labels when the locale changes', () => {
    render(<Calendar locale="de" month="2026-10" onMonthChange={() => undefined} availableDates={AVAILABLE} selected={null} onSelect={() => undefined} today="2026-10-06" />);
    expect(screen.getByRole('grid', { name: 'Oktober 2026' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vorheriger Monat' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Donnerstag, 8\. Oktober 2026, Keine Termine verfügbar/ })).toBeInTheDocument();
  });
});
