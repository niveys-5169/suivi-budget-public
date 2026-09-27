import React, { useMemo, useState } from 'react';
import { Search, RotateCcw, Shapes, Plus, Trash2 } from 'lucide-react';
import { Modal } from './shared/Modal';
import { CategoryIcon } from './CategoryIcon';
import { useCategoryMeta } from '../context/CategoryMetaContext';
import { useBudgetContext } from '../context/BudgetContext';
import { getCategoryMeta, BUILTIN_CATEGORY_META } from '../constants/categoryMetadata';
import { CATEGORY_ICON_GROUPS, CATEGORY_COLORS } from '../constants/categoryIcons';
import { toast } from '../lib/toast';
import { confirm } from '../lib/confirm';

/**
 * Éditeur des catégories : ajout, suppression (masquage) et icône/couleur.
 * Les icônes sont persistées dans users/{uid}/preferences/categoryMeta (useCategoryMeta),
 * les ajouts/suppressions dans users/{uid}/preferences/categories (BudgetContext).
 */
export const CategoryIconEditor: React.FC = () => {
  const { overrides, setMeta, resetMeta, loading } = useCategoryMeta();
  const { getBudgetCategoryCandidates, removedCategories, addCategory, deleteCategory } =
    useBudgetContext();
  const [editing, setEditing] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  // Union : catégories budget (preset + utilisées) ∪ intégrées ∪ surchargées, hors supprimées.
  const categories = useMemo(() => {
    const set = new Set<string>([
      ...getBudgetCategoryCandidates(),
      ...Object.keys(BUILTIN_CATEGORY_META),
      ...Object.keys(overrides),
    ]);
    return Array.from(set)
      .filter((c) => Boolean(c) && !removedCategories.includes(c))
      .sort((a, b) => a.localeCompare(b, 'fr'));
  }, [getBudgetCategoryCandidates, overrides, removedCategories]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const key = name.toLocaleLowerCase('fr');
    if (categories.some((c) => c.toLocaleLowerCase('fr') === key)) {
      toast.error(`« ${name} » existe déjà`);
      return;
    }
    try {
      await addCategory(name);
      setNewName('');
      toast.success(`Catégorie « ${name} » ajoutée ✓`);
    } catch {
      // Erreur déjà signalée par le gestionnaire Firestore.
    }
  };

  const handleDelete = async (cat: string) => {
    if (
      !(await confirm({
        message: `Supprimer la catégorie « ${cat} » ? Elle ne sera plus proposée dans les listes ; les transactions existantes la conservent (utilisez « Fusion de catégories » pour les réaffecter).`,
        danger: true,
      }))
    )
      return;
    try {
      await deleteCategory(cat);
      toast.success(`Catégorie « ${cat} » supprimée`);
    } catch {
      // Erreur déjà signalée par le gestionnaire Firestore.
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-4">
          <Shapes size={20} className="text-gold" />
          Catégories
        </h2>
        <p className="text-caption font-medium text-label/40 leading-relaxed max-w-2xl">
          Ajoutez ou supprimez des catégories, et choisissez une icône et une couleur pour chacune.
          Les catégories sans personnalisation utilisent une icône générique « ? ». Les changements
          sont synchronisés sur tous vos appareils.
        </p>
      </div>

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nouvelle catégorie…"
          aria-label="Nom de la nouvelle catégorie"
          className="flex-1 min-w-0 px-4 py-2 rounded-xl bg-white/5 border border-separator text-base text-label placeholder:text-label/30 focus:outline-none focus:border-gold/40"
        />
        <button
          type="submit"
          disabled={!newName.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-caption font-semibold bg-gold text-bg hover:bg-gold/90 disabled:opacity-40 transition-colors"
        >
          <Plus size={16} />
          Ajouter
        </button>
      </form>

      {loading ? (
        <p className="text-caption text-label/40">Chargement…</p>
      ) : (
        <ul className="divide-y divide-separator rounded-lg border border-separator overflow-hidden">
          {categories.map((cat) => {
            const meta = getCategoryMeta(cat);
            const isCustom = cat in overrides;
            return (
              <li key={cat} className="flex items-center gap-4 px-4 py-4 bg-surface">
                <span
                  className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
                  style={{ backgroundColor: `${meta.color}22` }}
                >
                  <CategoryIcon icon={meta.icon} color={meta.color} size={20} />
                </span>
                <span className="flex-1 min-w-0 truncate text-sm text-label">{cat}</span>
                {isCustom && <span className="text-caption font-semibold text-gold/70">Perso</span>}
                <button
                  onClick={() => setEditing(cat)}
                  className="px-4 py-2 rounded-lg text-caption font-bold bg-white/5 text-label/70 hover:bg-gold/10 hover:text-gold transition-colors"
                >
                  Modifier
                </button>
                <button
                  onClick={() => handleDelete(cat)}
                  aria-label={`Supprimer ${cat}`}
                  className="p-2 rounded-lg text-label/40 hover:bg-negative/10 hover:text-negative transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <CategoryIconPicker
          categorie={editing}
          isCustom={editing in overrides}
          onClose={() => setEditing(null)}
          onSave={async (icon, color) => {
            try {
              await setMeta(editing, { icon, color });
              toast.success(`Icône de « ${editing} » mise à jour ✓`);
              setEditing(null);
            } catch {
              toast.error('Échec de la sauvegarde. Vérifiez votre connexion.');
            }
          }}
          onReset={async () => {
            try {
              await resetMeta(editing);
              toast.success(`« ${editing} » réinitialisée`);
              setEditing(null);
            } catch {
              toast.error('Échec de la réinitialisation.');
            }
          }}
        />
      )}
    </div>
  );
};

interface PickerProps {
  categorie: string;
  isCustom: boolean;
  onClose: () => void;
  onSave: (icon: string, color: string) => void;
  onReset: () => void;
}

const CategoryIconPicker: React.FC<PickerProps> = ({
  categorie,
  isCustom,
  onClose,
  onSave,
  onReset,
}) => {
  const current = getCategoryMeta(categorie);
  const [icon, setIcon] = useState(current.icon);
  const [color, setColor] = useState(current.color);
  const [search, setSearch] = useState('');

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return CATEGORY_ICON_GROUPS;
    return CATEGORY_ICON_GROUPS.map((g) => ({
      ...g,
      icons: g.icons.filter((name) => name.includes(q)),
    })).filter((g) => g.icons.length > 0);
  }, [search]);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={categorie}
      subtitle="Choisir une icône et une couleur"
      size="lg"
      headerActions={
        <button
          onClick={() => onSave(icon, color)}
          className="px-4 py-2 rounded-xl text-caption font-semibold bg-gold text-bg hover:bg-gold/90 transition-colors"
        >
          Enregistrer
        </button>
      }
    >
      <div className="space-y-6">
        {/* Aperçu */}
        <div className="flex items-center gap-4">
          <span
            className="flex items-center justify-center w-14 h-14 rounded-lg shrink-0"
            style={{ backgroundColor: `${color}22` }}
          >
            <CategoryIcon icon={icon} color={color} size={28} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-label truncate">{categorie}</p>
            <p className="text-caption text-label/40">{icon}</p>
          </div>
        </div>

        {/* Couleurs */}
        <div className="space-y-2">
          <p className="text-caption font-semibold text-label/40">Couleur</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                aria-label={`Couleur ${c}`}
                className={`w-8 h-8 rounded-full border-2 transition-transform ${
                  color === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Recherche d'icônes */}
        <div className="space-y-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-label/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une icône…"
              className="w-full pl-8 pr-4 py-2 rounded-xl bg-white/5 border border-separator text-base text-label placeholder:text-label/30 focus:outline-none focus:border-gold/40"
            />
          </div>

          <div className="max-h-[40vh] overflow-y-auto space-y-4 pr-1">
            {groups.map((g) => (
              <div key={g.label} className="space-y-2">
                <p className="text-caption font-semibold text-label/30">{g.label}</p>
                <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                  {g.icons.map((name) => (
                    <button
                      key={name}
                      onClick={() => setIcon(name)}
                      aria-label={name}
                      className={`flex items-center justify-center aspect-square rounded-xl border transition-colors ${
                        icon === name
                          ? 'border-gold/60 bg-gold/10'
                          : 'border-separator bg-surface hover:bg-white/10'
                      }`}
                    >
                      <CategoryIcon
                        icon={name}
                        color={icon === name ? color : '#A1A1AA'}
                        size={20}
                      />
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {groups.length === 0 && (
              <p className="text-caption text-label/40 py-4 text-center">Aucune icône trouvée.</p>
            )}
          </div>
        </div>

        {isCustom && (
          <button
            onClick={onReset}
            className="flex items-center gap-2 text-caption font-bold text-label/40 hover:text-negative transition-colors"
          >
            <RotateCcw size={14} />
            Réinitialiser (icône par défaut)
          </button>
        )}
      </div>
    </Modal>
  );
};
