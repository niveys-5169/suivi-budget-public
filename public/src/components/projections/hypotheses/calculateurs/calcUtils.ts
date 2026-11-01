/** Met à jour un sous-objet de `value` (`value[key]`) en fusionnant `patch`. */
export function patchOf<T extends Record<K, object>, K extends keyof T>(
  value: T,
  key: K,
  onChange: (next: T) => void,
) {
  return (patch: Partial<T[K]>) => onChange({ ...value, [key]: { ...value[key], ...patch } });
}

/** Remplace l'élément `index` d'un triplet (années 1, 2 et 3+ de la montée en charge). */
export function withTripletValue(
  triplet: readonly [number, number, number],
  index: number,
  value: number,
): [number, number, number] {
  const next: [number, number, number] = [triplet[0], triplet[1], triplet[2]];
  next[index] = value;
  return next;
}
