import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, beforeAll } from 'vitest';
import { toHaveNoViolations } from 'jest-axe';
import { axe } from '../setup';
import { MBudgetExclusionsModal } from '../../public/src/mobile/components/MBudgetExclusionsModal';
import { MCategoryRow } from '../../public/src/mobile/components/MCategoryRow';

expect.extend(toHaveNoViolations);

describe('Mobile a11y — overlay/row patterns without eslint-disable', () => {
  beforeAll(() => {
    if (!document.body) document.body = document.createElement('body');
  });

  it('MBudgetExclusionsModal (dialog + backdrop button) has no axe violations', async () => {
    render(
      <MBudgetExclusionsModal
        categories={['Courses', 'Loyer']}
        excluded={['Loyer']}
        onClose={() => {}}
        onSave={() => {}}
      />,
    );
    // Portal renders into document.body.
    const results = await axe(document.body);
    expect(results).toHaveNoViolations();
  });

  it('MCategoryRow (CSS-only reveal, no static interactions) has no axe violations', async () => {
    const { container } = render(
      <MCategoryRow name="Courses" amount={-123.45} percentage={42} onToggleHide={() => {}} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
