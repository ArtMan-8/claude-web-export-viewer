import { describe, expect, it } from 'vitest'
import { compileTextMatcher, parseQuery } from './query'

describe('parseQuery', () => {
  it('разбирает свободный текст', () => {
    expect(parseQuery('дневник снов').text).toBe('дневник снов')
  })

  it('разбирает tool/, from:, to:, has:', () => {
    const parsed = parseQuery('tool/web_search from:2026-08-01 to:2026-08-31 has:sources контейнер')
    expect(parsed.tool).toBe('web_search')
    expect(parsed.from).toBe('2026-08-01')
    expect(parsed.to).toBe('2026-08-31')
    expect(parsed.has.has('sources')).toBe(true)
    expect(parsed.text).toBe('контейнер')
  })

  it('разбирает in: с кавычками для значения с пробелом', () => {
    const parsed = parseQuery('in:"Дневник снов" рекомендации')
    expect(parsed.projectName).toBe('Дневник снов')
    expect(parsed.text).toBe('рекомендации')
  })

  it('игнорирует неизвестный has-фильтр, но известные принимает через multiSelect', () => {
    const parsed = parseQuery('has:unknown has:tools has:thinking')
    expect(parsed.has.has('tools')).toBe(true)
    expect(parsed.has.has('thinking')).toBe(true)
    expect(parsed.has.size).toBe(2)
  })

  it('неизвестный префикс возвращается в свободный текст как есть', () => {
    expect(parseQuery('sender:human').text).toBe('sender:human')
  })

  it('пустая строка даёт пустой запрос без фильтров', () => {
    const parsed = parseQuery('   ')
    expect(parsed.text).toBe('')
    expect(parsed.tool).toBeNull()
  })
})

describe('compileTextMatcher', () => {
  it('пустой текст матчит всё', () => {
    expect(compileTextMatcher('', false).test('что угодно')).toBe(true)
  })

  it('обычный режим — регистронезависимая подстрока', () => {
    const matcher = compileTextMatcher('Дневник', false)
    expect(matcher.test('мой дневник снов')).toBe(true)
    expect(matcher.test('контент-завод')).toBe(false)
  })

  it('regex-режим применяет регулярное выражение', () => {
    const matcher = compileTextMatcher('дневник(а|ов)?', true)
    expect(matcher.test('несколько дневников подряд')).toBe(true)
  })

  it('невалидный regex не падает, а возвращает ошибку', () => {
    const matcher = compileTextMatcher('(', true)
    expect(matcher.error).toBeTruthy()
    expect(matcher.test('что угодно')).toBe(false)
  })
})
