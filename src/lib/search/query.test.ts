import { describe, expect, it } from 'vitest'
import { matchesQuery, normalizeQuery } from './query'

describe('normalizeQuery', () => {
  it('обрезает пробелы по краям', () => {
    expect(normalizeQuery('  дневник снов  ')).toBe('дневник снов')
  })

  it('схлопывает несколько пробелов внутри строки в один', () => {
    expect(normalizeQuery('дневник   снов')).toBe('дневник снов')
  })

  it('пустая строка остаётся пустой', () => {
    expect(normalizeQuery('   ')).toBe('')
  })
})

describe('matchesQuery', () => {
  it('пустой запрос матчит всё', () => {
    expect(matchesQuery('что угодно', '')).toBe(true)
  })

  it('регистронезависимая подстрока', () => {
    expect(matchesQuery('Мой Дневник снов', 'дневник')).toBe(true)
    expect(matchesQuery('контент-завод', 'дневник')).toBe(false)
  })

  it('порядок слов строгий — обратный порядок не матчит', () => {
    expect(matchesQuery('дневник сновидений', 'сновидений дневник')).toBe(false)
    expect(matchesQuery('дневник сновидений', 'дневник сновидений')).toBe(true)
  })

  it('двоеточия и слэши больше не значат ничего особенного — ищутся буквально', () => {
    expect(matchesQuery('обсуждали tool/web_search from:2026-08-01', 'tool/web_search')).toBe(true)
    expect(matchesQuery('обычный текст без префиксов', 'tool/web_search')).toBe(false)
  })
})
