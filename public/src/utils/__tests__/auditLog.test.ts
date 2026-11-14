import { describe, it, expect } from 'vitest';
import { auditLabel, describeChange, describeEntry, diffChanges, toAuditValue } from '../auditLog';
import type { AuditEntry } from '../../types/banking.types';

describe('toAuditValue', () => {
  it('garde les valeurs simples et réduit le reste à du texte', () => {
    expect(toAuditValue('Courses')).toBe('Courses');
    expect(toAuditValue(-12.5)).toBe(-12.5);
    expect(toAuditValue(false)).toBe(false);
    expect(toAuditValue(null)).toBeNull();
    expect(toAuditValue(undefined)).toBeNull();
    expect(toAuditValue([{ a: 1 }])).toBe('[{"a":1}]');
    expect(toAuditValue({ toDate: () => new Date(Date.UTC(2026, 10, 14, 9, 30)) })).toBe(
      '2026-11-14T09:30:00.000Z',
    );
  });

  it('tronque les valeurs longues', () => {
    expect(String(toAuditValue('x'.repeat(500))).length).toBeLessThanOrEqual(300);
  });
});

describe('diffChanges', () => {
  it('ne garde que les champs réellement modifiés, avec ancienne et nouvelle valeur', () => {
    expect(
      diffChanges(
        { categorie: 'Divers', montant: -20, libelle: 'CB CARREFOUR' },
        { categorie: 'Courses', montant: -20 },
      ),
    ).toEqual([{ field: 'categorie', from: 'Divers', to: 'Courses' }]);
  });

  it("sans état précédent connu, n'indique que la nouvelle valeur", () => {
    expect(diffChanges(undefined, { pointe: true })).toEqual([{ field: 'pointe', to: true }]);
  });

  it('ignore les champs techniques et les valeurs vides équivalentes', () => {
    expect(
      diffChanges(
        { commentaire: undefined },
        { commentaire: '', updatedAt: 'ts', createdAt: 'ts', importedAt: 'ts' },
      ),
    ).toEqual([]);
  });

  it('traite deleteField comme un effacement et ignore les autres sentinelles', () => {
    expect(
      diffChanges(
        { moisAttendus: [3] },
        { moisAttendus: { _methodName: 'deleteField' }, at: { _methodName: 'serverTimestamp' } },
      ),
    ).toEqual([{ field: 'moisAttendus', from: '[3]', to: null }]);
  });
});

describe('auditLabel', () => {
  it('prend le libellé du domaine dans le patch, sinon dans le document', () => {
    expect(auditLabel('transaction', { libelle: 'CB CARREFOUR' }, { categorie: 'Courses' })).toBe(
      'CB CARREFOUR',
    );
    expect(auditLabel('budget', undefined, { categorie: 'Courses' })).toBe('Courses');
    expect(auditLabel('recurrence', { label: 'Netflix' }, undefined)).toBe('Netflix');
    expect(auditLabel('transaction', undefined, undefined)).toBe('');
  });
});

describe('affichage', () => {
  it('décrit un champ modifié en français', () => {
    expect(describeChange({ field: 'categorie', from: 'Divers', to: 'Courses' })).toBe(
      'Catégorie : Divers → Courses',
    );
    expect(describeChange({ field: 'pointe', to: true })).toBe('Pointage : oui');
    expect(describeChange({ field: 'pointe', from: true, to: false })).toBe('Pointage : oui → non');
    expect(describeChange({ field: 'commentaire', from: 'x', to: null })).toBe(
      'Commentaire : x → (vide)',
    );
    expect(describeChange({ field: 'skippedPeriod', from: '2026-11' })).toBe(
      'Mois ignoré : 2026-11 retiré',
    );
    expect(describeChange({ field: 'champInconnu', to: 1 })).toBe('champInconnu : 1');
  });

  it("résume une ligne : l'action, puis les champs", () => {
    const base: AuditEntry = {
      id: '1',
      at: null,
      byEmail: 'a@example.com',
      domain: 'transaction',
      action: 'update',
      path: 'transactions/t1',
      docId: 't1',
      label: 'CB CARREFOUR',
      changes: [
        { field: 'categorie', from: 'Divers', to: 'Courses' },
        { field: 'pointe', to: true },
      ],
    };
    expect(describeEntry(base)).toBe('Catégorie : Divers → Courses · Pointage : oui');
    expect(
      describeEntry({ ...base, action: 'delete', changes: [{ field: 'montant', from: -20 }] }),
    ).toBe('Suppression · Montant : -20 retiré');
    expect(describeEntry({ ...base, action: 'create', changes: [] })).toBe('Création');
  });
});
