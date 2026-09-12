import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CategoryAutocomplete } from '../../../public/src/components/budgets-v2/CategoryAutocomplete';

const CATEGORIES = ['Alimentation', 'Transport', 'Loisirs', 'Restaurants', 'Santé'];

describe('CategoryAutocomplete', () => {
  it('affiche un champ de saisie', () => {
    render(<CategoryAutocomplete value="" onChange={vi.fn()} categories={CATEGORIES} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('affiche les suggestions filtrées à la saisie', () => {
    render(<CategoryAutocomplete value="" onChange={vi.fn()} categories={CATEGORIES} />);

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'ali' } });

    expect(screen.getByText('Alimentation')).toBeInTheDocument();
    expect(screen.queryByText('Transport')).not.toBeInTheDocument();
  });

  it('appelle onChange avec la catégorie sélectionnée au clic', () => {
    const onChange = vi.fn();
    render(<CategoryAutocomplete value="" onChange={onChange} categories={CATEGORIES} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ali' } });
    fireEvent.mouseDown(screen.getByText('Alimentation'));

    expect(onChange).toHaveBeenLastCalledWith('Alimentation');
  });

  it('ferme la liste après sélection', () => {
    render(<CategoryAutocomplete value="" onChange={vi.fn()} categories={CATEGORIES} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ali' } });
    fireEvent.mouseDown(screen.getByText('Alimentation'));

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('affiche la valeur passée en prop dans le champ', () => {
    render(<CategoryAutocomplete value="Transport" onChange={vi.fn()} categories={CATEGORIES} />);
    expect(screen.getByRole('combobox')).toHaveValue('Transport');
  });

  it("n'affiche pas de liste si la saisie est vide", () => {
    render(<CategoryAutocomplete value="" onChange={vi.fn()} categories={CATEGORIES} />);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
