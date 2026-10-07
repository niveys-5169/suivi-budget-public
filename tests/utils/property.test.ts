import { describe, it, expect } from 'vitest';
import {
  buildBien,
  buildPropertyPayload,
  coutAchat,
  equiteNette,
  plusValueLatente,
} from '../../public/src/utils/property';
import { capitalRestantDu } from '../../public/src/utils/creditSchedule';
import type { BienImmobilier, Credit } from '../../public/src/types/banking.types';
import type { PropertyFormValues } from '../../public/src/lib/schemas/forms';

const credit: Credit = {
  id: 'c1',
  nom: 'Crédit maison',
  capitalInitial: 200000,
  tauxAnnuel: 1.5,
  dureeMois: 240,
  dateDebut: '2020-01-01',
};

const values = (overrides: Partial<PropertyFormValues> = {}): PropertyFormValues => ({
  nom: 'Appartement Nantes',
  owner: 'Nicolas',
  adresse: '10 rue de la Paix',
  codePostal: '44000',
  ville: 'Nantes',
  nature: 'appartement',
  surface: 65,
  pieces: 3,
  sallesDeBain: null,
  terrain: null,
  etage: 2,
  nbEtages: 5,
  ascenseur: true,
  garages: 0,
  parkings: 1,
  jardin: false,
  terrasse: false,
  balcon: true,
  dpe: '',
  anneeConstruction: null,
  prixAchat: 250000,
  fraisNotaire: 20000,
  fraisAgence: null,
  travaux: 10000,
  modeValorisation: 'estime',
  montant: null,
  creditId: '',
  ...overrides,
});

describe('coutAchat', () => {
  it("somme le prix, les frais et les travaux, en ignorant ce qui n'est pas renseigné", () => {
    expect(coutAchat({ prixAchat: 250000, fraisNotaire: 20000, travaux: 10000 })).toBe(280000);
    expect(coutAchat({})).toBe(0);
    expect(coutAchat(undefined)).toBe(0);
  });
});

describe('equiteNette', () => {
  const today = new Date('2026-06-15');

  it('retire le capital restant dû du crédit associé', () => {
    const crd = capitalRestantDu(credit, today);
    expect(crd).toBeGreaterThan(0);
    expect(equiteNette(300000, credit, today)).toBeCloseTo(300000 - crd, 6);
  });

  it('vaut la valeur du bien sans crédit', () => {
    expect(equiteNette(300000, undefined, today)).toBe(300000);
  });
});

describe('plusValueLatente', () => {
  it("compare la valeur au coût d'achat total", () => {
    const pv = plusValueLatente(350000, { prixAchat: 250000, fraisNotaire: 20000, travaux: 30000 });
    expect(pv?.montant).toBe(50000);
    expect(pv?.pct).toBeCloseTo((50000 / 300000) * 100, 6);
  });

  it("est nulle sans coût d'achat renseigné", () => {
    expect(plusValueLatente(350000, {})).toBeNull();
  });
});

describe('buildBien', () => {
  it('omet les champs vides (Firestore refuse undefined) et garde les booléens à false', () => {
    const bien = buildBien(values());
    expect(bien).not.toHaveProperty('sallesDeBain');
    expect(bien).not.toHaveProperty('fraisAgence');
    expect(bien).not.toHaveProperty('dpe');
    expect(bien).not.toHaveProperty('terrain');
    expect(bien.jardin).toBe(false);
    expect(bien.garages).toBe(0);
    expect(Object.values(bien).every((v) => v !== undefined && v !== null)).toBe(true);
  });

  it("n'écrit que les champs propres à la nature du bien", () => {
    const appartement = buildBien(values({ terrain: 800 }));
    expect(appartement).not.toHaveProperty('terrain');
    expect(appartement).toMatchObject({ etage: 2, nbEtages: 5, ascenseur: true });

    const maison = buildBien(values({ nature: 'maison', terrain: 800 }));
    expect(maison.terrain).toBe(800);
    expect(maison).not.toHaveProperty('etage');
    expect(maison).not.toHaveProperty('ascenseur');
  });

  it("conserve le cache de géocodage quand l'adresse est inchangée", () => {
    const previous = {
      ...buildBien(values()),
      codeInsee: '44109',
      lat: 47.2,
      lon: -1.55,
      scoreGeocodage: 0.91,
    };
    const bien = buildBien(values({ surface: 70 }), previous);
    expect(bien).toMatchObject({ codeInsee: '44109', lat: 47.2, lon: -1.55, scoreGeocodage: 0.91 });
    expect(bien.surface).toBe(70);
  });

  it.each([
    ['adresse', { adresse: '12 rue de la Paix' }],
    ['code postal', { codePostal: '44100' }],
    ['ville', { ville: 'Rezé' }],
  ])('vide le cache de géocodage quand %s change', (_label, change) => {
    const previous: BienImmobilier = {
      ...buildBien(values()),
      codeInsee: '44109',
      lat: 47.2,
      lon: -1.55,
      scoreGeocodage: 0.91,
    };
    const bien = buildBien(values(change), previous);
    expect(bien).not.toHaveProperty('codeInsee');
    expect(bien).not.toHaveProperty('lat');
    expect(bien).not.toHaveProperty('lon');
    expect(bien).not.toHaveProperty('scoreGeocodage');
  });
});

describe('buildPropertyPayload', () => {
  it("en mode estimé, prend le coût d'achat tant qu'aucune valeur n'existe", () => {
    const payload = buildPropertyPayload(values());
    expect(payload).toMatchObject({
      type: 'immobilier',
      modeValorisation: 'estime',
      montant: 280000,
      owner: 'Nicolas',
    });
  });

  it('en mode estimé, conserve la valeur écrite par le job', () => {
    expect(buildPropertyPayload(values(), { montant: 312000 }).montant).toBe(312000);
  });

  it('en mode manuel, utilise la valeur saisie', () => {
    const payload = buildPropertyPayload(values({ modeValorisation: 'manuel', montant: 295000 }), {
      montant: 312000,
    });
    expect(payload.montant).toBe(295000);
  });

  it("transmet l'identifiant du crédit (vide = aucun)", () => {
    expect(buildPropertyPayload(values({ creditId: 'c1' })).creditId).toBe('c1');
    expect(buildPropertyPayload(values()).creditId).toBe('');
  });
});
