/** Identifiant d'un nouvel élément de liste. */
export const newId = (): string => crypto.randomUUID();

export function updateItem<T extends { id: string }>(
  list: T[],
  id: string,
  patch: Partial<T>,
): T[] {
  return list.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

export function removeItem<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((item) => item.id !== id);
}
