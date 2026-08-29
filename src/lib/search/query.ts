/**
 * Разбирает строку поискового запроса на свободный текст и префиксные
 * фильтры: tool/<имя>, from:<дата>, to:<дата>, in:<проект>, has:tools|thinking|sources.
 * Значение с пробелами берётся в кавычки: in:"Дневник снов".
 */

export interface ParsedQuery {
  text: string
  tool: string | null
  from: string | null
  to: string | null
  projectName: string | null
  has: Set<'tools' | 'thinking' | 'sources'>
}

// Разделитель ключ/значение — ':' или '/' (tool/web_search и tool:web_search равнозначны)
const TOKEN_RE = /(\w+)[:/]"([^"]*)"|(\w+)[:/](\S+)|"([^"]*)"|(\S+)/g
const HAS_VALUES = new Set(['tools', 'thinking', 'sources'])

export function parseQuery(input: string): ParsedQuery {
  const result: ParsedQuery = { text: '', tool: null, from: null, to: null, projectName: null, has: new Set() }
  const freeWords: string[] = []

  for (const match of input.trim().matchAll(TOKEN_RE)) {
    const key = match[1] ?? match[3]
    const value = match[2] ?? match[4]
    const quoted = match[5]
    const bare = match[6]

    if (key && value !== undefined) {
      const lowerKey = key.toLowerCase()
      switch (lowerKey) {
        case 'tool':
          result.tool = value
          break
        case 'from':
          result.from = value
          break
        case 'to':
          result.to = value
          break
        case 'in':
          result.projectName = value
          break
        case 'has':
          if (HAS_VALUES.has(value)) result.has.add(value as 'tools' | 'thinking' | 'sources')
          break
        default:
          freeWords.push(`${key}:${value}`) // неизвестный префикс — не теряем, ищем как текст
      }
      continue
    }

    if (quoted !== undefined) {
      freeWords.push(quoted)
      continue
    }

    if (bare) freeWords.push(bare)
  }

  result.text = freeWords.join(' ').trim()
  return result
}

/** Компилирует текстовую часть запроса в матчер: обычная подстрока или, в regex-режиме, RegExp. */
export function compileTextMatcher(text: string, regexMode: boolean): { test(haystack: string): boolean; error: string | null } {
  if (!text) return { test: () => true, error: null }

  if (!regexMode) {
    const needle = text.toLowerCase()
    return { test: (haystack) => haystack.toLowerCase().includes(needle), error: null }
  }

  try {
    const re = new RegExp(text, 'i')
    return { test: (haystack) => re.test(haystack), error: null }
  } catch (error) {
    return { test: () => false, error: error instanceof Error ? error.message : String(error) }
  }
}
