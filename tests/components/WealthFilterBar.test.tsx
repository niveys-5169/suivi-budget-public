import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WealthFilterBar } from '../../public/src/components/WealthFilterBar';

const owners = [
  { id: 'nicolas', label: 'Nicolas' },
  { id: 'sienna', label: 'Sienna' },
];

function renderBar(props: Partial<React.ComponentProps<typeof WealthFilterBar>> = {}) {
  const onOwnerScopeChange = vi.fn();
  const onTypeScopeChange = vi.fn();
  render(
    <WealthFilterBar
      owners={owners}
      ownerScope="all"
      onOwnerScopeChange={onOwnerScopeChange}
      typeScope="all"
      onTypeScopeChange={onTypeScopeChange}
      {...props}
    />,
  );
  return { onOwnerScopeChange, onTypeScopeChange };
}

describe('WealthFilterBar', () => {
  it('affiche les propriétaires et les 4 types sans avertissement quand rien n’est filtré', () => {
    renderBar();
    expect(screen.getByRole('button', { name: 'Nicolas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retraite' })).toBeInTheDocument();
    expect(screen.queryByText(/Masqué/)).not.toBeInTheDocument();
  });

  it('signale les types masqués et permet de tout réafficher', () => {
    const { onTypeScopeChange, onOwnerScopeChange } = renderBar({
      typeScope: ['courants', 'epargnelivrets', 'investissements'],
    });
    expect(screen.getByText(/Masqué/)).toHaveTextContent('Retraite');
    expect(screen.getByRole('button', { name: 'Retraite' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Tout afficher' }));
    expect(onTypeScopeChange).toHaveBeenCalledWith('all');
    expect(onOwnerScopeChange).toHaveBeenCalledWith('all');
  });

  it('réactiver le dernier type masqué revient à « tous »', () => {
    const { onTypeScopeChange } = renderBar({
      typeScope: ['courants', 'epargnelivrets', 'investissements'],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Retraite' }));
    expect(onTypeScopeChange).toHaveBeenCalledWith('all');
  });

  it('sélectionne un propriétaire depuis « Tous »', () => {
    const { onOwnerScopeChange } = renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'Sienna' }));
    expect(onOwnerScopeChange).toHaveBeenCalledWith(['sienna']);
  });
});
