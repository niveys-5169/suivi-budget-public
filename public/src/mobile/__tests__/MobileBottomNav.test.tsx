import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MobileBottomNav } from '../MobileBottomNav';

describe('MobileBottomNav', () => {
  it('renders all nav links', () => {
    render(
      <MemoryRouter>
        <MobileBottomNav />
      </MemoryRouter>,
    );
    expect(screen.getByText('Console')).toBeInTheDocument();
    expect(screen.getByText('Flux')).toBeInTheDocument();
    expect(screen.getByText('Analyse')).toBeInTheDocument();
    expect(screen.getByText('Budgets')).toBeInTheDocument();
    expect(screen.getByText('Audit')).toBeInTheDocument();
  });

  it('has correct route path references', () => {
    render(
      <MemoryRouter>
        <MobileBottomNav />
      </MemoryRouter>,
    );
    const consoleLink = screen.getByText('Console').closest('a');
    expect(consoleLink).toHaveAttribute('href', '/');

    const auditLink = screen.getByText('Audit').closest('a');
    expect(auditLink).toHaveAttribute('href', '/patrimoine');
  });

  it('applies active styling class to active routes', () => {
    render(
      <MemoryRouter initialEntries={['/transactions']}>
        <MobileBottomNav />
      </MemoryRouter>,
    );
    const activeLink = screen.getByText('Flux').closest('a');
    expect(activeLink).toHaveClass('text-gold');
  });
});
