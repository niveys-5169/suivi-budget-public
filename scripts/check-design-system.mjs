#!/usr/bin/env node
/**
 * check-design-system.mjs — Garde-fou du Design System AURUM v3.
 *
 * Remplace `check-arbitrary-radius.mjs`, qui ne surveillait que les rayons
 * arbitraires et était saturé (105 sur une limite de 105).
 *
 * Principe : un CLIQUET. Chaque compteur mémorise un plafond ; le nombre
 * d'occurrences peut baisser, jamais monter. Une nouvelle fonctionnalité ne
 * peut donc pas réintroduire ce que la refonte a supprimé — c'est ce qui
 * empêche le système de redériver dans six mois.
 *
 * Quand un compteur descend sous son plafond, le script le signale et demande
 * d'abaisser la valeur : le cliquet se resserre au fil des migrations.
 *
 * Usage :
 *   node scripts/check-design-system.mjs          vérifie (code 1 si dépassement)
 *   node scripts/check-design-system.mjs --update  réécrit les plafonds au niveau actuel
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, extname, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const ROOT = join(REPO, 'public', 'src');
const EXTS = new Set(['.ts', '.tsx']);

/**
 * Les primitives de `public/src/ui/` sont le seul endroit où le système a le
 * droit de s'exprimer en classes brutes — c'est leur rôle. Elles sont donc
 * exclues des compteurs qui traquent le contournement des primitives.
 */
const UI_DIR = join(ROOT, 'ui');

/** Espacements hors de la grille de 8 px (le pas de 4 px reste autorisé). */
const OFF_GRID = String.raw`\b(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-x|space-y)-(?:3|5|7|9|11|13|14|15|17|18|19|[0-9]+\.5)\b`;

const RULES = [
  {
    id: 'radius-arbitrary',
    label: 'Rayons arbitraires  rounded-[…]',
    re: /rounded(?:-[a-z]+)?-\[[^\]]+\]/g,
    hint: 'Utilise rounded-sm|md|lg|xl (8/10/12/16 px).',
  },
  {
    id: 'radius-offscale',
    label: 'Rayons hors échelle  rounded-2xl|3xl|4xl',
    re: /\brounded-(?:2xl|3xl|4xl)\b/g,
    hint: 'Plafond à 16 px : rounded-xl est le maximum.',
  },
  {
    id: 'uppercase',
    label: 'Majuscules  uppercase',
    re: /\buppercase\b/g,
    // `ui/` porte l'unique implémentation légitime : la variante `overline`
    // de <Text>. C'est le seul endroit du dépôt où `uppercase` doit exister.
    skipUi: true,
    hint: 'La hiérarchie passe par la taille et le poids. Seul <Text variant="overline"> reste en capitales.',
  },
  {
    id: 'tracking-arbitrary',
    label: 'Letter-spacing arbitraire  tracking-[…]',
    re: /\btracking-\[[^\]]+\]/g,
    hint: "Le système n'a qu'un letter-spacing élargi, porté par overline.",
  },
  {
    id: 'text-arbitrary',
    label: 'Tailles de police en dur  text-[Npx]',
    re: /\btext-\[[0-9.]+(?:px|rem)\]/g,
    hint: 'Utilise la rampe : display|title1|title2|title3|headline|body|callout|subhead|footnote|caption.',
  },
  {
    id: 'spacing-offgrid',
    label: 'Espacements hors grille 8 px',
    re: new RegExp(OFF_GRID, 'g'),
    hint: 'Pas autorisés : 1 (4px), 2 (8), 4 (16), 6 (24), 8 (32), 12 (48), 16 (64).',
  },
  {
    id: 'hex-literal',
    label: 'Couleurs en dur  #rrggbb',
    re: /#[0-9a-fA-F]{6}\b/g,
    hint: 'Passe par ui/tokens.ts (color, categoryColor) ou une classe Tailwind.',
  },
  {
    id: 'raw-button',
    label: 'Boutons bruts  <button',
    re: /<button\b/g,
    skipUi: true,
    hint: 'Utilise <Button> / <IconButton> de public/src/ui.',
  },
  {
    id: 'raw-input',
    label: 'Champs bruts  <input',
    re: /<input\b/g,
    skipUi: true,
    hint: 'Utilise <Field> + <Input> de public/src/ui.',
  },
  {
    id: 'legacy-glass',
    label: 'Surfaces héritées  glass-panel',
    re: /\bglass-panel\b/g,
    skipUi: true,
    hint: 'Utilise <Card> / <Surface>.',
  },
];

const BASELINE_FILE = join(HERE, 'design-system-baseline.json');

/**
 * Retire les commentaires avant de compter.
 *
 * Sans cela, une documentation qui CITE le motif interdit — par exemple pour
 * expliquer ce qu'elle remplace — compte comme une infraction. Les lignes
 * commençant par `//` ou `*` et les blocs `/* … *\/` sont neutralisés ; les
 * `//` en milieu de ligne sont laissés tels quels pour ne pas casser les URL.
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => (/^\s*(\/\/|\*)/.test(line) ? '' : line))
    .join('\n');
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__' || entry === 'node_modules') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (EXTS.has(extname(full)) && !full.endsWith('.stories.tsx')) out.push(full);
  }
  return out;
}

/**
 * Invariant de cascade — pas un cliquet, un zéro absolu.
 *
 * Tailwind v4 émet tout son CSS dans `@layer theme, base, components,
 * utilities`. Une déclaration NON layerisée l'emporte sur n'importe quelle
 * layer, quelle que soit la spécificité : une seule règle `* { padding: 0 }`
 * posée dans `style.css` suffisait à écraser `px-4`, `p-8`, `mx-auto` et
 * `space-y-*` sur toute l'application — textes collés au bord de l'écran et
 * montants rognés, écrans comme modales. Aucun test Vitest ne peut l'attraper,
 * jsdom ne calculant pas la cascade.
 *
 * `style.css` est la seule feuille du dépôt écrite en CSS brut ; on exige donc
 * que chacune de ses règles vive dans un `@layer`. Les at-rules qui ne
 * participent pas à la cascade (`@keyframes`, `@import`, `@charset`) sont
 * ignorées.
 */
function checkCssLayers() {
  const file = join(ROOT, 'style.css');
  const src = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const offenders = [];

  let depth = 0;
  let buffer = '';
  for (const char of src) {
    if (char === '{') {
      if (depth === 0) {
        const selector = buffer.trim().replace(/\s+/g, ' ');
        if (selector && !/^@(?:layer|keyframes|import|charset|font-face)\b/.test(selector)) {
          offenders.push(selector);
        }
      }
      depth += 1;
      buffer = '';
    } else if (char === '}') {
      depth = Math.max(0, depth - 1);
      buffer = '';
    } else if (depth === 0) {
      buffer += char;
    }
  }

  if (offenders.length === 0) {
    console.log(`✅ = ${'Règles CSS hors cascade layer'.padEnd(40)} ${'0'.padStart(4)} / 0`);
    return true;
  }

  console.error(`\n❌ Règles CSS hors cascade layer : ${offenders.length} > plafond 0`);
  console.error(
    '   Une règle non layerisée bat tous les utilitaires Tailwind.\n' +
      `   Enveloppe-la dans @layer base { … } ou @layer components { … } — ${relative(REPO, file)} :`,
  );
  offenders.slice(0, 8).forEach((sel) => console.error(`         ${sel}`));
  return false;
}

const files = walk(ROOT);
const results = new Map();

for (const rule of RULES) {
  let count = 0;
  const offenders = [];
  for (const file of files) {
    if (rule.skipUi && file.startsWith(UI_DIR)) continue;
    const matches = stripComments(readFileSync(file, 'utf8')).match(rule.re);
    if (matches?.length) {
      count += matches.length;
      offenders.push({ file: relative(REPO, file), n: matches.length });
    }
  }
  results.set(rule.id, { count, offenders });
}

if (process.argv.includes('--update')) {
  const next = Object.fromEntries([...results].map(([id, r]) => [id, r.count]));
  writeFileSync(BASELINE_FILE, `${JSON.stringify(next, null, 2)}\n`);
  console.log('Plafonds réécrits :');
  for (const rule of RULES) console.log(`  ${rule.id.padEnd(20)} ${next[rule.id]}`);
  process.exit(0);
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'));
} catch {
  console.error(
    `❌ ${relative(REPO, BASELINE_FILE)} est introuvable.\n` +
      '   Génère-le avec : node scripts/check-design-system.mjs --update',
  );
  process.exit(1);
}

let failed = !checkCssLayers();
const loosened = [];

for (const rule of RULES) {
  const { count, offenders } = results.get(rule.id);
  const max = baseline[rule.id];

  if (max === undefined) {
    console.error(`❌ ${rule.label} : aucun plafond enregistré pour « ${rule.id} ».`);
    failed = true;
    continue;
  }

  if (count > max) {
    failed = true;
    console.error(`\n❌ ${rule.label} : ${count} > plafond ${max}`);
    console.error(`   ${rule.hint}`);
    offenders
      .sort((a, b) => b.n - a.n)
      .slice(0, 8)
      .forEach((o) => console.error(`   ${String(o.n).padStart(4)}  ${o.file}`));
  } else {
    const mark = count < max ? '↓' : '=';
    console.log(`✅ ${mark} ${rule.label.padEnd(40)} ${String(count).padStart(4)} / ${max}`);
    if (count < max) loosened.push(`${rule.id}: ${max} → ${count}`);
  }
}

if (failed) {
  console.error(
    '\nLe cliquet ne se desserre jamais. Corrige les occurrences ajoutées,\n' +
      'ou — si la baisse est réelle ailleurs — relance avec --update.',
  );
  process.exit(1);
}

if (loosened.length) {
  console.log(
    `\nCes compteurs ont baissé — resserre le cliquet avec « npm run check:design -- --update » :\n  ${loosened.join('\n  ')}`,
  );
}
