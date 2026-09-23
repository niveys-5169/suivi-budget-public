import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CategoryIcon } from '../CategoryIcon';
import { CATEGORY_ICON_COMPONENTS } from '../../constants/categoryIconComponents';
import { ALL_CATEGORY_ICONS } from '../../constants/categoryIcons';
import { BUILTIN_CATEGORY_META } from '../../constants/categoryMetadata';

describe('CategoryIcon', () => {
  it('couvre toutes les icônes de l’éditeur et des catégories par défaut', () => {
    const expected = [
      ...ALL_CATEGORY_ICONS,
      ...Object.values(BUILTIN_CATEGORY_META).map((m) => m.icon),
    ];
    const missing = expected.filter((name) => !CATEGORY_ICON_COMPONENTS[name]);
    expect(missing).toEqual([]);
  });

  it('rend une icône de la table statique sans chargement différé', () => {
    const { container } = render(<CategoryIcon icon="utensils" />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('accepte le snake_case et la casse mixte', () => {
    const { container } = render(<CategoryIcon icon="Shopping_Cart" />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('charge à la demande une icône Lucide hors table', async () => {
    const { container } = render(<CategoryIcon icon="rocket" />);
    await screen.findByText((_, el) => el?.tagName.toLowerCase() === 'svg');
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('affiche tel quel un texte qui n’est pas un nom d’icône (emoji)', () => {
    render(<CategoryIcon icon="🍕" />);
    expect(screen.getByText('🍕')).toBeInTheDocument();
  });
});
