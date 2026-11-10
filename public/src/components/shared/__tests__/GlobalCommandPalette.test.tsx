import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import React from 'react';
import { GlobalCommandPalette, openCommandPalette } from '../GlobalCommandPalette';

vi.mock('../../../context/TransactionContext', () => ({
  useTransactionContext: () => ({ transactions: [] }),
}));

const Where: React.FC = () => <div data-testid="where">{useLocation().pathname}</div>;

const setup = () =>
  render(
    <MemoryRouter initialEntries={['/budgets']}>
      <GlobalCommandPalette />
      <Routes>
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

describe('GlobalCommandPalette', () => {
  it('est fermée au rendu, Ctrl+K l’ouvre', () => {
    setup();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('l’événement open-command-palette l’ouvre', () => {
    setup();
    act(() => openCommandPalette());
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('taper « notif » puis Entrée navigue vers /notifications', async () => {
    setup();
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'notif' } });
    await screen.findByText('Notifications');
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(screen.getByTestId('where')).toHaveTextContent('/notifications');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
