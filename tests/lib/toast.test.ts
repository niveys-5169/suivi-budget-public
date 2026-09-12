import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toast } from '../../public/src/lib/toast';

describe('toast', () => {
  let captured: Array<{ type: string; detail: any }> = [];
  let dispatchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    captured = [];
    dispatchSpy = vi.spyOn(window, 'dispatchEvent').mockImplementation((event) => {
      const e = event as CustomEvent;
      captured.push({ type: e.type, detail: e.detail });
      return true;
    });
  });

  afterEach(() => {
    dispatchSpy.mockRestore();
  });

  it('dispatches show-toast with success type', () => {
    toast.success('Saved');
    expect(captured).toHaveLength(1);
    expect(captured[0]!.type).toBe('show-toast');
    expect(captured[0]!.detail).toMatchObject({
      type: 'success',
      message: 'Saved',
      duration: 4000,
    });
  });

  it('dispatches show-toast with error type and longer default duration', () => {
    toast.error('Boom');
    expect(captured[0]!.detail).toMatchObject({ type: 'error', message: 'Boom', duration: 6000 });
  });

  it('dispatches show-toast with info type', () => {
    toast.info('Heads up', 2000);
    expect(captured[0]!.detail).toMatchObject({
      type: 'info',
      message: 'Heads up',
      duration: 2000,
    });
  });

  it('dispatches loading toast with id and zero duration (sticky)', () => {
    toast.loading('Syncing…', 'sync-1');
    expect(captured[0]!.detail).toMatchObject({
      type: 'loading',
      message: 'Syncing…',
      duration: 0,
      id: 'sync-1',
    });
  });

  it('dispatches dismiss-toast with the given id', () => {
    toast.dismiss('sync-1');
    expect(captured[0]!.type).toBe('dismiss-toast');
    expect(captured[0]!.detail).toEqual({ id: 'sync-1' });
  });

  it('honours custom duration on success', () => {
    toast.success('Saved', 1500);
    expect(captured[0]!.detail.duration).toBe(1500);
  });
});
