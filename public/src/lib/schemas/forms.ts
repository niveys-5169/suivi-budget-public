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
  type: z.enum(['cash', 'savings', 'market', 'retirement', 'other']),
  montant: finiteNumber('Valeur requise'),
  compte: z.string(),
});

export type PlacementFormValues = z.infer<typeof placementFormSchema>;

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
