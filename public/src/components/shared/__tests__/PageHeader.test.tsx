import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PageHeader } from '../PageHeader';
import React from 'react';

describe('PageHeader', () => {
  it('renders title correctly', () => {
    render(<PageHeader title="Test Title" />);
    expect(screen.getByText(/test title/i)).toBeInTheDocument();
  });

  it('renders back button and calls onBack when provided', () => {
    const onBack = vi.fn();
    render(<PageHeader title="Title" onBack={onBack} />);

    const backButton = screen.getByLabelText(/retour/i);
    expect(backButton).toBeInTheDocument();

    fireEvent.click(backButton);
    expect(onBack).toHaveBeenCalled();
  });

  it('renders right actions when provided', () => {
    render(<PageHeader title="Title" rightActions={<button>Action</button>} />);

    expect(screen.getByText(/action/i)).toBeInTheDocument();
  });
});
