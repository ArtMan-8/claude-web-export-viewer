import { describe, expect, test } from 'vitest'
import { prepareArtifactSrcdoc } from './artifact-html'

describe('prepareArtifactSrcdoc', () => {
  test('вставляет <base> первым в <head>', () => {
    const html = '<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>T</title></head><body><a href="#x">x</a></body></html>'
    expect(prepareArtifactSrcdoc(html)).toBe(
      '<!doctype html><html lang="ru"><head><base href="about:srcdoc"><meta charset="utf-8"><title>T</title></head><body><a href="#x">x</a></body></html>',
    )
  })

  test('без <head> создаёт его сразу после <html>', () => {
    expect(prepareArtifactSrcdoc('<html><body>x</body></html>')).toBe(
      '<html><head><base href="about:srcdoc"></head><body>x</body></html>',
    )
  })

  test('фрагмент без <html>: doctype остаётся первым', () => {
    expect(prepareArtifactSrcdoc('<!DOCTYPE html>\n<p>x</p>')).toBe('<!DOCTYPE html><base href="about:srcdoc">\n<p>x</p>')
    expect(prepareArtifactSrcdoc('<p>x</p>')).toBe('<base href="about:srcdoc"><p>x</p>')
  })

  test('свой <base> артефакта не перебивает наш — наш идёт раньше', () => {
    const out = prepareArtifactSrcdoc('<html><head><base href="https://example.com/"></head></html>')
    expect(out.indexOf('about:srcdoc')).toBeLessThan(out.indexOf('example.com'))
  })
})
