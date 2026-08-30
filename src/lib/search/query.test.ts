import { describe, expect, test } from 'vitest'
import { matchesQuery, normalizeQuery } from './query'

describe('normalizeQuery', () => {
  test('обрезает пробелы по краям', () => {
    expect(normalizeQuery('  дневник снов  ')).toBe('дневник снов')
  })

  test('схлопывает несколько пробелов внутри строки в один', () => {
    expect(normalizeQuery('дневник   снов')).toBe('дневник снов')
  })

  test('пустая строка остаётся пустой', () => {
    expect(normalizeQuery('   ')).toBe('')
  })

  test('приводит к нижнему регистру', () => {
    expect(normalizeQuery('Дневник Снов')).toBe('дневник снов')
  })
})

describe('matchesQuery', () => {
  test('пустой запрос матчит всё', () => {
    expect(matchesQuery('что угодно', '')).toBe(true)
  })

  test('подстрока — ожидает, что haystack и needle уже в нижнем регистре', () => {
    expect(matchesQuery('мой дневник снов', 'дневник')).toBe(true)
    expect(matchesQuery('контент-завод', 'дневник')).toBe(false)
  })

  test('порядок слов строгий — обратный порядок не матчит', () => {
    expect(matchesQuery('дневник сновидений', 'сновидений дневник')).toBe(false)
    expect(matchesQuery('дневник сновидений', 'дневник сновидений')).toBe(true)
  })

  test('двоеточия и слэши больше не значат ничего особенного — ищутся буквально', () => {
    expect(matchesQuery('обсуждали tool/web_search from:2026-08-01', 'tool/web_search')).toBe(true)
    expect(matchesQuery('обычный текст без префиксов', 'tool/web_search')).toBe(false)
  })
})
