import { z } from 'zod';

const requiredString = (msg: string) => z.string().trim().min(1, msg);

const dateISO = z
  .string()
  .min(1, 'Date requise')
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide');

const monthKey = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Format mois invalide (ex. '2026-05')")
  .or(z.literal(''));

const finiteNumber = (msg = 'Montant invalide') =>
  z.number({ message: msg }).refine((v) => Number.isFinite(v), { message: msg });

export const transactionFormSchema = z.object({
  date: dateISO,
  compte: requiredString('Compte requis'),
  libelle: requiredString('Libellé requis'),
  montant: finiteNumber('Montant requis'),
  categorie: z.string(),
  moisAffectation: monthKey,
  pointe: z.boolean(),
  commentaire: z.string(),
});

export type TransactionFormValues = z.infer<typeof transactionFormSchema>;

export const placementFormSchema = z.object({
  nom: requiredString("Nom de l'actif requis"),
  owner: requiredString('Propriétaire requis'),
  type: z.enum(['cash', 'savings', 'market', 'retirement', 'immobilier', 'other']),
  montant: finiteNumber('Valeur requise'),
  compte: z.string(),
});

export type PlacementFormValues = z.infer<typeof placementFormSchema>;

/** Nombre facultatif : `null` = champ laissé vide. */
const optionalAmount = (msg: string) =>
  z
    .number({ message: msg })
    .refine((v) => Number.isFinite(v) && v >= 0, { message: msg })
    .nullable();

const nonNegativeInt = (msg: string) => z.number({ message: msg }).int(msg).min(0, msg);

export const propertyFormSchema = z
  .object({
    nom: requiredString('Nom du bien requis'),
    owner: requiredString('Propriétaire requis'),
    adresse: requiredString('Adresse requise'),
    codePostal: z
      .string()
      .trim()
      .regex(/^\d{5}$/, 'Code postal invalide (5 chiffres)'),
    ville: requiredString('Ville requise'),
    nature: z.enum(['appartement', 'maison']),
    surface: finiteNumber('Surface requise').refine((v) => v > 0, {
      message: 'La surface doit être > 0',
    }),
    pieces: z.number({ message: 'Nombre de pièces requis' }).int().min(1, 'Au moins 1 pièce'),
    sallesDeBain: optionalAmount('Nombre invalide'),
    terrain: optionalAmount('Surface invalide'),
    etage: optionalAmount('Étage invalide'),
    nbEtages: optionalAmount("Nombre d'étages invalide"),
    ascenseur: z.boolean(),
    garages: nonNegativeInt('Nombre invalide'),
    parkings: nonNegativeInt('Nombre invalide'),
    jardin: z.boolean(),
    terrasse: z.boolean(),
    balcon: z.boolean(),
    dpe: z.enum(['', 'A', 'B', 'C', 'D', 'E', 'F', 'G']),
    anneeConstruction: optionalAmount('Année invalide'),
    prixAchat: optionalAmount('Montant invalide'),
    fraisNotaire: optionalAmount('Montant invalide'),
    fraisAgence: optionalAmount('Montant invalide'),
    travaux: optionalAmount('Montant invalide'),
    modeValorisation: z.enum(['estime', 'manuel']),
    /** Valeur saisie, utilisée seulement en mode `manuel`. */
    montant: optionalAmount('Montant invalide'),
    /** Id du crédit associé ; vide = aucun. */
    creditId: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.modeValorisation === 'manuel' && !data.montant) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['montant'],
        message: 'Valeur requise en mode manuel',
      });
    }
  });

export type PropertyFormValues = z.infer<typeof propertyFormSchema>;

export const creditFormSchema = z.object({
  nom: requiredString('Nom du crédit requis'),
  owner: z.string(),
  capitalInitial: finiteNumber('Capital requis').refine((v) => v > 0, {
    message: 'Le capital doit être > 0',
  }),
  tauxAnnuel: finiteNumber('Taux requis').refine((v) => v >= 0, {
    message: 'Le taux doit être ≥ 0',
  }),
  dureeMois: z
    .number({ message: 'Durée requise' })
    .int('Durée entière requise')
    .min(1, 'Durée ≥ 1 mois'),
  dateDebut: dateISO,
  assuranceMensuelle: finiteNumber('Assurance invalide').refine((v) => v >= 0, {
    message: "L'assurance doit être ≥ 0",
  }),
  commentaire: z.string(),
});

export type CreditFormValues = z.infer<typeof creditFormSchema>;

export const budgetFormSchema = z
  .object({
    nom: requiredString('Désignation requise'),
    categorie: requiredString('Catégorie requise'),
    type: z.enum(['mensuel', 'annuel', 'ponctuel']),
    montant: finiteNumber('Montant requis').refine((v) => v >= 0, {
      message: 'Le montant doit être ≥ 0',
    }),
    actif: z.boolean(),
    sens: z.enum(['auto', 'entree', 'sortie']),
    moisAttendus: z.array(z.number().int().min(1).max(12)),
    compte: z.string().nullable(),
    periode: z.object({
      type: z.enum(['mois_courant', 'annee_civile', 'custom']),
      debut: z.string().optional(),
      fin: z.string().optional(),
    }),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'ponctuel') {
      if (!data.periode.debut) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['periode', 'debut'],
          message: 'Date de début requise',
        });
      }
      if (!data.periode.fin) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['periode', 'fin'],
          message: 'Date de fin requise',
        });
      }
    }
  });

export type BudgetFormValues = z.infer<typeof budgetFormSchema>;

const ravSalaryProvision = z.object({
  montant: z.number().refine((v) => Number.isFinite(v) && v >= 0, {
    message: 'Montant invalide',
  }),
  categorie: z.string(),
});

export const ravConfigSchema = z.object({
  revenu_mensuel_net: z.number().nullable(),
  provision_salaires: z.record(z.string(), ravSalaryProvision).optional(),
  revenu_categories: z.array(z.string()),
  depense_categories: z.array(z.string()),
  included_accounts: z.array(z.string()),
});

export type RavConfigFormValues = z.infer<typeof ravConfigSchema>;
