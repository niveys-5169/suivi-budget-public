/**
 * Tests des règles Firestore (firestore.rules) contre l'émulateur.
 * Lancer avec `npm run test:rules` (démarre et arrête l'émulateur).
 *
 * Les chemins couvrent toutes les collections lues ou écrites par le front
 * (public/src) : un refus ici casserait une fonctionnalité en prod.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

const OWNER_UID = 'owner-uid';
const OWNER = { email: 'niveys@gmail.com', email_verified: true };
const GUEST_EMAIL = 'invite@example.com';

const PRIVATE_BANK_PATHS = [
  'eb_sessions/c',
  'eb_pending_auth/state',
  'bank_observations/o',
  'bank_balance_sources/b',
  'bank_balance_observations/b',
  'bank_locks/sync',
  'bank_canonical_aliases/a',
  'bank_merge_history/h',
];
const READ_ONLY_BANK_PATHS = [
  'bank_connections/c',
  'bank_reports/reconciliation',
  'bank_sync_runs/r',
  'bank_runtime/config',
  'recurring_expense_settings/r1',
];

const FRONT_PATHS = [
  'account_balance_history/h1',
  'account_balances/BforBank',
  'auto_categorization_rules/r1',
  'budgets/Courses',
  'budgets_annual_defaults/Courses',
  'budgets_monthly/2026-09_Courses',
  'config/advanced',
  'deleted_transactions/tx1',
  'gmail_excluded/m1',
  'gmail_messages/m1',
  'linxo_category_mappings/c1',
  'metadata/rav_config',
  'patrimoine_snapshots/2026-09-23',
  'placement_history/p1',
  'placements/p1',
  'recurrences/r1',
  'reparse_jobs/j1',
  'savings_balances/livret',
  'transactions/tx1',
];

// Réglages privés (clés d'API IA, GitHub, conversations, préférences) :
// réservés au compte autorisé dont c'est l'UID.
const GUEST_UID = 'guest';
const privatePaths = (uid: string) => [
  `user_settings/${uid}`,
  `users/${uid}/preferences/ui`,
  `users/${uid}/ai_sessions/s1`,
];

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-aurum-rules',
    firestore: { rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8') },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const path of [...FRONT_PATHS, ...privatePaths(OWNER_UID), ...privatePaths(GUEST_UID)]) {
      await setDoc(doc(ctx.firestore(), path), { seed: true });
    }
    await setDoc(doc(ctx.firestore(), `access_allowlist/${GUEST_EMAIL}`), { seed: true });
  });
});

const owner = () => env.authenticatedContext(OWNER_UID, OWNER).firestore();
const preview = () => env.authenticatedContext('preview-uid', { preview: true }).firestore();
const stranger = () =>
  env
    .authenticatedContext('stranger', { email: 'autre@gmail.com', email_verified: true })
    .firestore();
const unverifiedOwner = () =>
  env
    .authenticatedContext('spoof', { email: 'niveys@gmail.com', email_verified: false })
    .firestore();
const guest = () =>
  env.authenticatedContext(GUEST_UID, { email: GUEST_EMAIL, email_verified: true }).firestore();
const unverifiedGuest = () =>
  env
    .authenticatedContext('guest-spoof', { email: GUEST_EMAIL, email_verified: false })
    .firestore();
const anonymous = () => env.unauthenticatedContext().firestore();

describe.each(PRIVATE_BANK_PATHS)('donnée bancaire privée %s', (path) => {
  it('même le propriétaire ne peut ni lire ni écrire ni supprimer, y compris une sous-collection', async () => {
    for (const target of [path, `${path}/nested/doc`]) {
      await assertFails(getDoc(doc(owner(), target)));
      await assertFails(setDoc(doc(owner(), target), { secret: true }));
      await assertFails(deleteDoc(doc(owner(), target)));
    }
  });
});

describe.each(READ_ONLY_BANK_PATHS)('résultat bancaire %s', (path) => {
  it('lecture propriétaire uniquement, toute écriture client refusée', async () => {
    await assertSucceeds(getDoc(doc(owner(), path)));
    await assertFails(setDoc(doc(owner(), path), { status: 'forged' }));
    await assertFails(deleteDoc(doc(owner(), path)));
    await assertFails(getDoc(doc(stranger(), path)));
    await assertFails(getDoc(doc(anonymous(), path)));
    await assertFails(getDoc(doc(preview(), path)));
  });
});

describe.each(FRONT_PATHS)('%s', (path) => {
  it('propriétaire : lecture, écriture, suppression', async () => {
    await assertSucceeds(getDoc(doc(owner(), path)));
    await assertSucceeds(setDoc(doc(owner(), path), { v: 1 }));
    await assertSucceeds(deleteDoc(doc(owner(), path)));
  });

  it('compte de la liste access_allowlist : mêmes droits, sauf email non vérifié', async () => {
    await assertFails(getDoc(doc(unverifiedGuest(), path)));
    await assertSucceeds(getDoc(doc(guest(), path)));
    await assertSucceeds(setDoc(doc(guest(), path), { v: 1 }));
    await assertSucceeds(deleteDoc(doc(guest(), path)));
  });

  it('ancien claim preview : refusé (accès retiré)', async () => {
    await assertFails(getDoc(doc(preview(), path)));
    await assertFails(setDoc(doc(preview(), path), { v: 1 }));
    await assertFails(deleteDoc(doc(preview(), path)));
  });

  it('autre compte vérifié : refusé', async () => {
    await assertFails(getDoc(doc(stranger(), path)));
    await assertFails(setDoc(doc(stranger(), path), { v: 1 }));
  });

  it('email du propriétaire non vérifié : refusé', async () => {
    await assertFails(getDoc(doc(unverifiedOwner(), path)));
    await assertFails(setDoc(doc(unverifiedOwner(), path), { v: 1 }));
  });

  it('non authentifié : refusé', async () => {
    await assertFails(getDoc(doc(anonymous(), path)));
    await assertFails(setDoc(doc(anonymous(), path), { v: 1 }));
  });
});

describe('réglages privés par compte (users, user_settings)', () => {
  it.each(privatePaths(OWNER_UID))(
    'propriétaire : accès à ses propres réglages %s',
    async (path) => {
      await assertSucceeds(getDoc(doc(owner(), path)));
      await assertSucceeds(setDoc(doc(owner(), path), { v: 1 }));
      await assertSucceeds(deleteDoc(doc(owner(), path)));
    },
  );

  it.each(privatePaths(GUEST_UID))(
    'compte invité : accès à ses propres réglages %s',
    async (path) => {
      await assertFails(getDoc(doc(unverifiedGuest(), path)));
      await assertSucceeds(getDoc(doc(guest(), path)));
      await assertSucceeds(setDoc(doc(guest(), path), { v: 1 }));
      await assertSucceeds(deleteDoc(doc(guest(), path)));
    },
  );

  it.each(privatePaths(OWNER_UID))(
    'compte invité : aucun accès aux réglages du propriétaire %s',
    async (path) => {
      await assertFails(getDoc(doc(guest(), path)));
      await assertFails(setDoc(doc(guest(), path), { v: 1 }));
      await assertFails(deleteDoc(doc(guest(), path)));
    },
  );

  it.each(privatePaths(GUEST_UID))(
    "propriétaire : aucun accès aux réglages de l'invité %s",
    async (path) => {
      await assertFails(getDoc(doc(owner(), path)));
      await assertFails(setDoc(doc(owner(), path), { v: 1 }));
    },
  );

  it.each([...privatePaths(OWNER_UID), ...privatePaths(GUEST_UID)])(
    'autres comptes et anonymes : refusés %s',
    async (path) => {
      await assertFails(getDoc(doc(stranger(), path)));
      await assertFails(getDoc(doc(preview(), path)));
      await assertFails(getDoc(doc(anonymous(), path)));
      await assertFails(setDoc(doc(anonymous(), path), { v: 1 }));
    },
  );

  it('compte invité : ne peut pas lister user_settings', async () => {
    await assertFails(getDocs(collection(guest(), 'user_settings')));
  });
});

describe('access_allowlist', () => {
  it('aucun accès client, même pour le propriétaire ou un compte listé', async () => {
    for (const db of [owner(), guest(), stranger()]) {
      await assertFails(getDoc(doc(db, `access_allowlist/${GUEST_EMAIL}`)));
      await assertFails(setDoc(doc(db, 'access_allowlist/autre@gmail.com'), { v: 1 }));
      await assertFails(deleteDoc(doc(db, `access_allowlist/${GUEST_EMAIL}`)));
    }
  });
});

describe('audit_log', () => {
  const entry = (byEmail: string, byUid: string): Record<string, unknown> => ({
    at: serverTimestamp(),
    byEmail,
    byUid,
    domain: 'transaction',
    action: 'update',
    path: 'transactions/tx1',
    docId: 'tx1',
    label: 'CB CARREFOUR',
    changes: [{ field: 'categorie', from: 'Divers', to: 'Courses' }],
  });
  const guestEntry = (override: Record<string, unknown> = {}) => ({
    ...entry(GUEST_EMAIL, GUEST_UID),
    ...override,
  });

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'audit_log/e1'), { byEmail: GUEST_EMAIL, at: new Date() });
    });
  });

  it('comptes autorisés : lecture, et création signée de leur propre email', async () => {
    await assertSucceeds(getDoc(doc(owner(), 'audit_log/e1')));
    await assertSucceeds(getDoc(doc(guest(), 'audit_log/e1')));
    await assertSucceeds(setDoc(doc(owner(), 'audit_log/o1'), entry(OWNER.email, OWNER_UID)));
    await assertSucceeds(setDoc(doc(guest(), 'audit_log/g1'), guestEntry()));
  });

  it('ligne valide aux bornes : création, suppression, libellé et chemin longs, 50 changements', async () => {
    const changes = Array.from({ length: 50 }, (_, i) => ({ field: `f${i}`, to: i }));
    await assertSucceeds(
      setDoc(
        doc(guest(), 'audit_log/g-bornes'),
        guestEntry({ action: 'delete', label: 'é'.repeat(300), path: 'p'.repeat(500), changes }),
      ),
    );
    for (const domain of ['budget', 'recurrence']) {
      await assertSucceeds(
        setDoc(doc(guest(), `audit_log/g-${domain}`), guestEntry({ domain, action: 'create' })),
      );
    }
  });

  it("création refusée au nom d'un autre, ou avec une date choisie", async () => {
    await assertFails(setDoc(doc(guest(), 'audit_log/g2'), entry(OWNER.email, GUEST_UID)));
    await assertFails(setDoc(doc(owner(), 'audit_log/o2'), entry(GUEST_EMAIL, OWNER_UID)));
    await assertFails(
      setDoc(doc(guest(), 'audit_log/g3'), guestEntry({ at: new Date(2020, 0, 1) })),
    );
  });

  it("création refusée avec l'UID d'un autre", async () => {
    await assertFails(setDoc(doc(guest(), 'audit_log/u1'), guestEntry({ byUid: OWNER_UID })));
  });

  it('création refusée avec une clé inconnue ou une clé manquante', async () => {
    await assertFails(setDoc(doc(guest(), 'audit_log/k1'), guestEntry({ extra: 'x' })));
    const { label: _label, ...withoutLabel } = guestEntry();
    await assertFails(setDoc(doc(guest(), 'audit_log/k2'), withoutLabel));
  });

  it('création refusée avec un domaine ou une action inconnus', async () => {
    await assertFails(setDoc(doc(guest(), 'audit_log/d1'), guestEntry({ domain: 'patrimoine' })));
    await assertFails(setDoc(doc(guest(), 'audit_log/a1'), guestEntry({ action: 'purge' })));
  });

  it('création refusée avec des champs texte mal typés ou trop longs', async () => {
    await assertFails(setDoc(doc(guest(), 'audit_log/t1'), guestEntry({ label: 'x'.repeat(301) })));
    await assertFails(setDoc(doc(guest(), 'audit_log/t2'), guestEntry({ path: 'p'.repeat(501) })));
    await assertFails(setDoc(doc(guest(), 'audit_log/t3'), guestEntry({ label: 42 })));
    await assertFails(setDoc(doc(guest(), 'audit_log/t4'), guestEntry({ path: { a: 1 } })));
    await assertFails(setDoc(doc(guest(), 'audit_log/t5'), guestEntry({ docId: 7 })));
    await assertFails(setDoc(doc(guest(), 'audit_log/t6'), guestEntry({ docId: 'd'.repeat(501) })));
  });

  it('création refusée avec plus de 50 changements ou des changements qui ne sont pas une liste', async () => {
    const changes = Array.from({ length: 51 }, (_, i) => ({ field: `f${i}`, to: i }));
    await assertFails(setDoc(doc(guest(), 'audit_log/c1'), guestEntry({ changes })));
    await assertFails(setDoc(doc(guest(), 'audit_log/c2'), guestEntry({ changes: 'tout' })));
  });

  it('ni modification ni suppression, même par le propriétaire', async () => {
    for (const db of [owner(), guest()]) {
      await assertFails(updateDoc(doc(db, 'audit_log/e1'), { byEmail: 'autre@gmail.com' }));
      await assertFails(setDoc(doc(db, 'audit_log/e1'), guestEntry()));
      await assertFails(deleteDoc(doc(db, 'audit_log/e1')));
    }
  });

  it('autres comptes : aucun accès', async () => {
    await assertFails(getDoc(doc(stranger(), 'audit_log/e1')));
    await assertFails(
      setDoc(doc(stranger(), 'audit_log/s1'), entry('autre@gmail.com', 'stranger')),
    );
    await assertFails(getDoc(doc(anonymous(), 'audit_log/e1')));
  });
});
