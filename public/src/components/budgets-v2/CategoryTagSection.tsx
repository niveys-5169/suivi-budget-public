import React from 'react';
import { Plus, X, ChevronDown, ChevronUp } from 'lucide-react';

const TAG_INPUT_CLS =
  'h-9 rounded-lg border border-separator bg-raised text-caption px-4 text-white placeholder:text-label-tertiary focus:outline-none focus:ring-1 focus:ring-gold/40 transition-all';

interface TagSectionProps {
  label: string;
  tagColor: 'emerald' | 'ruby';
  tags: string[];
  onTogglePicker: () => void;
  isPickerOpen: boolean;
  onRemove: (tag: string) => void;
  inputValue: string;
  onInputChange: (v: string) => void;
  onAdd: () => void;
  placeholder: string;
  pickerToggleLabel: string;
  emptyLabel: string;
}

export const CategoryTagSection: React.FC<TagSectionProps> = ({
  label,
  tagColor,
  tags,
  onTogglePicker,
  isPickerOpen,
  onRemove,
  inputValue,
  onInputChange,
  onAdd,
  placeholder,
  pickerToggleLabel,
  emptyLabel,
}) => {
  const tagClasses =
    tagColor === 'emerald'
      ? 'bg-positive/10 border-positive text-positive'
      : 'bg-negative/10 border-negative/30 text-negative';
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-caption font-semibold text-label/40">{label}</p>
        <button
          type="button"
          onClick={onTogglePicker}
          className={`text-caption font-semibold flex items-center gap-2 transition-all ${
            isPickerOpen ? 'text-gold' : 'text-label/40 hover:text-gold'
          }`}
        >
          {isPickerOpen ? (
            <ChevronUp size={10} aria-hidden="true" />
          ) : (
            <ChevronDown size={10} aria-hidden="true" />
          )}
          {pickerToggleLabel}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 min-h-[36px] max-h-[100px] overflow-y-auto pr-1 custom-scrollbar">
        {tags.length === 0 ? (
          <span className="text-caption font-semibold text-label/20 py-2">{emptyLabel}</span>
        ) : (
          tags.map((cat) => (
            <span
              key={cat}
              className={`inline-flex items-center gap-2 px-2 h-7 rounded-lg border text-caption font-bold ${tagClasses}`}
            >
              {cat}
              <button
                type="button"
                onClick={() => onRemove(cat)}
                className="opacity-40 hover:opacity-100 transition-opacity"
                aria-label={`Remove ${cat}`}
              >
                <X size={10} />
              </button>
            </span>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder={placeholder}
          aria-label={placeholder}
          className={`${TAG_INPUT_CLS} flex-1`}
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onAdd())}
        />
        <button
          type="button"
          onClick={onAdd}
          className="h-9 px-4 rounded-lg bg-gold/10 border border-gold/30 text-gold hover:bg-gold hover:text-bg transition-all text-caption font-semibold flex items-center"
          aria-label={placeholder}
        >
          <Plus size={12} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
