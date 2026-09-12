import type { SimplifiedBucket } from '../components/analyse/analyseTypes';

const BUCKET_RULES: Array<{ bucket: SimplifiedBucket; patterns: RegExp[] }> = [
  {
    bucket: 'Épargne',
    patterns: [
      /^épargne$/i,
      /^epargne$/i,
      /livret/i,
      /investissement/i,
      /placement/i,
      /pea$/i,
      /assurance.vie/i,
      /retraite epargne/i,
    ],
  },
  {
    bucket: 'Essentiel',
    patterns: [
      /cr[eé]dit/i,
      /loyer/i,
      /logement/i,
      /^eau$/i,
      /edf/i,
      /electricit/i,
      /gaz$/i,
      /fibre/i,
      /mobile/i,
      /icloud/i,
      /assurance/i,
      /sant[eé]/i,
      /nourriture/i,
      /cantine/i,
      /courses/i,
      /alimentation/i,
      /restaurant/i,
      /transport/i,
      /carburant/i,
      /imp[oô]t/i,
      /tax/i,
      /frais bancaires/i,
      /frais pro/i,
      /syndicat/i,
      /cotis/i,
      /travaux/i,
      /entretien/i,
      /abonnement/i,
      /téléphone/i,
      /telephone/i,
      /internet/i,
      /banque/i,
    ],
  },
  {
    bucket: 'Plaisir',
    patterns: [
      /sortie/i,
      /sport/i,
      /vacances/i,
      /no[eë]l/i,
      /cadeau/i,
      /kdo/i,
      /anniversaire/i,
      /netflix/i,
      /spotify/i,
      /apple music/i,
      /disney/i,
      /shopping/i,
      /habit/i,
      /vêtement/i,
      /vetement/i,
      /loisir/i,
      /électronique/i,
      /electronique/i,
      /électroménager/i,
      /electromenager/i,
      /jeux/i,
      /cin[eé]ma/i,
      /cinema/i,
      /concert/i,
      /esthétique/i,
      /esthetique/i,
    ],
  },
];

export const BUCKET_COLORS: Record<SimplifiedBucket, string> = {
  Essentiel: '#88A4C2',
  Plaisir: '#F5A962',
  Épargne: '#52B788',
  Imprévu: '#E98080',
};

export const BUCKET_ORDER: SimplifiedBucket[] = ['Essentiel', 'Plaisir', 'Épargne', 'Imprévu'];

export function classifyCategory(categoryName: string): SimplifiedBucket {
  const name = (categoryName || '').trim();
  for (const rule of BUCKET_RULES) {
    if (rule.patterns.some((re) => re.test(name))) return rule.bucket;
  }
  return 'Imprévu';
}
