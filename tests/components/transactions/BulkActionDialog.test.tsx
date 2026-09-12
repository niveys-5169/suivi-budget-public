import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BulkActionDialog } from '../../../public/src/components/transactions/BulkActionDialog';

describe('BulkActionDialog', () => {
  const onClose = vi.fn();
  const onConfirm = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => vi.clearAllMocks());

  it('confirms a rename with the typed value', async () => {
    render(
      <BulkActionDialog
        mode="rename"
        count={3}
        categories={[]}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.change(screen.getByLabelText('Libellé Transactionnel'), {
      target: { value: 'Courses' },
    });
    fireEvent.click(screen.getByText('Appliquer'));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('rename', 'Courses'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('keeps the apply button disabled until a label is typed', () => {
    render(
      <BulkActionDialog
        mode="rename"
        count={1}
        categories={[]}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );
    expect(screen.getByText('Appliquer').closest('button')).toBeDisabled();
  });

  it('confirms a deletion without a value', async () => {
    render(
      <BulkActionDialog
        mode="delete"
        count={2}
        categories={[]}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    // Le bouton d'action de la modale porte le libellé "Supprimer".
    const deleteButtons = screen.getAllByText('Supprimer');
    fireEvent.click(deleteButtons[deleteButtons.length - 1]!);

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('delete', undefined));
  });

  it('renders nothing when mode is null', () => {
    const { container } = render(
      <BulkActionDialog
        mode={null}
        count={0}
        categories={[]}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
