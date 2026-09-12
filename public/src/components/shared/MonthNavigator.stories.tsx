import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { MonthNavigator } from './MonthNavigator';

const meta: Meta<typeof MonthNavigator> = {
  title: 'Shared/MonthNavigator',
  component: MonthNavigator,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Stateless month-picker. Emits a Date pointing to the first day of the ' +
          'selected month. Highlights when the displayed month is the current calendar month.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof MonthNavigator>;

const Demo = ({ initialMonth }: { initialMonth: Date }) => {
  const [month, setMonth] = useState(initialMonth);
  return (
    <div className="bg-raised/40 border border-separator rounded-lg max-w-md">
      <MonthNavigator month={month} onChange={setMonth} />
    </div>
  );
};

export const CurrentMonth: Story = {
  render: () => <Demo initialMonth={new Date()} />,
};

export const PastMonth: Story = {
  render: () => <Demo initialMonth={new Date(2024, 5, 1)} />,
};

export const FutureMonth: Story = {
  render: () => <Demo initialMonth={new Date(2027, 0, 1)} />,
};
