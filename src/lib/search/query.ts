/**
 * Поиск — обычные слова, без языка запросов (см. §5, §U1 плана). Нормализация —
 * обрезка, схлопывание пробелов и приведение к нижнему регистру; сопоставление —
 * точная подстрока, порядок слов строгий (§U2).
 *
 * Регистр приводится один раз здесь (и один раз при построении индекса —
 * см. buildSearchIndex/buildDocIndex), а не на каждое сравнение в matchesQuery:
 * иначе toLowerCase() большого текста повторяется на каждый keystroke.
 */

export function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** Ожидает, что haystack и needle уже приведены к нижнему регистру. */
export function matchesQuery(haystack: string, needle: string): boolean {
  if (!needle) return true
  return haystack.includes(needle)
}
