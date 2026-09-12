import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { AurumAccountsList } from '../AurumAccountsList';

describe('AurumAccountsList', () => {
  it('uses bankName (not the free-text account label) to pick the logo', () => {
    render(
      <AurumAccountsList
        accounts={[
          { id: 'acc-1', name: 'Compte perso', bankName: 'LCL', balance: 1000 },
          { id: 'acc-2', name: 'Épargne', balance: 500 },
        ]}
      />,
    );

    expect(screen.getByAltText('Logo LCL')).toBeInTheDocument();
    expect(screen.getByText('Compte perso')).toBeInTheDocument();
    expect(screen.getByText('Épargne')).toBeInTheDocument();
  });
});
