import React from 'react';
import { Amount, EmptyState, List, ListItem, Select, Stack, Text } from '../../../ui';
import type { ProjectionClasseCategorie } from '../../../types/banking.types';
import { CLASS_LABELS, CLASS_OPTIONS } from './constants';
import type { ContextSectionProps } from './editorTypes';

/** Classe de chaque catégorie observée (règle de l'onglet ⑨) : elle détermine le budget de référence. */
export const CategoryClassEditor: React.FC<ContextSectionProps> = ({ draft, onChange, ctx }) => {
  const rows = ctx.observed.detailCategories;
  const setClass = (categorie: string, classe: ProjectionClasseCategorie) =>
    onChange({ ...draft, classesCategories: { ...draft.classesCategories, [categorie]: classe } });

  return (
    <Stack gap="md">
      <Text variant="headline">Classe des catégories</Text>
      {rows.length === 0 ? (
        <EmptyState
          title="Aucune catégorie observée"
          description="Les catégories apparaissent dès que des transactions des 12 derniers mois sont chargées."
        />
      ) : (
        <List plain className="max-h-96 overflow-y-auto">
          {rows.map((row) => (
            <ListItem
              key={row.categorie}
              compact
              title={row.categorie}
              subtitle={<Amount value={row.soldeNet} variant="footnote" />}
              trailing={
                <Select
                  aria-label={`Classe de ${row.categorie}`}
                  value={draft.classesCategories[row.categorie] ?? row.classe}
                  onChange={(e) =>
                    setClass(row.categorie, e.target.value as ProjectionClasseCategorie)
                  }
                >
                  {CLASS_OPTIONS.map((classe) => (
                    <option key={classe} value={classe}>
                      {CLASS_LABELS[classe]}
                    </option>
                  ))}
                </Select>
              }
            />
          ))}
        </List>
      )}
    </Stack>
  );
};
