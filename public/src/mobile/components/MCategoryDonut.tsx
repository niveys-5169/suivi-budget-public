import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { FormattedNumber } from 'react-intl';

interface MCategoryDonutProps {
  data: { name: string; value: number; color: string }[];
  total: number;
  label: string;
}

export const MCategoryDonut: React.FC<MCategoryDonutProps> = ({ data, total, label }) => {
  if (data.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center">
        <p className="text-footnote text-label-tertiary">Aucune donnée</p>
      </div>
    );
  }

  return (
    <div className="h-[220px] w-full relative flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            innerRadius={65}
            outerRadius={85}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-2">
        <p className="text-display font-bold text-white tabular-nums leading-none">
          <FormattedNumber
            value={Math.abs(total)}
            style="currency"
            currency="EUR"
            maximumFractionDigits={0}
          />
        </p>
        <p className="text-caption font-semibold text-label-tertiary mt-1">{label}</p>
      </div>
    </div>
  );
};
