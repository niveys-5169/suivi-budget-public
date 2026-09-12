import React, { useState, useRef, useEffect, useId } from 'react';

interface CategoryAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  categories: string[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const CategoryAutocomplete: React.FC<CategoryAutocompleteProps> = ({
  value,
  onChange,
  categories,
  placeholder = 'Ex: Loisirs, Transport...',
  disabled = false,
  className = '',
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [open, setOpen] = useState(false);
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered =
    inputValue.trim().length > 0
      ? categories.filter((c) => c.toLowerCase().includes(inputValue.toLowerCase()))
      : [];

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    onChange(e.target.value);
    setOpen(true);
  };

  const handleSelect = (cat: string) => {
    setInputValue(cat);
    onChange(cat);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && filtered.length > 0}
        aria-controls={listId}
        type="text"
        value={inputValue}
        onChange={handleInput}
        onFocus={() => inputValue.trim().length > 0 && setOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
      />
      {open && filtered.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 w-full mt-1 rounded-lg bg-[#121622] border border-separator overflow-hidden"
        >
          {filtered.slice(0, 8).map((cat) => (
            <li
              key={cat}
              role="option"
              aria-selected={cat === value}
              onMouseDown={() => handleSelect(cat)}
              className="px-4 py-4 text-sm text-white hover:bg-gold/10 hover:text-gold cursor-pointer transition-colors"
            >
              {cat}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
