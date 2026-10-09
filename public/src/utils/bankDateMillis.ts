/** Accept server timestamps and ISO dates without assuming a missing date. */
export const bankDateMillis = (value: unknown): number => {
  if (value instanceof Date) return value.getTime();
  if (
    value &&
    typeof value === 'object' &&
    'toMillis' in value &&
    typeof value.toMillis === 'function'
  )
    return value.toMillis();
  if (value && typeof value === 'object' && 'seconds' in value && typeof value.seconds === 'number')
    return value.seconds * 1000;
  if (typeof value === 'string') return Date.parse(value) || 0;
  return 0;
};
