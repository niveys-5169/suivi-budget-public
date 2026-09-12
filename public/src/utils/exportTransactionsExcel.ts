import type { Transaction } from '../types/banking.types';

const COLUMNS = [
  { header: 'ID', key: 'id' },
  { header: 'Date', key: 'date' },
  { header: 'Libellé', key: 'libelle' },
  { header: 'Montant (€)', key: 'montant' },
  { header: 'Compte', key: 'compte' },
  { header: 'Catégorie', key: 'categorie' },
  { header: 'Commentaire', key: 'commentaire' },
  { header: 'Pointé', key: 'pointe' },
  { header: 'Mois affectation', key: 'moisAffectation' },
  { header: 'Source', key: 'source' },
] as const;

type ColumnKey = (typeof COLUMNS)[number]['key'];

export async function exportTransactionsToExcel(
  transactions: Transaction[],
  filename?: string,
): Promise<void> {
  const XLSX = await import('@e965/xlsx');

  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date));

  const rows = sorted.map((tx) => {
    const row: Record<string, unknown> = {};
    for (const col of COLUMNS) {
      const val = tx[col.key as ColumnKey];
      if (col.key === 'pointe') {
        row[col.header] = val ? 'Oui' : 'Non';
      } else {
        row[col.header] = val ?? '';
      }
    }
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows, { header: COLUMNS.map((c) => c.header) });

  // Column widths
  ws['!cols'] = [
    { wch: 45 }, // ID
    { wch: 12 }, // Date
    { wch: 40 }, // Libellé
    { wch: 14 }, // Montant
    { wch: 18 }, // Compte
    { wch: 22 }, // Catégorie
    { wch: 30 }, // Commentaire
    { wch: 8 }, // Pointé
    { wch: 14 }, // Mois affectation
    { wch: 12 }, // Source
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, filename ?? `transactions-export-${date}.xlsx`);
}
