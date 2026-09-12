import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Modal } from './Modal';

const meta: Meta<typeof Modal> = {
  title: 'Shared/Modal',
  component: Modal,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'WCAG 2.1 AA dialog shell. Handles focus trap, Escape, backdrop click, and ' +
          'aria-modal/aria-labelledby. Use everywhere a modal is needed instead of ' +
          'building one ad-hoc.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Modal>;

const Demo = ({
  title = 'Nouvelle Saisie',
  subtitle = 'Registre des opérations',
}: {
  title?: string;
  subtitle?: string;
}) => {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-4 rounded-xl bg-gold text-bg font-bold text-xs"
      >
        Ouvrir la modale
      </button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title={title} subtitle={subtitle}>
        <div className="p-8 space-y-4 text-sm text-label">
          <p>
            Cycle <kbd>Tab</kbd> / <kbd>Shift+Tab</kbd> reste prisonnier du dialogue,
            <kbd>Esc</kbd> ferme, clic backdrop ferme.
          </p>
          <p>
            Le focus est restitué à l&apos;élément déclencheur à la fermeture (essayez : tabulez
            vers le bouton &quot;Ouvrir&quot;, puis Espace, puis Esc).
          </p>
          <input
            type="text"
            placeholder="Champ exemple"
            className="w-full rounded-xl bg-raised border border-separator p-4 text-white"
            aria-label="Champ exemple"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full py-4 rounded-xl bg-surface border border-separator text-label text-xs font-bold"
          >
            Fermer
          </button>
        </div>
      </Modal>
    </>
  );
};

export const Default: Story = {
  render: () => <Demo />,
};

export const LongContent: Story = {
  render: () => <Demo title="Audit Patrimoine" subtitle="Vue détaillée" />,
};
