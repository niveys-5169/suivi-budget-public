export interface SearchResult {
  type: 'transaction' | 'page' | 'category';
  id: string;
  label: string;
  sublabel?: string;
  amount?: number;
  tab?: string;
}

interface TxLike {
  id: string;
  libelle: string;
  montant: number;
  categorie?: string;
  date?: string;
}

interface PageEntry {
  label: string;
  tab: string;
}

export function searchGlobal(
  query: string,
  transactions: TxLike[],
  pages: PageEntry[],
): SearchResult[] {
  if (!query || query.trim().length < 2) return [];

  const q = query.trim().toLowerCase();
  const results: SearchResult[] = [];

  // Pages
  for (const p of pages) {
    if (p.label.toLowerCase().includes(q)) {
      results.push({ type: 'page', id: `page-${p.tab}`, label: p.label, tab: p.tab });
    }
  }

  // Categories
  const cats = new Set(transactions.map((t) => t.categorie).filter(Boolean) as string[]);
  for (const cat of cats) {
    if (cat.toLowerCase().includes(q)) {
      results.push({ type: 'category', id: `cat-${cat}`, label: cat });
    }
  }

  // Transactions (top 5 by recency)
  const txMatches = transactions
    .filter((t) => t.libelle?.toLowerCase().includes(q))
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    .slice(0, 5);

  for (const t of txMatches) {
    results.push({
      type: 'transaction',
      id: t.id,
      label: t.libelle,
      sublabel: t.categorie,
      amount: t.montant,
    });
  }

  return results;
}
