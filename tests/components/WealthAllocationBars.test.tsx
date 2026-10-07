import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { WealthAllocationBars } from '../../public/src/components/WealthAllocationBars';

describe('WealthAllocationBars', () => {
  it('affiche le segment Immobilier avec son montant et sa part', () => {
    render(
      <WealthAllocationBars
        segments={[
          { type: 'cash', amount: 10000, pct: 2.4 },
          { type: 'savings', amount: 0, pct: 0 },
          { type: 'investissements', amount: 0, pct: 0 },
          { type: 'retirement', amount: 0, pct: 0 },
          { type: 'immobilier', amount: 400000, pct: 97.6 },
        ]}
      />,
    );

    expect(screen.getByText('Immobilier')).toBeInTheDocument();
    expect(screen.getByText('97.6%')).toBeInTheDocument();
    // La barre n'affiche que les segments non nuls : cash + immobilier.
    expect(screen.getByTitle('Immobilier: 97.6%')).toBeInTheDocument();
    expect(screen.getByTitle('Disponibilités: 2.4%')).toBeInTheDocument();
    expect(screen.queryByTitle(/Retraite/)).not.toBeInTheDocument();
  });
});
