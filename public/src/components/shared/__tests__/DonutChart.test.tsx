import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DonutChart } from '../DonutChart';
import React from 'react';

// Mock ResponsiveContainer to render children with fixed dimensions
vi.mock('recharts', async () => {
  const original = await vi.importActual('recharts');
  return {
    ...original,
    ResponsiveContainer: ({ children }: any) => (
      <div style={{ width: 800, height: 600 }}>{children}</div>
    ),
  };
});

describe('DonutChart', () => {
  const mockData = [
    { label: 'Logement', value: 1000, color: '#ff0000' },
    { label: 'Transport', value: 500, color: '#00ff00' },
  ];

  it('renders correctly with given data and center labels', () => {
    render(
      <DonutChart
        data={mockData}
        centerAmount="1 500 €"
        centerLabel="Total Dépenses"
        activeIndex={null}
        onSegmentClick={() => {}}
      />,
    );

    expect(screen.getByText('1 500 €')).toBeInTheDocument();
    expect(screen.getByText(/total dépenses/i)).toBeInTheDocument();
  });

  it('renders placeholder when data is empty', () => {
    render(
      <DonutChart
        data={[]}
        centerAmount="0 €"
        centerLabel="Aucune donnée"
        activeIndex={null}
        onSegmentClick={() => {}}
      />,
    );

    expect(screen.getByText('0 €')).toBeInTheDocument();
    expect(screen.getByText(/aucune donnée/i)).toBeInTheDocument();
  });
});
