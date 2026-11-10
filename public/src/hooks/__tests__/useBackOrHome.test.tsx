import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { useBackOrHome } from '../useBackOrHome';

const Page: React.FC = () => {
  const goBack = useBackOrHome();
  return <button onClick={goBack}>Retour</button>;
};

const renderAt = (initialEntries: string[], initialIndex?: number) =>
  render(
    <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
      <Routes>
        <Route path="/" element={<p>Accueil</p>} />
        <Route path="/a" element={<p>Page A</p>} />
        <Route path="/page" element={<Page />} />
      </Routes>
    </MemoryRouter>,
  );

describe('useBackOrHome', () => {
  it("arrivée directe (une seule entrée) : repli sur l'accueil", () => {
    renderAt(['/page']);
    fireEvent.click(screen.getByRole('button', { name: 'Retour' }));
    expect(screen.getByText('Accueil')).toBeInTheDocument();
  });

  it('après une navigation interne : revient à la page précédente', () => {
    renderAt(['/a', '/page'], 1);
    fireEvent.click(screen.getByRole('button', { name: 'Retour' }));
    expect(screen.getByText('Page A')).toBeInTheDocument();
  });
});
