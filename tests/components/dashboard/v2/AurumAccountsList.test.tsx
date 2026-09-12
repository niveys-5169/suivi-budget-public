import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AurumAccountsList } from '../../../../public/src/components/dashboard/v2/AurumAccountsList';

const accounts = [
  { id: '1', name: 'Compte Courant', balance: 12450, owner: 'Commun' },
  { id: '2', name: 'Livret A', balance: -30 },
];

describe('AurumAccountsList', () => {
  it('affiche chaque compte avec son détenteur et son solde', () => {
    render(<AurumAccountsList accounts={accounts} />);

    expect(screen.getByText('Compte Courant')).toBeInTheDocument();
    expect(screen.getByText('Commun')).toBeInTheDocument();
    // Sans détenteur renseigné, la ligne retombe sur « Personnel ».
    expect(screen.getByText('Personnel')).toBeInTheDocument();
  });

  it('rend les lignes cliquables comme des boutons et remonte le compte choisi', async () => {
    const onAccountClick = vi.fn();
    render(<AurumAccountsList accounts={accounts} onAccountClick={onAccountClick} />);

    screen.getByRole('button', { name: /Compte Courant/ }).click();
    expect(onAccountClick).toHaveBeenCalledWith('Compte Courant');
  });

  it('ne rend pas de bouton quand la liste est en lecture seule', () => {
    render(<AurumAccountsList accounts={accounts} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  /**
   * L'assertion portait sur `bg-[#121622]` — une couleur littérale, qui cassait
   * à chaque évolution du thème sans rien garantir. Elle porte désormais sur ce
   * qui compte vraiment : la ligne ne dessine pas son propre coin, c'est la
   * liste qui le porte. C'est la règle qui empêche les arrondis de se chevaucher.
   */
  it('laisse le rayon à la liste, jamais aux lignes', () => {
    const { container } = render(<AurumAccountsList accounts={accounts} />);

    expect(container.firstElementChild?.className).toContain('rounded-lg');
    expect(screen.getByTestId('account-1-card').className).not.toMatch(/rounded/);
  });
});
