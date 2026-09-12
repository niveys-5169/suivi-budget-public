import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useFocusTrap } from '../../public/src/hooks/useFocusTrap';

const TrapShell: React.FC<{ active: boolean }> = ({ active }) => {
  const ref = useFocusTrap<HTMLDivElement>(active);
  return (
    <div>
      <button type="button">outside-before</button>
      <div ref={ref} data-testid="trap" tabIndex={-1}>
        <button type="button">first</button>
        <button type="button">middle</button>
        <button type="button">last</button>
      </div>
      <button type="button">outside-after</button>
    </div>
  );
};

describe('useFocusTrap', () => {
  it('focuses the first focusable child on activation', () => {
    render(<TrapShell active={true} />);
    expect(document.activeElement).toBe(screen.getByText('first'));
  });

  it('does not steal focus when inactive', () => {
    const outsideBefore = document.createElement('button');
    outsideBefore.textContent = 'pre-focus';
    document.body.appendChild(outsideBefore);
    outsideBefore.focus();

    render(<TrapShell active={false} />);
    expect(document.activeElement).toBe(outsideBefore);

    document.body.removeChild(outsideBefore);
  });

  it('cycles focus forward from last to first on Tab', () => {
    render(<TrapShell active={true} />);
    const last = screen.getByText('last');
    last.focus();
    expect(document.activeElement).toBe(last);

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByText('first'));
  });

  it('cycles focus backward from first to last on Shift+Tab', () => {
    render(<TrapShell active={true} />);
    const first = screen.getByText('first');
    first.focus();
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByText('last'));
  });

  it('restores focus to the previously focused element on unmount', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'trigger';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { unmount } = render(<TrapShell active={true} />);
    expect(document.activeElement).not.toBe(trigger);

    unmount();
    expect(document.activeElement).toBe(trigger);

    document.body.removeChild(trigger);
  });
});
