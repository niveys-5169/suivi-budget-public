import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BulkActionsBar } from '../../../public/src/components/transactions/BulkActionsBar';

const handlers = {
  onSelectAll: vi.fn(),
  onClear: vi.fn(),
  onRename: vi.fn(),
  onCategorize: vi.fn(),
  onAssignMonth: vi.fn(),
  onPoint: vi.fn(),
  onUnpoint: vi.fn(),
  onDelete: vi.fn(),
};

const renderBar = (props: Partial<React.ComponentProps<typeof BulkActionsBar>> = {}) =>
  render(<BulkActionsBar count={2} allSelected={false} {...handlers} {...props} />);

describe('BulkActionsBar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fires the matching callback for each action', () => {
    renderBar();
    fireEvent.click(screen.getByText('Renommer'));
    fireEvent.click(screen.getByText('Catégoriser'));
    fireEvent.click(screen.getByText('Pointer'));
    fireEvent.click(screen.getByText('Supprimer'));

    expect(handlers.onRename).toHaveBeenCalledTimes(1);
    expect(handlers.onCategorize).toHaveBeenCalledTimes(1);
    expect(handlers.onPoint).toHaveBeenCalledTimes(1);
    expect(handlers.onDelete).toHaveBeenCalledTimes(1);
  });

  it('shows "select all" when not everything is selected', () => {
    renderBar({ allSelected: false });
    fireEvent.click(screen.getByText('Tout sélectionner'));
    expect(handlers.onSelectAll).toHaveBeenCalledTimes(1);
  });

  it('disables actions while busy', () => {
    renderBar({ busy: true });
    expect(screen.getByText('Supprimer').closest('button')).toBeDisabled();
  });
});
