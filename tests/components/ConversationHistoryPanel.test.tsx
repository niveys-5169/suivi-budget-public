import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ConversationHistoryPanel } from '../../public/src/components/ConversationHistoryPanel';

describe('ConversationHistoryPanel', () => {
  const mockSessions = [
    {
      id: 'sess-1',
      title: 'First chat',
      createdAt: { toDate: () => new Date() } as any,
      updatedAt: { toDate: () => new Date() } as any,
      messages: [],
      messageCount: 0,
    },
  ];

  it('renders sessions and handles actions', async () => {
    const onSelect = vi.fn();
    const onStartNew = vi.fn();
    const onDelete = vi.fn();

    // Mock window.confirm
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <ConversationHistoryPanel
        sessions={mockSessions}
        activeSessionId={null}
        onSelectSession={onSelect}
        onStartNewSession={onStartNew}
        onDeleteSession={onDelete}
      />,
    );

    expect(screen.getByText('First chat')).toBeInTheDocument();
    expect(screen.getByText('Nouvelle conversation')).toBeInTheDocument();

    fireEvent.click(screen.getByText('First chat'));
    expect(onSelect).toHaveBeenCalledWith('sess-1');

    fireEvent.click(screen.getByText('Nouvelle conversation'));
    expect(onStartNew).toHaveBeenCalled();

    const deleteBtn = screen.getByTitle('Supprimer la conversation');
    fireEvent.click(deleteBtn);
    // La confirmation est désormais asynchrone (confirm() renvoie une Promise ;
    // sans ConfirmHost monté, elle retombe sur window.confirm mocké → true).
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('sess-1'));
  });

  it('renders empty state', () => {
    render(
      <ConversationHistoryPanel
        sessions={[]}
        activeSessionId={null}
        onSelectSession={vi.fn()}
        onStartNewSession={vi.fn()}
        onDeleteSession={vi.fn()}
      />,
    );
    expect(screen.getByText('Aucun historique')).toBeInTheDocument();
  });
});
