import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CategoryDeltaBadge } from '../../../public/src/components/dashboard/v2/CategoryDeltaBadge';

describe('CategoryDeltaBadge', () => {
  it('signale une hausse de dépense comme négative', () => {
    render(<CategoryDeltaBadge deltaPct={25} />);
    const badge = screen.getByRole('status');
    expect(badge.textContent).toMatch(/\+25/);
    expect(badge.className).toMatch(/\bnegative\b/);
  });

  it('signale une baisse de dépense comme positive', () => {
    render(<CategoryDeltaBadge deltaPct={-15} />);
    const badge = screen.getByRole('status');
    expect(badge.textContent).toMatch(/-15/);
    expect(badge.className).toMatch(/\bpositive\b/);
  });

  it('ne rend rien si deltaPct est null', () => {
    const { container } = render(<CategoryDeltaBadge deltaPct={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('ne rend rien si deltaPct est 0', () => {
    const { container } = render(<CategoryDeltaBadge deltaPct={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});
