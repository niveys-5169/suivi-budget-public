import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '../../public/src/components/shared/EmptyState';

describe('EmptyState', () => {
  it('renders title only', () => {
    render(<EmptyState title="No data" />);
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<EmptyState title="No data" description="Try again later." />);
    expect(screen.getByText('Try again later.')).toBeInTheDocument();
  });

  it('renders an icon when provided', () => {
    render(<EmptyState title="No data" icon={<span data-testid="icon">★</span>} />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders and triggers CTA button', () => {
    const onClick = vi.fn();
    render(<EmptyState title="Empty" action={{ label: 'Add one', onClick }} />);
    const btn = screen.getByRole('button', { name: /add one/i });
    btn.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not render description or action when omitted', () => {
    const { container } = render(<EmptyState title="Only title" />);
    expect(container.querySelectorAll('button')).toHaveLength(0);
    expect(container.querySelectorAll('p').length).toBeLessThanOrEqual(1);
  });
});
