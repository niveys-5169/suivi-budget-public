import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton } from '../Skeleton';
import React from 'react';

describe('Skeleton', () => {
  it('renders a shimmer placeholder hidden from assistive tech', () => {
    const { container } = render(<Skeleton />);

    const el = container.firstElementChild as HTMLElement;
    expect(el).toBeInTheDocument();
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.className).toContain('animate-shimmer');
  });

  it('merges custom sizing classes', () => {
    const { container } = render(<Skeleton className="h-11 w-full rounded-card" />);

    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('h-11');
    expect(el.className).toContain('rounded-card');
  });
});
