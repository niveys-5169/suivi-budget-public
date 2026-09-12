import React from 'react';
import { Search, Filter } from 'lucide-react';

type MSearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  onFilterClick?: () => void;
  activeFilterCount?: number;
  placeholder?: string;
};

export const MSearchBar: React.FC<MSearchBarProps> = ({
  value,
  onChange,
  onFilterClick,
  activeFilterCount = 0,
  placeholder = 'Rechercher...',
}) => {
  return (
    <div className="px-4 py-2 flex items-center gap-4">
      <div className="relative flex-1">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-label-tertiary"
          size={18}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-11 bg-raised border border-separator rounded-m-input pl-10 pr-4 text-body text-white placeholder:text-label-tertiary focus:outline-none focus:border-gold/50 transition-colors"
        />
      </div>
      {onFilterClick && (
        <button
          onClick={onFilterClick}
          className={`relative w-11 h-11 flex items-center justify-center bg-raised border rounded-m-input transition-colors ${
            activeFilterCount > 0
              ? 'border-gold/50 text-gold'
              : 'border-separator text-label-secondary active:text-gold'
          }`}
          aria-label="Filtrer"
        >
          <Filter size={20} />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gold text-bg text-caption font-semibold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
};
