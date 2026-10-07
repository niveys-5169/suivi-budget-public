import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toHaveNoViolations } from 'jest-axe';
import { axe } from '../setup';
import {
  PropertyValuationCard,
  type PropertyValuationPlacement,
} from '../../public/src/components/property/PropertyValuationCard';
import { capitalRestantDu } from '../../public/src/utils/creditSchedule';
import { formatCurrency } from '../../public/src/lib/formatters';
import type {
  BienImmobilier,
  Credit,
  EstimationImmobiliere,
} from '../../public/src/types/banking.types';

expect.extend(toHaveNoViolations);

// Le mock global de react-intl n'interpole pas les valeurs : ici on en a besoin.
vi.mock('react-intl', async () => {
  const { default: fr } = await import('../../public/src/i18n/messages/fr');
  return {
    useIntl: () => ({
      formatMessage: (
        { id }: { id: string },
        values?: Record<string, string | number | undefined>,
      ) =>
        ((fr as Record<string, string>)[id] ?? id).replace(/\{(\w+)\}/g, (_m, k: string) =>
          String(values?.[k] ?? ''),
        ),
    }),
  };
});

const mockTrigger = vi.fn();
vi.mock('../../public/src/services/firebase-api', () => ({
  triggerGitHubWorkflow: (...args: unknown[]) => mockTrigger(...args),
}));

const mockToast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('../../public/src/lib/toast', () => ({ toast: mockToast }));

const TODAY = new Date('2026-10-07');
// Testing Library normalise les espaces du DOM : on normalise donc aussi l'attendu.
const eur = (n: number) => formatCurrency(n, 'EUR').replace(/\s+/g, ' ');

const bien: BienImmobilier = {
  adresse: '10 rue de la Paix',
  codePostal: '44000',
  ville: 'Nantes',
  nature: 'maison',
  surface: 100,
  pieces: 5,
  garages: 1,
  parkings: 0,
  jardin: false,
  terrasse: false,
  balcon: false,
  prixAchat: 250000,
  fraisNotaire: 20000,
  travaux: 30000,
};

const okEstimation: EstimationImmobiliere = {
  statut: 'OK',
  date: '2026-10-03',
  valeur: 344025,
  basse: 302000,
  haute: 396000,
  prixM2: 3300,
  echantillon: 170,
  confiance: 'haute',
  millesime: '2024',
  echelle: 'communes',
  multiplicateur: 0.9,
  ratioReindexation: 1.0425,
  ajustements: [
    { code: 'ENERGY_G', facteur: -0.1, montant: -33000 },
    { code: 'GARAGE', m2: 12, montant: 39600 },
  ],
};

const credit: Credit = {
  id: 'c1',
  nom: 'Crédit maison',
  capitalInitial: 200000,
  tauxAnnuel: 1.5,
  dureeMois: 240,
  dateDebut: '2020-01-01',
};

const placement = (
  overrides: Partial<PropertyValuationPlacement> = {},
): PropertyValuationPlacement => ({
  id: 'bien-1',
  montant: 344025,
  bien,
  estimation: okEstimation,
  modeValorisation: 'estime',
  ...overrides,
});

describe('PropertyValuationCard', () => {
  beforeEach(() => {
    mockTrigger.mockReset();
    mockToast.success.mockReset();
    mockToast.error.mockReset();
  });

  it('affiche la valeur estimée, la fourchette, la confiance et le millésime', () => {
    render(<PropertyValuationCard placement={placement()} today={TODAY} />);

    expect(screen.getByText(eur(344025))).toBeInTheDocument();
    expect(screen.getByText(`Fourchette : ${eur(302000)} à ${eur(396000)}`)).toBeInTheDocument();
    expect(screen.getByText('Confiance élevée')).toBeInTheDocument();
    expect(screen.getByText('170 ventes en 2024')).toBeInTheDocument();
    expect(screen.queryByText('médiane départementale')).not.toBeInTheDocument();
  });

  it("signale l'échelle départementale", () => {
    const estimation = {
      ...okEstimation,
      echelle: 'departements' as const,
      confiance: 'faible' as const,
    };
    render(<PropertyValuationCard placement={placement({ estimation })} today={TODAY} />);
    expect(screen.getByText('médiane départementale')).toBeInTheDocument();
    expect(screen.getByText('Confiance faible')).toBeInTheDocument();
  });

  it('signale le repli sur les ventes DVF', () => {
    const dvf = { ...okEstimation, source: 'dvf' as const };
    const { unmount } = render(
      <PropertyValuationCard placement={placement({ estimation: dvf })} today={TODAY} />,
    );
    expect(screen.getByText(/ventes DVF brutes/)).toBeInTheDocument();
    unmount();
    render(<PropertyValuationCard placement={placement()} today={TODAY} />);
    expect(screen.queryByText(/ventes DVF brutes/)).not.toBeInTheDocument();
  });

  it('indique la source Cerema, et rien pour une estimation sans source (ancienne)', () => {
    const { unmount } = render(
      <PropertyValuationCard
        placement={placement({ estimation: { ...okEstimation, source: 'cerema' } })}
        today={TODAY}
      />,
    );
    expect(screen.getByText('Source : indicateurs Cerema (DV3F)')).toBeInTheDocument();
    unmount();
    render(<PropertyValuationCard placement={placement()} today={TODAY} />);
    expect(screen.queryByText(/Source :/)).not.toBeInTheDocument();
  });

  it('détaille la construction du chiffre : prix au m², ajustements, multiplicateur, INSEE', () => {
    render(<PropertyValuationCard placement={placement()} today={TODAY} />);

    expect(screen.queryByText('DPE G (-10,0 %)')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Comment ce chiffre est construit' }));

    expect(screen.getByText(`Prix médian ${eur(3300)}/m² × 100 m²`)).toBeInTheDocument();
    expect(screen.getByText(eur(330000))).toBeInTheDocument();
    expect(screen.getByText('DPE G (-10,0 %)')).toBeInTheDocument();
    expect(screen.getByText('Garage (12 m² équivalents)')).toBeInTheDocument();
    expect(screen.getByText(eur(-33000))).toBeInTheDocument();
    expect(screen.getByText('+ ' + eur(39600))).toBeInTheDocument();
    expect(screen.getByText('× 0,90')).toBeInTheDocument();
    expect(screen.getByText('× 1,0425')).toBeInTheDocument();
    expect(screen.getByText(/heuristiques, non calibrées sur des ventes/)).toBeInTheDocument();
  });

  it('indique que la réindexation INSEE est absente quand l’indice était indisponible', () => {
    const { ratioReindexation: _omit, ...sansRatio } = okEstimation;
    render(
      <PropertyValuationCard placement={placement({ estimation: sansRatio })} today={TODAY} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Comment ce chiffre est construit' }));
    expect(screen.getByText(/Réindexation INSEE non appliquée/)).toBeInTheDocument();
  });

  it("calcule l'équité nette avec le crédit associé", () => {
    const crd = capitalRestantDu(credit, TODAY);
    render(<PropertyValuationCard placement={placement()} credit={credit} today={TODAY} />);

    expect(screen.getByText('Équité nette')).toBeInTheDocument();
    expect(screen.getByText(eur(344025 - crd))).toBeInTheDocument();
    expect(screen.getByText(`Capital restant dû : ${eur(crd)}`)).toBeInTheDocument();
  });

  it("n'affiche pas d'équité nette sans crédit associé", () => {
    render(<PropertyValuationCard placement={placement()} today={TODAY} />);
    expect(screen.queryByText('Équité nette')).not.toBeInTheDocument();
  });

  it("affiche la plus-value latente par rapport au coût d'achat", () => {
    render(<PropertyValuationCard placement={placement()} today={TODAY} />);
    // coût = 250 000 + 20 000 + 30 000 = 300 000 → +44 025 (+14,7 %)
    expect(screen.getByText('Plus-value latente')).toBeInTheDocument();
    expect(screen.getByText('+ ' + eur(44025))).toBeInTheDocument();
    expect(screen.getByText('+14,7 %')).toBeInTheDocument();
    expect(screen.getByText(`par rapport au coût d'achat (${eur(300000)})`)).toBeInTheDocument();
  });

  it('en valorisation manuelle, la valeur retenue est celle saisie', () => {
    render(
      <PropertyValuationCard
        placement={placement({ modeValorisation: 'manuel', montant: 320000 })}
        today={TODAY}
      />,
    );
    expect(
      screen.getByText(/la valeur retenue est celle que vous avez saisie/),
    ).toBeInTheDocument();
    expect(screen.getByText('Valeur retenue')).toBeInTheDocument();
    expect(screen.getByText(eur(320000))).toBeInTheDocument();
    expect(screen.getByText(eur(344025))).toBeInTheDocument(); // l'estimation reste visible
  });

  it("invite à réestimer quand il n'y a pas encore d'estimation", () => {
    render(
      <PropertyValuationCard placement={placement({ estimation: undefined })} today={TODAY} />,
    );
    expect(screen.getByText(/Aucune estimation pour le moment/)).toBeInTheDocument();
    expect(screen.queryByText('Valeur estimée')).not.toBeInTheDocument();
  });

  it.each([
    ['INCOMPLETE_DATA', /Données incomplètes/],
    ['GEOCODING_FAILED', /Adresse introuvable/],
    [
      'UNSUPPORTED_AREA',
      /Alsace-Moselle ou Mayotte : DVF ne couvre pas ce territoire, passez en mode manuel/,
    ],
    ['NO_COMPARABLE_DATA', /Aucune vente comparable/],
    ['PROVIDER_UNAVAILABLE', /Source de données indisponible : la dernière valeur est conservée/],
  ] as const)('traduit le statut %s et affiche la valeur retenue', (statut, message) => {
    render(
      <PropertyValuationCard
        placement={placement({ estimation: { statut, date: '2026-10-03' }, montant: 280000 })}
        today={TODAY}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(message);
    expect(screen.queryByText('Valeur estimée')).not.toBeInTheDocument();
    expect(screen.getByText('Valeur retenue')).toBeInTheDocument();
    expect(screen.getByText(eur(280000))).toBeInTheDocument();
  });

  it('« Réestimer » déclenche le workflow avec l’id du bien et confirme par un toast', async () => {
    mockTrigger.mockResolvedValue({ status: 'success' });
    render(<PropertyValuationCard placement={placement()} today={TODAY} />);

    fireEvent.click(screen.getByRole('button', { name: 'Réestimer' }));

    await waitFor(() => expect(mockToast.success).toHaveBeenCalledTimes(1));
    expect(mockTrigger).toHaveBeenCalledWith('estimate-property', { placementId: 'bien-1' });
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it('signale par un toast d’erreur un dispatch en échec', async () => {
    mockTrigger.mockResolvedValue({ error: 'boom' });
    render(<PropertyValuationCard placement={placement()} today={TODAY} />);

    fireEvent.click(screen.getByRole('button', { name: 'Réestimer' }));

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledTimes(1));
    expect(mockToast.success).not.toHaveBeenCalled();
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <PropertyValuationCard placement={placement()} credit={credit} today={TODAY} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Comment ce chiffre est construit' }));
    expect(await axe(container)).toHaveNoViolations();
  }, 30_000);
});
