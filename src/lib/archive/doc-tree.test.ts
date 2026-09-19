import { describe, expect, test } from 'vitest'
import type { ProjectDoc } from './model'
import { buildDocTree, type DocTreeNode } from './doc-tree'

function doc(filename: string): ProjectDoc {
  return { uuid: `u-${filename}`, filename, content: '', createdAt: '' }
}

function outline(nodes: DocTreeNode[]): unknown[] {
  return nodes.map((n) => (n.kind === 'dir' ? { [n.name]: outline(n.children) } : n.name))
}

describe('buildDocTree', () => {
  test('корень и папки: папки раньше файлов, внутри групп — по алфавиту', () => {
    const tree = buildDocTree([
      doc('zeta.md'),
      doc('target-architecture/02-b.md'),
      doc('alpha.md'),
      doc('ideas/x.md'),
      doc('target-architecture/01-a.md'),
    ])

    expect(outline(tree)).toEqual([
      { ideas: ['x.md'] },
      { 'target-architecture': ['01-a.md', '02-b.md'] },
      'alpha.md',
      'zeta.md',
    ])
  })

  test('вложенность 2: search-practice/architectures/', () => {
    const tree = buildDocTree([doc('search-practice/architectures/a.md'), doc('search-practice/b.md')])

    expect(outline(tree)).toEqual([{ 'search-practice': [{ architectures: ['a.md'] }, 'b.md'] }])
    const dir = tree[0]
    expect(dir.path).toBe('search-practice')
    expect(dir.children[0].path).toBe('search-practice/architectures')
    expect(dir.children[0].children[0].path).toBe('search-practice/architectures/a.md')
  })

  test('файл без «/» — в корне, узел ссылается на документ', () => {
    const d = doc('readme.md')
    const tree = buildDocTree([d])
    expect(tree).toEqual([{ kind: 'doc', name: 'readme.md', path: 'readme.md', children: [], doc: d }])
  })

  test('пустой filename — в корне с пустым именем', () => {
    const tree = buildDocTree([doc(''), doc('a.md')])
    expect(outline(tree)).toEqual(['', 'a.md'])
  })

  test('единственная корневая папка не схлопывается', () => {
    const tree = buildDocTree([doc('claude/a.md'), doc('claude/b.md')])
    expect(outline(tree)).toEqual([{ claude: ['a.md', 'b.md'] }])
  })

  test('пустой список документов даёт пустое дерево', () => {
    expect(buildDocTree([])).toEqual([])
  })
})
