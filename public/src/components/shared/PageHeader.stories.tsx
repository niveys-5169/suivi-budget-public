import type { Meta, StoryObj } from '@storybook/react';
import { Plus, Settings2 } from 'lucide-react';
import { PageHeader } from './PageHeader';

const meta: Meta<typeof PageHeader> = {
  title: 'Shared/PageHeader',
  component: PageHeader,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Sticky page header with optional back button and right-side action slots. ' +
          'Used as the top bar on inner pages (transactions, budget detail, etc.).',
      },
    },
  },
  args: { title: 'Flux Transactionnels' },
};

export default meta;
type Story = StoryObj<typeof PageHeader>;

export const Default: Story = {};

export const WithBackButton: Story = {
  args: {
    onBack: () => alert('back clicked'),
  },
};

export const WithRightActions: Story = {
  args: {
    onBack: () => alert('back clicked'),
    rightActions: (
      <>
        <button
          type="button"
          aria-label="Ajouter"
          className="p-2 rounded-xl bg-gold/10 text-gold hover:bg-gold/20 transition-colors"
        >
          <Plus size={20} />
        </button>
        <button
          type="button"
          aria-label="Paramètres"
          className="p-2 rounded-xl bg-white/5 text-label hover:bg-white/10 transition-colors"
        >
          <Settings2 size={20} />
        </button>
      </>
    ),
  },
};
