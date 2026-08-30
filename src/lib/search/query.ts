/**
 * Поиск — обычные слова, без языка запросов (см. §5, §U1 плана). Единственная
 * нормализация — обрезка и схлопывание пробелов; сопоставление — точная
 * регистронезависимая подстрока, порядок слов строгий (§U2).
 */

export function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ')
}

export function matchesQuery(haystack: string, needle: string): boolean {
  if (!needle) return true
  return haystack.toLowerCase().includes(needle.toLowerCase())
}
