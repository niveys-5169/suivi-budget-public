import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AutoValueField } from '../AutoValueField';

const renderField = (props: Partial<React.ComponentProps<typeof AutoValueField>> = {}) => {
  const onChange = vi.fn();
  render(
    <AutoValueField
      label="Budget"
      value={{ mode: 'auto' }}
      observed={1234}
      onChange={onChange}
      {...props}
    />,
  );
  return onChange;
};

describe('AutoValueField', () => {
  it('affiche la valeur observée en mode Auto, sans champ manuel', () => {
    renderField();
    expect(screen.getByText(/Observé : 1\s234\s€/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Valeur manuelle/)).not.toBeInTheDocument();
  });

  it('bascule en Manuel et affiche le champ manuel', () => {
    const onChange = renderField();
    fireEvent.click(screen.getByRole('button', { name: 'Manuel' }));
    expect(onChange).toHaveBeenCalledWith({ mode: 'manuel' });
  });

  it('saisit une valeur manuelle', () => {
    const onChange = renderField({ value: { mode: 'manuel', manuel: 10 } });
    fireEvent.change(screen.getByLabelText(/Valeur manuelle/), { target: { value: '42,5' } });
    expect(onChange).toHaveBeenCalledWith({ mode: 'manuel', manuel: 42.5 });
  });

  it('indique quand la valeur observée est indisponible et propose la saisie manuelle', () => {
    renderField({ observed: null, value: { mode: 'auto', manuel: 7 } });
    expect(screen.getByText('Non disponible — valeur manuelle utilisée')).toBeInTheDocument();
    expect(screen.getByLabelText(/Valeur manuelle/)).toHaveValue('7');
  });

  it('affiche le badge « à confirmer » à la demande', () => {
    renderField({ toConfirm: true });
    expect(screen.getByText('à confirmer')).toBeInTheDocument();
  });

  it('sélectionne des catégories sources en mode Auto', () => {
    const onChange = vi.fn();
    renderField({
      sources: { options: ['Courses', 'Salaire'], selected: ['Salaire'], onChange },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Courses' }));
    expect(onChange).toHaveBeenCalledWith(['Salaire', 'Courses']);
  });
});
