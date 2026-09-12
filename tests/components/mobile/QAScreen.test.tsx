import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QAScreen } from '../../../public/src/mobile/screens/QAScreen';
import * as usePersistentFinanceQA from '../../../public/src/hooks/usePersistentFinanceQA';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../public/src/hooks/usePersistentFinanceQA');
const mockedUsePersistentFinanceQA = vi.mocked(usePersistentFinanceQA.usePersistentFinanceQA);

// Mock scrollIntoView for jsdom
window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe('QAScreen', () => {
  beforeEach(() => {
    mockedUsePersistentFinanceQA.mockReturnValue({
      messages: [],
      loading: false,
      send: vi.fn(),
      clearChat: vi.fn(),
      initMessages: vi.fn(),
      sessions: [],
      sessionsLoading: false,
      activeSessionId: null,
      selectSession: vi.fn(),
      startNewSession: vi.fn(),
      deleteSession: vi.fn(),
    });
  });

  test('renders empty state with suggested questions', () => {
    render(
      <MemoryRouter>
        <QAScreen />
      </MemoryRouter>,
    );
    expect(screen.getByText('Assistant IA')).toBeInTheDocument();
    expect(screen.getByText(/Combien ai-je dépensé en santé/i)).toBeInTheDocument();
  });
});
