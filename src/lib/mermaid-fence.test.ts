import { mermaidSourceFromPre } from './mermaid-fence'

function pre(code: object | null, extra: object[] = []) {
  return { type: 'element', tagName: 'pre', children: [...(code ? [code] : []), ...extra] }
}

function code(className: string[] | undefined, children: object[]) {
  return { type: 'element', tagName: 'code', properties: className ? { className } : {}, children }
}

describe('mermaidSourceFromPre', () => {
  test('берёт текст из code.language-mermaid', () => {
    const node = pre(code(['language-mermaid'], [{ type: 'text', value: 'flowchart TD\n  A --> B\n' }]))
    expect(mermaidSourceFromPre(node)).toBe('flowchart TD\n  A --> B')
  })

  test('склеивает текст, разбитый подсветкой на span-ы', () => {
    const node = pre(
      code(
        ['hljs', 'language-mermaid'],
        [
          { type: 'element', tagName: 'span', children: [{ type: 'text', value: 'graph' }] },
          { type: 'text', value: ' LR' },
        ],
      ),
    )
    expect(mermaidSourceFromPre(node)).toBe('graph LR')
  })

  test('игнорирует пробельные текстовые узлы вокруг code', () => {
    const node = pre(code(['language-mermaid'], [{ type: 'text', value: 'graph LR' }]), [{ type: 'text', value: '\n' }])
    expect(mermaidSourceFromPre(node)).toBe('graph LR')
  })

  test('другой язык — null', () => {
    expect(mermaidSourceFromPre(pre(code(['language-ts'], [{ type: 'text', value: 'x' }])))).toBeNull()
  })

  test('фенс без языка — null', () => {
    expect(mermaidSourceFromPre(pre(code(undefined, [{ type: 'text', value: 'x' }])))).toBeNull()
  })

  test('пустая диаграмма — null', () => {
    expect(mermaidSourceFromPre(pre(code(['language-mermaid'], [{ type: 'text', value: '  \n' }])))).toBeNull()
  })

  test('не pre или без code — null', () => {
    expect(mermaidSourceFromPre({ type: 'element', tagName: 'div', children: [] })).toBeNull()
    expect(mermaidSourceFromPre(pre(null))).toBeNull()
    expect(mermaidSourceFromPre(undefined)).toBeNull()
  })
})
