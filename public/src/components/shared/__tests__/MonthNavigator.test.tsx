import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MonthNavigator } from '../MonthNavigator';
import React from 'react';

describe('MonthNavigator', () => {
  it('renders correctly with given month', () => {
    const month = new Date(2026, 3, 1); // April 2026
    render(<MonthNavigator month={month} onChange={() => {}} />);

    expect(screen.getByText(/avril 2026/i)).toBeInTheDocument();
  });

  it('calls onChange with previous month when clicking left button', () => {
    const month = new Date(2026, 3, 1); // April 2026
    const onChange = vi.fn();
    render(<MonthNavigator month={month} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText(/mois précédent/i));

    const calledDate = onChange.mock.calls[0]![0];
    expect(calledDate.getMonth()).toBe(2); // March
    expect(calledDate.getFullYear()).toBe(2026);
  });

  it('calls onChange with next month when clicking right button', () => {
    const month = new Date(2026, 3, 1); // April 2026
    const onChange = vi.fn();
    render(<MonthNavigator month={month} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText(/mois suivant/i));

    const calledDate = onChange.mock.calls[0]![0];
    expect(calledDate.getMonth()).toBe(4); // May
    expect(calledDate.getFullYear()).toBe(2026);
  });

  it('handles year boundary (January to December)', () => {
    const month = new Date(2026, 0, 1); // Jan 2026
    const onChange = vi.fn();
    render(<MonthNavigator month={month} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText(/mois précédent/i));

    const calledDate = onChange.mock.calls[0]![0];
    expect(calledDate.getMonth()).toBe(11); // December
    expect(calledDate.getFullYear()).toBe(2025);
  });
});
