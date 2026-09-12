import React from 'react';

interface Owner {
  id: string;
  label: string;
}

interface OwnerScopeToggleProps {
  mode: 'all' | 'custom';
  owners: Owner[];
  selectedOwnerIds: string[];
  onChange: (mode: 'all' | 'custom', ids: string[]) => void;
}

export const OwnerScopeToggle: React.FC<OwnerScopeToggleProps> = ({
  mode,
  owners,
  selectedOwnerIds,
  onChange,
}) => {
  const toggleOwner = (id: string) => {
    if (selectedOwnerIds.includes(id)) {
      const next = selectedOwnerIds.filter((i) => i !== id);
      onChange(next.length === 0 ? 'all' : 'custom', next);
    } else {
      onChange('custom', [...selectedOwnerIds, id]);
    }
  };

  return (
    <div className="flex items-center gap-2 bg-white/5 p-2 rounded-lg border border-separator">
      <button
        onClick={() => onChange('all', [])}
        className={`px-4 py-2 rounded-xl text-caption font-semibold transition-all ${
          mode === 'all' ? 'bg-white/10 text-white shadow-lg' : 'text-label/40 hover:text-label'
        }`}
      >
        TOUS
      </button>
      <div className="w-px h-4 bg-white/10 mx-1" />
      {owners.map((owner) => (
        <button
          key={owner.id}
          onClick={() => toggleOwner(owner.id)}
          className={`px-4 py-2 rounded-xl text-caption font-semibold transition-all ${
            mode === 'custom' && selectedOwnerIds.includes(owner.id)
              ? 'bg-label/20 text-white shadow-lg'
              : 'text-label/30 hover:text-label'
          }`}
        >
          {owner.label}
        </button>
      ))}
    </div>
  );
};
