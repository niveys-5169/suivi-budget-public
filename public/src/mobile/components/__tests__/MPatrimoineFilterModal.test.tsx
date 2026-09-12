import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MPatrimoineFilterModal } from '../MPatrimoineFilterModal';

const apply = () => fireEvent.click(screen.getByText('Appliquer'));

describe('MPatrimoineFilterModal', () => {
  const defaultProps = {
    isOpen: true,
    owners: ['Nicolas', 'Gwen'],
    ownerScope: 'all' as string[] | 'all',
    onChangeOwner: vi.fn(),
    wealthTypeScope: 'all' as string[] | 'all',
    onChangeType: vi.fn(),
    onClose: vi.fn(),
  };

  it('renders filters, headers and selections correctly when open', () => {
    render(<MPatrimoineFilterModal {...defaultProps} />);

    expect(screen.getByText('Filtrer le Patrimoine')).toBeInTheDocument();
    expect(screen.getByText('Propriétaires')).toBeInTheDocument();
    expect(screen.getByText("Types d'actifs")).toBeInTheDocument();

    // Verify all owners are listed
    expect(screen.getByText('Nicolas')).toBeInTheDocument();
    expect(screen.getByText('Gwen')).toBeInTheDocument();

    // Verify all types are listed
    expect(screen.getByText('Liquidités')).toBeInTheDocument();
    expect(screen.getByText('Épargne')).toBeInTheDocument();
    expect(screen.getByText('Investissements')).toBeInTheDocument();
    expect(screen.getByText('Retraite')).toBeInTheDocument();

    // Footer buttons
    expect(screen.getByText('Appliquer')).toBeInTheDocument();
    expect(screen.getByText('Annuler')).toBeInTheDocument();
  });

  it('does not render filters when isOpen is false', () => {
    render(<MPatrimoineFilterModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Filtrer le Patrimoine')).not.toBeInTheDocument();
  });

  it('does not propagate selections before Appliquer is clicked', () => {
    const onChangeOwner = vi.fn();
    render(<MPatrimoineFilterModal {...defaultProps} onChangeOwner={onChangeOwner} />);

    fireEvent.click(screen.getByText('Nicolas'));
    expect(onChangeOwner).not.toHaveBeenCalled();
  });

  describe('Owner Filtering Logic', () => {
    it('applies a specific owner when current scope is all', () => {
      const onChangeOwner = vi.fn();
      render(
        <MPatrimoineFilterModal {...defaultProps} onChangeOwner={onChangeOwner} ownerScope="all" />,
      );

      fireEvent.click(screen.getByText('Nicolas'));
      apply();
      expect(onChangeOwner).toHaveBeenCalledWith(['Nicolas']);
    });

    it('applies all when deselecting the only selected owner', () => {
      const onChangeOwner = vi.fn();
      render(
        <MPatrimoineFilterModal
          {...defaultProps}
          onChangeOwner={onChangeOwner}
          ownerScope={['Nicolas']}
        />,
      );

      fireEvent.click(screen.getByText('Nicolas'));
      apply();
      expect(onChangeOwner).toHaveBeenCalledWith('all');
    });

    it('normalizes to all when the selection becomes complete', () => {
      const onChangeOwner = vi.fn();
      render(
        <MPatrimoineFilterModal
          {...defaultProps}
          onChangeOwner={onChangeOwner}
          ownerScope={['Nicolas']}
        />,
      );

      // Clicking 'Gwen' completes ['Nicolas', 'Gwen'] (all owners) → 'all'
      fireEvent.click(screen.getByText('Gwen'));
      apply();
      expect(onChangeOwner).toHaveBeenCalledWith('all');
    });

    it('applies the remaining owner when deselecting one from a list of multiple', () => {
      const onChangeOwner = vi.fn();
      render(
        <MPatrimoineFilterModal
          {...defaultProps}
          owners={['Nicolas', 'Gwen', 'Third']}
          onChangeOwner={onChangeOwner}
          ownerScope={['Nicolas', 'Gwen']}
        />,
      );

      fireEvent.click(screen.getByText('Nicolas'));
      apply();
      expect(onChangeOwner).toHaveBeenCalledWith(['Gwen']);
    });

    it('applies all when clicking Tous', () => {
      const onChangeOwner = vi.fn();
      render(
        <MPatrimoineFilterModal
          {...defaultProps}
          onChangeOwner={onChangeOwner}
          ownerScope={['Nicolas']}
        />,
      );

      const allButtons = screen.getAllByText('Tous');
      // The first 'Tous' is for Owners, the second is for Asset Types
      fireEvent.click(allButtons[0]!);
      apply();
      expect(onChangeOwner).toHaveBeenCalledWith('all');
    });
  });

  describe('Asset Type Filtering Logic', () => {
    it('applies a specific type when current scope is all', () => {
      const onChangeType = vi.fn();
      render(
        <MPatrimoineFilterModal
          {...defaultProps}
          onChangeType={onChangeType}
          wealthTypeScope="all"
        />,
      );

      fireEvent.click(screen.getByText('Liquidités'));
      apply();
      expect(onChangeType).toHaveBeenCalledWith(['courants']);
    });

    it('applies all when deselecting the only selected type', () => {
      const onChangeType = vi.fn();
      render(
        <MPatrimoineFilterModal
          {...defaultProps}
          onChangeType={onChangeType}
          wealthTypeScope={['courants']}
        />,
      );

      fireEvent.click(screen.getByText('Liquidités'));
      apply();
      expect(onChangeType).toHaveBeenCalledWith('all');
    });

    it('applies all when selecting the last remaining type', () => {
      const onChangeType = vi.fn();
      render(
        <MPatrimoineFilterModal
          {...defaultProps}
          onChangeType={onChangeType}
          wealthTypeScope={['courants', 'epargnelivrets', 'investissements']}
        />,
      );

      fireEvent.click(screen.getByText('Retraite'));
      apply();
      expect(onChangeType).toHaveBeenCalledWith('all');
    });

    it('applies the union when selecting another type', () => {
      const onChangeType = vi.fn();
      render(
        <MPatrimoineFilterModal
          {...defaultProps}
          onChangeType={onChangeType}
          wealthTypeScope={['courants']}
        />,
      );

      fireEvent.click(screen.getByText('Épargne'));
      apply();
      expect(onChangeType).toHaveBeenCalledWith(['courants', 'epargnelivrets']);
    });

    it('applies all when clicking Tous', () => {
      const onChangeType = vi.fn();
      render(
        <MPatrimoineFilterModal
          {...defaultProps}
          onChangeType={onChangeType}
          wealthTypeScope={['courants']}
        />,
      );

      const allButtons = screen.getAllByText('Tous');
      // The second 'Tous' is for Asset Types
      fireEvent.click(allButtons[1]!);
      apply();
      expect(onChangeType).toHaveBeenCalledWith('all');
    });
  });

  describe('Réinitialiser', () => {
    it('resets both drafts to all, applied on Appliquer', () => {
      const onChangeOwner = vi.fn();
      const onChangeType = vi.fn();
      render(
        <MPatrimoineFilterModal
          {...defaultProps}
          onChangeOwner={onChangeOwner}
          onChangeType={onChangeType}
          ownerScope={['Nicolas']}
          wealthTypeScope={['courants']}
        />,
      );

      fireEvent.click(screen.getByLabelText('Réinitialiser'));
      apply();
      expect(onChangeOwner).toHaveBeenCalledWith('all');
      expect(onChangeType).toHaveBeenCalledWith('all');
    });
  });

  describe('Closing behavior', () => {
    it('calls onClose when close button is clicked, without applying', () => {
      const onClose = vi.fn();
      const onChangeOwner = vi.fn();
      render(
        <MPatrimoineFilterModal
          {...defaultProps}
          onClose={onClose}
          onChangeOwner={onChangeOwner}
        />,
      );

      fireEvent.click(screen.getByText('Nicolas'));
      const closeButton = screen.getByLabelText('Fermer');
      fireEvent.click(closeButton);
      expect(onClose).toHaveBeenCalled();
      expect(onChangeOwner).not.toHaveBeenCalled();
    });

    it('calls onClose when Annuler is clicked', () => {
      const onClose = vi.fn();
      render(<MPatrimoineFilterModal {...defaultProps} onClose={onClose} />);

      fireEvent.click(screen.getByText('Annuler'));
      expect(onClose).toHaveBeenCalled();
    });
  });
});
