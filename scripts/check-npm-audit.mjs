#!/usr/bin/env node
/**
 * check-npm-audit.mjs — Audit npm avec exceptions documentées.
 *
 * `npm audit` n'a pas d'équivalent au `--ignore-vuln` de pip-audit, déjà
 * utilisé par ce dépôt pour les dépendances Python (cf. security.yml). Ce
 * script comble le manque : il échoue sur toute vulnérabilité `high` ou
 * `critical`, SAUF celles listées ci-dessous avec une justification et une date
 * de réexamen.
 *
 * Deux garde-fous contre le pourrissement de la liste :
 *   1. Une exception dont la vulnérabilité a disparu est signalée — il faut la
 *      retirer.
 *   2. Une exception dont la date de réexamen est passée fait échouer le
 *      script — personne ne peut l'oublier indéfiniment.
 *
 * Usage : node scripts/check-npm-audit.mjs
 */
import { execFileSync } from 'node:child_process';

/**
 * Vulnérabilités acceptées sciemment.
 *
 * N'ajouter une entrée QUE si la faille n'est pas corrigeable sans casser
 * l'application, et seulement après avoir vérifié qu'elle n'est pas
 * exploitable dans ce contexte. Toujours renseigner `reason` et `review`.
 */
const ACCEPTED = [];

const BLOCKING = new Set(['high', 'critical']);

let report;
try {
  // `npm audit` sort en code 1 dès qu'il trouve quelque chose : on récupère
  // quand même stdout, qui contient le JSON.
  const out = execFileSync('npm', ['audit', '--json'], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  report = JSON.parse(out);
} catch (err) {
  if (!err.stdout) {
    console.error('❌ Impossible de lancer npm audit :', err.message);
    process.exit(1);
  }
  report = JSON.parse(err.stdout);
}

const vulns = Object.values(report.vulnerabilities ?? {});
const accepted = new Map(ACCEPTED.map((a) => [a.advisory, a]));
const seen = new Set();
const blocking = [];

for (const v of vulns) {
  if (!BLOCKING.has(v.severity)) continue;

  // `via` mêle des identifiants d'avis et de simples noms de paquets.
  const advisories = (v.via ?? []).filter((x) => typeof x === 'object' && x.url);
  const ids = advisories.map((a) => a.url.split('/').pop());

  const covered = ids.filter((id) => accepted.has(id));
  covered.forEach((id) => seen.add(id));

  // On ne bloque que sur les avis NON couverts par une exception.
  const uncovered = advisories.filter((a) => !accepted.has(a.url.split('/').pop()));
  if (uncovered.length > 0) {
    blocking.push({ name: v.name, severity: v.severity, advisories: uncovered });
  }
}

const today = new Date().toISOString().slice(0, 10);
let failed = false;

if (blocking.length > 0) {
  failed = true;
  console.error(`\n❌ ${blocking.length} vulnérabilité(s) bloquante(s) :\n`);
  for (const b of blocking) {
    console.error(`  ${b.name} (${b.severity})`);
    for (const a of b.advisories) console.error(`    ${a.title}\n    ${a.url}`);
  }
  console.error(
    '\nCorrige-les (npm audit fix, ou un override ciblé dans package.json).\n' +
      "Si la faille n'est pas corrigeable sans casser l'app ET n'est pas exploitable ici,\n" +
      'ajoute une exception justifiée dans scripts/check-npm-audit.mjs.',
  );
}

for (const a of ACCEPTED) {
  if (!seen.has(a.advisory)) {
    console.log(
      `ℹ️  L'exception ${a.advisory} (${a.package}) ne correspond plus à aucune ` +
        'vulnérabilité : elle peut être retirée.',
    );
  }
  if (a.review < today) {
    failed = true;
    console.error(
      `\n❌ L'exception ${a.advisory} (${a.package}) devait être réexaminée le ${a.review}.\n` +
        '   Vérifie si une version corrigée existe, puis mets à jour ou retire l’exception.',
    );
  }
}

if (failed) process.exit(1);

const acceptedCount = ACCEPTED.filter((a) => seen.has(a.advisory)).length;
console.log(
  `✅ Aucune vulnérabilité high/critical non traitée ` +
    `(${acceptedCount} exception${acceptedCount > 1 ? 's' : ''} documentée${acceptedCount > 1 ? 's' : ''}).`,
);
