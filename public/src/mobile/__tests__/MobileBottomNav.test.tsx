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
    expect(screen.getByText('Accueil')).toBeInTheDocument();
    expect(screen.getByText('Transactions')).toBeInTheDocument();
    expect(screen.getByText('Analyse')).toBeInTheDocument();
    expect(screen.getByText('Budgets')).toBeInTheDocument();
    expect(screen.getByText('Patrimoine')).toBeInTheDocument();
  });

  it('has correct route path references', () => {
    render(
      <MemoryRouter>
        <MobileBottomNav />
      </MemoryRouter>,
    );
    const homeLink = screen.getByText('Accueil').closest('a');
    expect(homeLink).toHaveAttribute('href', '/');

    const patrimoineLink = screen.getByText('Patrimoine').closest('a');
    expect(patrimoineLink).toHaveAttribute('href', '/patrimoine');
  });

  it('applies active styling class to active routes', () => {
    render(
      <MemoryRouter initialEntries={['/transactions']}>
        <MobileBottomNav />
      </MemoryRouter>,
    );
    const activeLink = screen.getByText('Transactions').closest('a');
    expect(activeLink).toHaveClass('text-gold');
  });
});
