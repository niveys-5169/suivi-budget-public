import React, { useState, useRef, useCallback } from 'react';
import { RefreshCcw } from 'lucide-react';
import { useHaptics } from '../hooks/useHaptics';

interface PullToRefreshWrapperProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  disabled?: boolean;
}

const THRESHOLD = 72;

export const PullToRefreshWrapper: React.FC<PullToRefreshWrapperProps> = ({
  onRefresh,
  children,
  disabled,
}) => {
  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const isRefreshingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const snapFiredRef = useRef(false);
  const { snap, success } = useHaptics();

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || isRefreshingRef.current) return;
      // PTR triggers only when this container's top edge is at or near the viewport top.
      // Using getBoundingClientRect() works regardless of absolute page scroll position,
      // so the gesture fires correctly on any section of the page (not just scrollY=0).
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect && rect.top < -20) return;
      startYRef.current = e.touches[0]?.clientY ?? 0;
      snapFiredRef.current = false;
    },
    [disabled],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (startYRef.current === null || disabled || isRefreshingRef.current) return;
      const dy = (e.touches[0]?.clientY ?? 0) - startYRef.current;
      if (dy <= 0) {
        setPullY(0);
        return;
      }
      const nextY = Math.min(dy * 0.5, THRESHOLD * 1.5);
      // Fire a "snap" haptic exactly once when the threshold is crossed
      if (nextY >= THRESHOLD && !snapFiredRef.current) {
        snapFiredRef.current = true;
        snap();
      } else if (nextY < THRESHOLD) {
        snapFiredRef.current = false;
      }
      setPullY(nextY);
    },
    [disabled, snap],
  );

  const onTouchEnd = useCallback(async () => {
    if (startYRef.current === null) return;
    startYRef.current = null;

    setPullY((prev) => {
      if (prev >= THRESHOLD && !isRefreshingRef.current) {
        isRefreshingRef.current = true;
        setIsRefreshing(true);
        onRefresh().finally(() => {
          isRefreshingRef.current = false;
          setIsRefreshing(false);
          setPullY(0);
          success();
        });
        return THRESHOLD;
      }
      return 0;
    });
  }, [onRefresh, success]);

  const progress = Math.min(pullY / THRESHOLD, 1);
  const indicatorHeight = isRefreshing ? THRESHOLD : pullY;

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{
          height: indicatorHeight > 0 ? `${indicatorHeight}px` : 0,
          transition: isRefreshing || pullY === 0 ? 'height 0.3s ease' : 'none',
        }}
      >
        <div
          className="w-10 h-10 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center"
          style={{
            opacity: progress,
            transform: `scale(${0.4 + progress * 0.6})`,
            transition: isRefreshing ? 'none' : 'opacity 0.1s, transform 0.1s',
          }}
        >
          <RefreshCcw
            size={18}
            className={`text-gold ${isRefreshing ? 'animate-spin' : ''}`}
            style={{ transform: isRefreshing ? undefined : `rotate(${progress * 180}deg)` }}
          />
        </div>
      </div>
      {children}
    </div>
  );
};
