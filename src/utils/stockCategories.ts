/** Used until the admin saves their own list of material categories. */
export const DEFAULT_STOCK_CATEGORIES = ['Tea & Coffee', 'Dairy & Milk', 'Syrups & Flavors', 'Bakery & Flour', 'Produce', 'Packaging', 'Other'];
export const MAX_STOCK_CATEGORY_LENGTH = 60;

/** The saved list, or null when none was saved (or it is unreadable), meaning the defaults apply. */
export function parseStockCategories(value: unknown): string[] | null {
  if (typeof value !== 'string' || !value) return null;
  try {
    const list = JSON.parse(value);
    return Array.isArray(list) ? list.filter((name): name is string => typeof name === 'string') : null;
  } catch {
    return null;
  }
}

/** Trims names and drops blanks and repeats, compared without case: "Dairy" and "dairy" are one category. */
export function cleanStockCategories(names: unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of names) {
    const trimmed = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
    if (!trimmed || seen.has(trimmed.toLowerCase())) continue;
    seen.add(trimmed.toLowerCase());
    result.push(trimmed);
  }
  return result;
}
