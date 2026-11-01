import React from 'react';
import { Amount, Text } from '../../ui';

/** Conteneur de tableau défilant horizontalement (les tableaux de projection sont larges). */
export const DataTable: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div className="overflow-x-auto">
    <table aria-label={label} className="w-full border-collapse text-left">
      {children}
    </table>
  </div>
);

/** En-tête de colonne. Les colonnes de chiffres sont alignées à droite. */
export const Th: React.FC<{ align?: 'left' | 'right'; children?: React.ReactNode }> = ({
  align = 'right',
  children,
}) => (
  <th
    scope="col"
    className={`whitespace-nowrap px-4 py-2 text-caption font-semibold text-label-secondary ${
      align === 'left' ? 'text-left' : 'text-right'
    }`}
  >
    {children}
  </th>
);

/** En-tête de ligne (première colonne). */
export const RowHead: React.FC<{ strong?: boolean; children: React.ReactNode }> = ({
  strong = false,
  children,
}) => (
  <th scope="row" className="px-4 py-2 text-left font-normal">
    <Text as="span" variant="callout" tone={strong ? 'primary' : 'secondary'}>
      {children}
    </Text>
  </th>
);

/** Cellule de chiffres : alignée à droite, chiffres tabulaires. */
export const Td: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <td className="whitespace-nowrap px-4 py-2 text-right">{children}</td>
);

/** Montant. `auto` colore selon le signe (résultats), `neutral` pour un flux (revenus, dépenses). */
export const Money: React.FC<{
  value: number | null;
  tone?: 'auto' | 'neutral';
  strong?: boolean;
}> = ({ value, tone = 'neutral', strong = false }) => (
  <Amount
    as="span"
    value={value}
    variant="callout"
    tone={tone}
    className={strong ? 'font-semibold' : ''}
  />
);

export const ROW_CLS = 'border-t border-separator';

interface MatrixRow<T> {
  id: string;
  label: string;
  /** Absent : la ligne est un intertitre. */
  cell?: (scenario: T) => React.ReactNode;
}

/** Tableau « une ligne par indicateur, une colonne par scénario ». */
export function ScenarioMatrix<T extends { scenarioId: string; nom: string }>({
  label,
  scenarios,
  rows,
}: {
  label: string;
  scenarios: readonly T[];
  rows: readonly MatrixRow<T>[];
}) {
  return (
    <DataTable label={label}>
      <thead>
        <tr>
          <Th align="left" />
          {scenarios.map((s) => (
            <Th key={s.scenarioId}>{s.nom}</Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(({ id, label: rowLabel, cell }) => (
          <tr key={id} className={ROW_CLS}>
            {cell ? (
              <>
                <RowHead>{rowLabel}</RowHead>
                {scenarios.map((s) => (
                  <Td key={s.scenarioId}>{cell(s)}</Td>
                ))}
              </>
            ) : (
              <th
                scope="colgroup"
                colSpan={scenarios.length + 1}
                className="px-4 pb-2 pt-4 text-left"
              >
                <Text as="span" variant="footnote" tone="tertiary">
                  {rowLabel}
                </Text>
              </th>
            )}
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}
