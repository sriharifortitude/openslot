import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BookingForm } from '@/web/components/BookingForm';
import { violations } from './axe';

function form(overrides: Partial<Parameters<typeof BookingForm>[0]> = {}): React.JSX.Element {
  return <BookingForm locale="en" submitting={false} serverError={null} onSubmit={() => undefined} {...overrides} />;
}

describe('BookingForm', () => {
  it('has no axe violations, before and after a failed submit', async () => {
    const user = userEvent.setup();
    const { container } = render(form());
    expect(await violations(container)).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }));
    expect(await violations(container)).toEqual([]);
  });

  it('does not validate while typing', async () => {
    const user = userEvent.setup();
    render(form());
    await user.type(screen.getByLabelText('Email address'), 'not-an-email');
    expect(screen.queryByText('Enter a valid email address.')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toHaveAttribute('aria-invalid', 'false');
  });

  it('on submit: lists every error in an alert, links each to its field, focuses the first', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(form({ onSubmit }));
    await user.type(screen.getByLabelText('Email address'), 'nope');
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }));

    const links = screen.getByRole('alert').querySelectorAll('a');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent('This field is required.');
    expect(links[1]).toHaveTextContent('Enter a valid email address.');

    const name = screen.getByLabelText('Full name');
    expect(links[0]?.getAttribute('href')).toBe(`#${name.id}`);
    expect(document.activeElement).toBe(name);
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveAccessibleDescription('This field is required.');
    expect(screen.getByLabelText('Email address')).toHaveAccessibleDescription('We will send your confirmation here. Enter a valid email address.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits trimmed values and omits empty notes', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(form({ onSubmit }));
    await user.type(screen.getByLabelText('Full name'), '  Ada Lovelace ');
    await user.type(screen.getByLabelText('Email address'), 'ada@example.org');
    await user.keyboard('{Enter}');
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Ada Lovelace', email: 'ada@example.org' });
  });

  it('shows a server conflict in the alert region, localised', () => {
    render(form({ locale: 'de', serverError: 'taken' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/gerade vergeben/);
  });

  it('disables and marks the submit button busy while submitting', () => {
    render(form({ locale: 'fr', submitting: true }));
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });
});
