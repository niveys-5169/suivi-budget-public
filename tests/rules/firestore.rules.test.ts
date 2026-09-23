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
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';

const OWNER_UID = 'owner-uid';
const OWNER = { email: 'niveys@gmail.com', email_verified: true };

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
  `user_settings/${OWNER_UID}`,
  `users/${OWNER_UID}/preferences/ui`,
  `users/${OWNER_UID}/ai_sessions/s1`,
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
    for (const path of FRONT_PATHS) await setDoc(doc(ctx.firestore(), path), { seed: true });
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
const anonymous = () => env.unauthenticatedContext().firestore();

describe.each(FRONT_PATHS)('%s', (path) => {
  it('propriétaire : lecture, écriture, suppression', async () => {
    await assertSucceeds(getDoc(doc(owner(), path)));
    await assertSucceeds(setDoc(doc(owner(), path), { v: 1 }));
    await assertSucceeds(deleteDoc(doc(owner(), path)));
  });

  it('compte preview : lecture seule', async () => {
    await assertSucceeds(getDoc(doc(preview(), path)));
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
