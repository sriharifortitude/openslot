import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SlotPicker } from '@/web/components/SlotPicker';
import { violations } from './axe';

const SLOTS = [
  { start: '2026-10-05T07:00:00Z', end: '2026-10-05T07:30:00Z' },
  { start: '2026-10-05T07:30:00Z', end: '2026-10-05T08:00:00Z' },
  { start: '2026-10-05T08:00:00Z', end: '2026-10-05T08:30:00Z' },
];

function picker(overrides: Partial<Parameters<typeof SlotPicker>[0]> = {}): React.JSX.Element {
  return <SlotPicker locale="en" timeZone="Europe/Berlin" slots={SLOTS} selected={null} onSelect={() => undefined} loading={false} {...overrides} />;
}

describe('SlotPicker', () => {
  it('has no axe violations', async () => {
    const { container } = render(picker());
    expect(await violations(container)).toEqual([]);
  });

  it('is a group named by its legend, with times rendered in the business zone', () => {
    render(picker());
    expect(screen.getByRole('group', { name: 'Choose a time' })).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(radios.map((r) => r.closest('.slot')?.textContent)).toEqual(['09:00', '09:30', '10:00']);
  });

  it('announces the count through a status region, with plural rules per locale', () => {
    const { rerender } = render(picker());
    expect(screen.getByRole('status')).toHaveTextContent('3 times available');
    rerender(picker({ slots: SLOTS.slice(0, 1) }));
    expect(screen.getByRole('status')).toHaveTextContent('1 time available');
    rerender(picker({ locale: 'de', slots: [] }));
    expect(screen.getByRole('status')).toHaveTextContent('keine Termine frei');
    rerender(picker({ locale: 'fr', loading: true }));
    expect(screen.getByRole('group')).toHaveAttribute('aria-busy', 'true');
  });

  it('selects with the keyboard: arrows move, selection follows', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(picker({ onSelect }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getAllByRole('radio')[0]);
    await user.keyboard('{ArrowDown}');
    expect(onSelect).toHaveBeenLastCalledWith('2026-10-05T07:30:00Z');
  });
});
