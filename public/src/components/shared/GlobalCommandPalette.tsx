import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CommandPalette } from '../dashboard/v2/CommandPalette';

const OPEN_EVENT = 'open-command-palette';

/** Ouvre la palette de recherche depuis n'importe quel composant. */
export const openCommandPalette = () => {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
};

/** Palette Ctrl/Cmd+K globale (desktop) : navigue vers n'importe quelle route. */
export const GlobalCommandPalette: React.FC = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((p) => !p);
      }
    };
    const onOpen = () => setOpen(true);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  return (
    <CommandPalette
      open={open}
      onClose={() => setOpen(false)}
      onNavigate={(to) => {
        setOpen(false);
        navigate(to);
      }}
    />
  );
};
