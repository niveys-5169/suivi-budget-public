import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { axe } from '../setup';
import { toHaveNoViolations } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { TransactionFormModal } from '../../public/src/components/TransactionFormModal';

expect.extend(toHaveNoViolations);

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSave: vi.fn(),
  transaction: null,
  categories: ['Alimentation', 'Transport', 'Logement'],
  accounts: ['LCL Courant', 'Livret A'],
};

function renderModal(props = {}) {
  return render(
    <MemoryRouter>
      <TransactionFormModal {...defaultProps} {...props} />
    </MemoryRouter>,
  );
}

describe('TransactionFormModal — accessibility', () => {
  beforeAll(() => {
    // createPortal targets document.body in tests — ensure it exists.
    if (!document.body) document.body = document.createElement('body');
  });

  it('has no axe violations when open', async () => {
    const { container } = renderModal();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders with role="dialog" and aria-modal', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('dialog is labelled by its title', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    const labelledById = dialog.getAttribute('aria-labelledby');
    expect(labelledById).toBeTruthy();
    const titleEl = document.getElementById(labelledById!);
    expect(titleEl).toHaveTextContent('Nouvelle Saisie');
  });

  it('all form inputs have associated labels', () => {
    renderModal();
    const inputs = screen.getAllByRole('textbox');
    inputs.forEach((input) => {
      const id = input.getAttribute('id');
      const label = id ? document.querySelector(`label[for="${id}"]`) : null;
      const ariaLabel = input.getAttribute('aria-label');
      expect(label || ariaLabel).toBeTruthy();
    });
  });

  it('close button has an accessible label', () => {
    renderModal();
    const closeBtn = screen.getByRole('button', { name: /fermer/i });
    expect(closeBtn).toBeInTheDocument();
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render dialog when isOpen is false', () => {
    renderModal({ isOpen: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
