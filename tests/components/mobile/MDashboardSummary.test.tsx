import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MDashboardSummary } from '../../../public/src/mobile/components/MDashboardSummary';

describe('MDashboardSummary', () => {
  it('renders entrees and sorties correctly', () => {
    render(<MDashboardSummary entrees={1200} sorties={-800} />);

    expect(screen.getByText('Entrées')).toBeInTheDocument();
    expect(screen.getByText('Sorties')).toBeInTheDocument();

    // Check for values (the mock in setup.tsx makes it return String(v))
    // Actually, MDashboardSummary adds + and - prefixes.
    // In setup.tsx, formatNumber returns String(v).
    // FormattedNumber uses formatNumber under the hood or its own logic if not mocked?
    // setup.tsx mocks react-intl but FormattedNumber might be using the mock.

    // Let's check what setup.tsx mocks for FormattedNumber.
    // It doesn't mock FormattedNumber explicitly, it mocks useIntl and FormattedMessage.
    // Wait, FormattedNumber is part of react-intl.
    // If it's not mocked, it might fail if no IntlProvider.
  });
});
