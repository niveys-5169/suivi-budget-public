/** Encodes a category name for use as a Firestore document ID. Categories containing '/' are percent-encoded with a prefix to avoid Firestore path-segment splits. */
export function budgetDocKey(cat: string): string {
  const c = String(cat || '');
  return c.includes('/') ? `__enc__${encodeURIComponent(c)}` : c;
}
