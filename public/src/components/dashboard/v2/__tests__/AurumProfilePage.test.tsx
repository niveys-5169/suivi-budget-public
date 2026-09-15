import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { AurumProfilePage } from '../AurumProfilePage';

vi.mock('../../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { displayName: 'Alice', email: 'alice@example.com' },
    signOut: vi.fn(),
  }),
}));

vi.mock('../../../../hooks/usePreferences', () => ({
  usePreferences: () => ({ privacyMode: false, setPrivacyMode: vi.fn() }),
}));

describe('AurumProfilePage', () => {
  it('renders a local avatar without exposing the account email to DiceBear', () => {
    const { container } = render(<AurumProfilePage />);

    expect(screen.getByLabelText('Profil')).not.toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.innerHTML).not.toContain('dicebear');
    expect(container.innerHTML).not.toContain('alice@example.com?');
  });
});
