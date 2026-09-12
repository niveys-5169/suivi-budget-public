/**
 * Haptic feedback via the Vibration API.
 * Degrades gracefully on iOS (navigator.vibrate is undefined) and
 * in environments where the user has disabled vibration.
 *
 * Usage:
 *   const { light, success } = useHaptics();
 *   <button onPointerDown={light}>…</button>
 */

type HapticFn = () => void;

interface Haptics {
  /** 10ms — icon tap, nav switch */
  light: HapticFn;
  /** 25ms — CTA button, confirm */
  medium: HapticFn;
  /** 40ms — destructive action */
  heavy: HapticFn;
  /** [10, 40, 10] — success confirmation */
  success: HapticFn;
  /** [30, 20, 30] — error / warning */
  error: HapticFn;
  /** [15, 30] — pull-to-refresh threshold reached */
  snap: HapticFn;
}

const vibe = (pattern: number | number[]) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Silently ignore — some browsers throw on vibrate()
  }
};

export const useHaptics = (): Haptics => ({
  light: () => vibe(10),
  medium: () => vibe(25),
  heavy: () => vibe(40),
  success: () => vibe([10, 40, 10]),
  error: () => vibe([30, 20, 30]),
  snap: () => vibe([15, 30]),
});
