import type { BienImmobilier, Credit } from '../types/banking.types';
import type { PropertyFormValues } from '../lib/schemas/forms';
import type { AddPlacementInput } from '../hooks/usePlacements';
import { capitalRestantDu } from './creditSchedule';

/** Coût d'acquisition : prix d'achat + frais de notaire et d'agence + travaux. */
export function coutAchat(bien: Partial<BienImmobilier> | undefined): number {
  if (!bien) return 0;
  return (
    (bien.prixAchat ?? 0) + (bien.fraisNotaire ?? 0) + (bien.fraisAgence ?? 0) + (bien.travaux ?? 0)
  );
}

/** Valeur du bien moins le capital restant dû du crédit associé (0 sans crédit). */
export function equiteNette(valeur: number, credit: Credit | undefined, today: Date): number {
  return valeur - (credit ? capitalRestantDu(credit, today) : 0);
}

/** Plus-value latente par rapport au coût d'achat ; `null` si aucun coût n'est renseigné. */
export function plusValueLatente(
  valeur: number,
  bien: Partial<BienImmobilier> | undefined,
): { montant: number; pct: number } | null {
  const cout = coutAchat(bien);
  if (cout <= 0) return null;
  const montant = valeur - cout;
  return { montant, pct: (montant / cout) * 100 };
}

type AdresseBien = Pick<BienImmobilier, 'adresse' | 'codePostal' | 'ville'>;

const sameAddress = (a: AdresseBien, b: AdresseBien): boolean =>
  a.adresse.trim() === b.adresse.trim() &&
  a.codePostal.trim() === b.codePostal.trim() &&
  a.ville.trim() === b.ville.trim();

/** Retire les champs `null`/vides : Firestore refuse `undefined`. */
const defined = <T extends object>(obj: T): T =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== ''),
  ) as T;

/**
 * Descriptif du bien à écrire. Le cache de géocodage (`codeInsee`, `lat`, `lon`,
 * `scoreGeocodage`) n'est conservé que si l'adresse n'a pas changé : sinon il est
 * vidé, ce qui force un nouveau géocodage au prochain calcul.
 */
export function buildBien(values: PropertyFormValues, previous?: BienImmobilier): BienImmobilier {
  const appartement = values.nature === 'appartement';
  const bien = defined({
    adresse: values.adresse.trim(),
    codePostal: values.codePostal.trim(),
    ville: values.ville.trim(),
    nature: values.nature,
    surface: values.surface,
    pieces: values.pieces,
    sallesDeBain: values.sallesDeBain,
    terrain: appartement ? null : values.terrain,
    etage: appartement ? values.etage : null,
    nbEtages: appartement ? values.nbEtages : null,
    ascenseur: appartement ? values.ascenseur : null,
    garages: values.garages,
    parkings: values.parkings,
    jardin: values.jardin,
    terrasse: values.terrasse,
    balcon: values.balcon,
    dpe: values.dpe,
    anneeConstruction: values.anneeConstruction,
    prixAchat: values.prixAchat,
    fraisNotaire: values.fraisNotaire,
    fraisAgence: values.fraisAgence,
    travaux: values.travaux,
  }) as BienImmobilier;

  if (previous && sameAddress(previous, bien)) {
    const { codeInsee, lat, lon, scoreGeocodage } = previous;
    return { ...bien, ...defined({ codeInsee, lat, lon, scoreGeocodage }) };
  }
  return bien;
}

/**
 * Document `placements` d'un bien. En mode `estime`, `montant` appartient au job
 * d'estimation : on conserve la valeur courante, ou le coût d'achat tant qu'aucune
 * estimation n'a abouti.
 */
export function buildPropertyPayload(
  values: PropertyFormValues,
  previous?: { montant?: number; bien?: BienImmobilier },
): AddPlacementInput {
  const bien = buildBien(values, previous?.bien);
  const montant =
    values.modeValorisation === 'manuel'
      ? (values.montant ?? 0)
      : previous?.montant || coutAchat(bien);
  return {
    nom: values.nom.trim(),
    owner: values.owner,
    type: 'immobilier',
    montant,
    modeValorisation: values.modeValorisation,
    creditId: values.creditId,
    bien,
  };
}
