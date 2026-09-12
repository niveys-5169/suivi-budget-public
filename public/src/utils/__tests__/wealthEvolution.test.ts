import { describe, it, expect } from 'vitest';
import {
  periodRangeISO,
  computeWealthEvolution,
  buildAssetSeries,
  computeAssetEvolution,
  segmentsToLiveByCat,
  appendLiveTodayPoint,
} from '../wealthEvolution';
import type { RawHistoryEntry, WealthPoint } from '../wealthTimeline';

function point(date: string, amount: number, byCat?: Partial<WealthPoint['byCat']>): WealthPoint {
  const d = new Date(date);
  return {
    date,
    fullDate: date,
    timestamp: d.getTime(),
    amount,
    byCat: {
      courants: 0,
      epargne: 0,
      investissements: 0,
      retraite: 0,
      ...byCat,
    },
  };
}

describe('periodRangeISO', () => {
  const now = new Date('2026-07-10T12:00:00Z');

  it('calcule les bornes 1M / 3M / 6M / 1Y', () => {
    expect(periodRangeISO('1M', now).from).toBe('2026-06-10');
    expect(periodRangeISO('3M', now).from).toBe('2026-04-10');
    expect(periodRangeISO('6M', now).from).toBe('2026-01-10');
    expect(periodRangeISO('1Y', now).from).toBe('2025-07-10');
  });

  it('YTD démarre au 1er janvier', () => {
    expect(periodRangeISO('ytd', now)).toEqual({ from: '2026-01-01', to: null });
  });

  it('all est sans bornes, custom reprend les dates fournies', () => {
    expect(periodRangeISO('all', now)).toEqual({ from: null, to: null });
    expect(periodRangeISO('custom', now, { from: '2026-02-01', to: '2026-03-01' })).toEqual({
      from: '2026-02-01',
      to: '2026-03-01',
    });
  });
});

describe('computeWealthEvolution', () => {
  const points = [
    point('2026-01-01', 100, { courants: 40, epargne: 60 }),
    point('2026-03-01', 120, { courants: 50, epargne: 70 }),
    point('2026-06-01', 150, { courants: 60, epargne: 90 }),
  ];

  it('utilise le dernier point avant `from` comme départ (fill-forward)', () => {
    const evo = computeWealthEvolution(points, '2026-04-15');
    expect(evo.startPoint?.date).toBe('2026-03-01');
    expect(evo.endPoint?.date).toBe('2026-06-01');
    expect(evo.total).toEqual({ start: 120, end: 150, delta: 30, deltaPct: 25 });
  });

  it('retombe sur le premier point de la fenêtre si l’historique commence après `from`', () => {
    const evo = computeWealthEvolution(points, '2025-06-01');
    expect(evo.startPoint?.date).toBe('2026-01-01');
    expect(evo.total.start).toBe(100);
  });

  it('respecte la borne `to`', () => {
    const evo = computeWealthEvolution(points, '2026-01-15', '2026-04-01');
    expect(evo.startPoint?.date).toBe('2026-01-01');
    expect(evo.endPoint?.date).toBe('2026-03-01');
    expect(evo.total.delta).toBe(20);
  });

  it('deltaPct est null quand le départ vaut 0', () => {
    const evo = computeWealthEvolution(
      [point('2026-01-01', 0), point('2026-02-01', 50)],
      '2026-01-01',
    );
    expect(evo.total.deltaPct).toBeNull();
    expect(evo.total.delta).toBe(50);
  });

  it('les deltas par catégorie somment au delta total', () => {
    const evo = computeWealthEvolution(points, '2026-02-01');
    const catSum = Object.values(evo.byCat).reduce((s, c) => s + c.delta, 0);
    expect(catSum).toBe(evo.total.delta);
  });

  it('historique vide → évolution vide', () => {
    const evo = computeWealthEvolution([], '2026-01-01');
    expect(evo.startPoint).toBeNull();
    expect(evo.endPoint).toBeNull();
    expect(evo.points).toEqual([]);
  });
});

describe('segmentsToLiveByCat', () => {
  it('mappe les types internes de useWealthAggregates vers les catégories patrimoine', () => {
    const byCat = segmentsToLiveByCat([
      { type: 'cash', amount: 100 },
      { type: 'savings', amount: 200 },
      { type: 'investissements', amount: 300 },
      { type: 'retirement', amount: 50 },
      { type: 'inconnu', amount: 999 },
    ]);
    expect(byCat).toEqual({ courants: 100, epargne: 200, investissements: 300, retraite: 50 });
  });
});

describe('appendLiveTodayPoint', () => {
  const history = [
    point('2026-06-01', 150, { courants: 60, epargne: 90 }),
    point('2026-07-01', 160, { courants: 65, epargne: 95 }),
  ];
  const live = { courants: 70, epargne: 100, investissements: 30, retraite: 0 };

  it('le point live devient le point de fin quand la fenêtre inclut aujourd’hui', () => {
    const now = new Date('2026-07-10T12:00:00Z');
    const points = appendLiveTodayPoint(history, live, now);
    const evo = computeWealthEvolution(points, '2026-06-15');
    expect(evo.endPoint?.timestamp).toBe(now.getTime());
    expect(evo.total.end).toBe(200);
    expect(evo.byCat.courants.end).toBe(70);
    expect(evo.byCat.epargne.end).toBe(100);
    expect(evo.byCat.investissements.end).toBe(30);
  });

  it('une borne `to` passée exclut le point live (fin = dernier snapshot)', () => {
    const now = new Date('2026-07-10T12:00:00Z');
    const points = appendLiveTodayPoint(history, live, now);
    const evo = computeWealthEvolution(points, '2026-05-01', '2026-07-05');
    expect(evo.endPoint?.date).toBe('2026-07-01');
    expect(evo.total.end).toBe(160);
  });

  it('historique vide → départ = fin = point live, delta nul', () => {
    const now = new Date('2026-07-10T12:00:00Z');
    const points = appendLiveTodayPoint([], live, now);
    const evo = computeWealthEvolution(points, '2026-06-15');
    expect(evo.total).toEqual({ start: 200, end: 200, delta: 0, deltaPct: 0 });
  });
});

describe('buildAssetSeries', () => {
  const history: RawHistoryEntry[] = [
    { assetId: 'a1', date: '2026-01-01', montant: 100 },
    { assetId: 'other', date: '2026-01-15', montant: 999 },
    { assetId: 'a1', date: '2026-02-01', montant: 110 },
  ];

  it('ignore les autres assetIds', () => {
    const series = buildAssetSeries(history, new Set(['a1']));
    expect(series).toEqual([
      { date: '2026-01-01', timestamp: new Date('2026-01-01').getTime(), value: 100 },
      { date: '2026-02-01', timestamp: new Date('2026-02-01').getTime(), value: 110 },
    ]);
  });

  it('somme plusieurs ids avec fill-forward par id', () => {
    const multi: RawHistoryEntry[] = [
      { assetId: 'a1', date: '2026-01-01', montant: 100 },
      { assetId: 'a2', date: '2026-01-01', montant: 50 },
      { assetId: 'a1', date: '2026-02-01', montant: 120 },
    ];
    const series = buildAssetSeries(multi, new Set(['a1', 'a2']));
    // Au 2026-02-01, a2 est fill-forward à 50.
    expect(series[1]).toMatchObject({ date: '2026-02-01', value: 170 });
  });

  it('canonicalise les backfill mensuels portfolio_bkfill_*', () => {
    const bkfill: RawHistoryEntry[] = [
      { assetId: 'portfolio_bkfill_2026-01', date: '2026-01-31', montant: 100 },
      { assetId: 'portfolio_bkfill_2026-02', date: '2026-02-28', montant: 110 },
    ];
    const series = buildAssetSeries(bkfill, new Set(['portfolio_bkfill_2026-01']));
    // Les deux mois pointent le même id canonique : pas d'addition N × valeur.
    expect(series.map((p) => p.value)).toEqual([100, 110]);
  });
});

describe('computeAssetEvolution', () => {
  const series = buildAssetSeries(
    [
      { assetId: 'a1', date: '2026-01-01', montant: 100 },
      { assetId: 'a1', date: '2026-03-01', montant: 130 },
      { assetId: 'a1', date: '2026-06-01', montant: 120 },
    ],
    new Set(['a1']),
  );

  it('calcule start/end/delta sur la fenêtre', () => {
    const evo = computeAssetEvolution(series, '2026-02-01');
    expect(evo.start).toBe(100);
    expect(evo.end).toBe(120);
    expect(evo.delta).toBe(20);
    expect(evo.deltaPct).toBeCloseTo(20);
  });

  it('série vide → évolution vide', () => {
    expect(computeAssetEvolution([], '2026-01-01')).toEqual({
      start: 0,
      end: 0,
      delta: 0,
      deltaPct: null,
      points: [],
    });
  });
});
