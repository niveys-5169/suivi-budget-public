export type AnalyseTab = 'overview' | 'entrees' | 'sorties';

export interface CategorySummary {
  name: string;
  amount: number;
  count: number;
  percentage: number;
  color: string;
  isExceeded: boolean;
  budget?: number;
}

export type SimplifiedBucket = 'Essentiel' | 'Plaisir' | 'Épargne' | 'Imprévu';

export interface SimplifiedBucketData {
  bucket: SimplifiedBucket;
  amount: number;
  percentage: number;
  color: string;
  categories: CategorySummary[];
}

export type DrillDownView =
  | { type: 'category'; categoryName: string; tab: 'entrees' | 'sorties' }
  | { type: 'bucket'; bucket: SimplifiedBucket; categories: CategorySummary[] }
  | { type: 'budget' }
  | { type: 'accounts' };
