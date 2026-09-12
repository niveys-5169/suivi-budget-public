import { useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useHaptics } from '../hooks/useHaptics';
import { NAV_ITEMS, getTabIndex } from './navItems';

/** Distance from the left/right screen edge where a swipe may start (px). */
const EDGE_ZONE = 28;
/** Minimum horizontal travel to trigger navigation (px). */
const THRESHOLD = 60;
/** Horizontal dominance ratio: |dx| must exceed |dy| * this. */
const HORIZONTAL_RATIO = 1.5;

type Edge = 'left' | 'right' | null;

/**
 * iOS-style edge-swipe navigation between the main mobile tabs.
 * A gesture starting near the left edge and moving right goes to the previous
 * tab; one starting near the right edge and moving left goes to the next tab.
 * Starting near the edges keeps it from clashing with in-content horizontal
 * gestures (swipe-to-validate on transactions, scrollable charts/pills).
 *
 * Returns no-op handlers when the current route is not a main tab (e.g. /qa).
 */
export const useEdgeSwipeNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { snap } = useHaptics();

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const edgeRef = useRef<Edge>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    startXRef.current = touch.clientX;
    startYRef.current = touch.clientY;
    if (touch.clientX <= EDGE_ZONE) edgeRef.current = 'left';
    else if (touch.clientX >= window.innerWidth - EDGE_ZONE) edgeRef.current = 'right';
    else edgeRef.current = null;
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const edge = edgeRef.current;
      edgeRef.current = null;
      if (!edge) return;

      const currentIndex = getTabIndex(location.pathname);
      if (currentIndex === -1) return;

      const touch = e.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - startXRef.current;
      const dy = touch.clientY - startYRef.current;

      if (Math.abs(dx) < THRESHOLD || Math.abs(dx) < Math.abs(dy) * HORIZONTAL_RATIO) return;

      // Left edge + swipe right → previous tab; right edge + swipe left → next tab.
      let target = currentIndex;
      if (edge === 'left' && dx > 0) target = currentIndex - 1;
      else if (edge === 'right' && dx < 0) target = currentIndex + 1;

      if (target === currentIndex || target < 0 || target >= NAV_ITEMS.length) return;

      snap();
      navigate(NAV_ITEMS[target]!.to);
    },
    [location.pathname, navigate, snap],
  );

  return { onTouchStart, onTouchEnd };
};
