import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WealthPortfolioTable } from '../../public/src/components/WealthPortfolioTable';

describe('WealthPortfolioTable — aucune position', () => {
  it('suggère d’élargir le filtre propriétaire seulement s’il restreint déjà la liste', () => {
    const { rerender } = render(<WealthPortfolioTable holdings={[]} ownerFiltered />);
    expect(screen.getByText(/Élargissez le filtre par propriétaire/)).toBeInTheDocument();

    rerender(<WealthPortfolioTable holdings={[]} />);
    expect(screen.queryByText(/Élargissez le filtre/)).toBeNull();
    expect(screen.getByText('Aucune position boursière')).toBeInTheDocument();
  });
});
