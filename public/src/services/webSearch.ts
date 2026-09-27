/**
 * Recherche web via Brave Search. L'API ne renvoie pas d'en-têtes CORS : on
 * passe par le proxy Vercel (voir vercel.json), indisponible en local.
 */
const BRAVE_SEARCH_URL = '/api/search/brave/res/v1/web/search';
const MAX_RESULTS = 5;

interface BraveResult {
  title?: string;
  url?: string;
  description?: string;
  age?: string;
}

const stripHtml = (text: string) => text.replace(/<[^>]+>/g, '');

/** Renvoie les premiers résultats sous forme de texte lisible par un LLM. */
export async function searchWeb(query: string, apiKey: string): Promise<string> {
  const params = new URLSearchParams({
    q: query,
    count: String(MAX_RESULTS),
    country: 'FR',
    search_lang: 'fr',
  });
  const resp = await fetch(`${BRAVE_SEARCH_URL}?${params}`, {
    headers: { Accept: 'application/json', 'X-Subscription-Token': apiKey },
  });
  if (resp.status === 401 || resp.status === 403) {
    throw new Error('clé Brave Search invalide. Vérifie-la dans ⚙');
  }
  if (resp.status === 429) throw new Error('quota Brave Search atteint');
  if (!resp.ok) throw new Error(`Brave Search indisponible (${resp.status})`);

  const data = (await resp.json()) as { web?: { results?: BraveResult[] } };
  const results = (data.web?.results ?? []).slice(0, MAX_RESULTS);
  if (!results.length) return 'Aucun résultat.';
  return results
    .map((r, i) =>
      [
        `[${i + 1}] ${stripHtml(r.title ?? '')}`,
        r.url,
        r.age ? `Date : ${r.age}` : null,
        stripHtml(r.description ?? ''),
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n');
}
