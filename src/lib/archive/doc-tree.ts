import type { ProjectDoc } from './model'

/** Узел дерева документов проекта — только для UI, модель не меняется (§4.5 плана 18-09-2026). */
export interface DocTreeNode {
  kind: 'dir' | 'doc'
  name: string // сегмент пути
  path: string // полный путь до узла
  children: DocTreeNode[] // только у dir; папки раньше файлов, внутри групп — по алфавиту
  doc?: ProjectDoc // только у doc
}

function sortNodes(nodes: DocTreeNode[]): DocTreeNode[] {
  // Порядок как в файловом менеджере (Q13): папки, затем файлы, по алфавиту внутри групп
  nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  for (const node of nodes) if (node.kind === 'dir') sortNodes(node.children)
  return nodes
}

/**
 * Строит дерево из `filename` документов, разделённых `/`. Документ без `/` —
 * в корне; пустой `filename` — в корне с пустым именем (UI подставит «Без имени»).
 * Единственная корневая папка не схлопывается (Q15).
 */
export function buildDocTree(docs: ProjectDoc[]): DocTreeNode[] {
  const root: DocTreeNode[] = []
  const dirByPath = new Map<string, DocTreeNode>()

  for (const doc of docs) {
    const segments = doc.filename.split('/').filter((s) => s.length > 0)
    const name = segments.pop() ?? ''

    let siblings = root
    let dirPath = ''
    for (const segment of segments) {
      dirPath = dirPath ? `${dirPath}/${segment}` : segment
      let dir = dirByPath.get(dirPath)
      if (!dir) {
        dir = { kind: 'dir', name: segment, path: dirPath, children: [] }
        dirByPath.set(dirPath, dir)
        siblings.push(dir)
      }
      siblings = dir.children
    }

    siblings.push({ kind: 'doc', name, path: doc.filename, children: [], doc })
  }

  return sortNodes(root)
}
