import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CALCULATEURS_RECONNUS } from '../../../../utils/projection/importCalculateurs';
import { ImportPreviewSheet } from '../ImportPreviewSheet';
import { makeParams } from './fixtures';

const show = (reconnus: string[]) =>
  render(
    <ImportPreviewSheet
      result={{ params: makeParams(), reconnus, avertissements: [] }}
      onApply={vi.fn()}
      onCancel={vi.fn()}
    />,
  );

describe('ImportPreviewSheet : calculateurs', () => {
  it('indique que les paramètres des calculateurs sont reconnus', () => {
    show(['Inflation', CALCULATEURS_RECONNUS]);
    expect(screen.getByText('Paramètres des calculateurs').nextSibling).toHaveTextContent(
      'Reconnus',
    );
  });

  it('indique qu’ils ne sont pas reconnus', () => {
    show(['Inflation']);
    expect(screen.getByText('Paramètres des calculateurs').nextSibling).toHaveTextContent(
      'Non reconnus',
    );
  });
});
