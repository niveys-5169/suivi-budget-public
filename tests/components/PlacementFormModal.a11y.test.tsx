import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { toHaveNoViolations } from 'jest-axe';
import { axe } from '../setup';
import { PlacementFormModal } from '../../public/src/components/PlacementFormModal';

expect.extend(toHaveNoViolations);

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

vi.mock('../../public/src/hooks/usePlacements', () => ({
  usePlacements: () => ({
    addPlacement: vi.fn(),
    updatePlacement: vi.fn(),
    deletePlacement: vi.fn(),
  }),
}));

describe('PlacementFormModal — accessibility', () => {
  beforeAll(() => {
    if (!document.body) document.body = document.createElement('body');
  });

  it('has no axe violations on a new placement', async () => {
    const { container } = render(<PlacementFormModal onClose={vi.fn()} onSave={vi.fn()} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations when editing an existing placement', async () => {
    const { container } = render(
      <PlacementFormModal
        placement={{
          id: 'p1',
          nom: 'Livret A',
          owner: 'Nicolas',
          type: 'savings',
          montant: 5000,
        }}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
