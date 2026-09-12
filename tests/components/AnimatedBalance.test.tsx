import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { AnimatedBalance } from '../../public/src/components/shared/AnimatedBalance';

// L'animation (spring framer-motion) et le fallback prefers-reduced-motion se
// résolvent via des effets / requestAnimationFrame, non fiables en DOM headless.
// On valide donc le contrat déterministe : la valeur courante est affichée
// formatée dès le premier rendu (pas de flash « 0 »).
describe('AnimatedBalance', () => {
  it('affiche la valeur formatée en euros dès le montage', () => {
    render(<AnimatedBalance value={1000} />);
    const el = screen.getByText(/1\s*000,00/);
    expect(el.textContent).toContain('€');
  });

  it('formate une valeur différente sur un nouveau montage', () => {
    render(<AnimatedBalance value={1500} />);
    expect(screen.getByText(/1\s*500,00/)).toBeTruthy();
  });

  it('gère un montant négatif', () => {
    render(<AnimatedBalance value={-42.5} />);
    expect(screen.getByText(/-?\s*42,50/)).toBeTruthy();
  });
});
