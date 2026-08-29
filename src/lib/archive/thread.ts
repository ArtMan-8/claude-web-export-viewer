import type { Message } from './model'

const ROOT_KEY = '__root__'

export interface ThreadResult {
  /** Сообщения главной ветки в порядке показа */
  mainBranch: Message[]
  /** uuid родителя → все его дети (в исходном порядке), для точек ветвления */
  branches: Map<string, Message[]>
  /** true — дерево не построено (циклы/битые ссылки на parent_message_uuid) */
  fallbackToArrayOrder: boolean
  warning: string | null
  /**
   * Продолжение пути от произвольного сообщения той же логикой выбора «самой
   * свежей» ветки — нужно переключателю веток в UI: пользователь выбирает
   * другого ребёнка в точке ветвления, а дальше вниз путь достраивается так
   * же, как для главной ветки. При fallbackToArrayOrder возвращает [].
   */
  resolvePath: (fromUuid: string) => Message[]
}

function timestamp(message: Message): number {
  const value = Date.parse(message.createdAt)
  return Number.isNaN(value) ? 0 : value
}

function fallback(messages: Message[], warning: string): ThreadResult {
  return {
    mainBranch: [...messages].sort((a, b) => timestamp(a) - timestamp(b)),
    branches: new Map(),
    fallbackToArrayOrder: true,
    warning,
    resolvePath: () => [],
  }
}

/**
 * Строит дерево сообщений по parent_message_uuid и выбирает главную ветку —
 * путь до листа с самым поздним created_at в каждой точке ветвления (в
 * файловом экспорте нет current_leaf_message_uuid, поэтому это единственный
 * доступный сигнал «актуальности» ветки). Битые ссылки или циклы, которые
 * оставляют часть сообщений недостижимой, откатывают на порядок массива.
 */
export function buildThread(messages: Message[]): ThreadResult {
  if (messages.length === 0) {
    return { mainBranch: [], branches: new Map(), fallbackToArrayOrder: false, warning: null, resolvePath: () => [] }
  }

  const nodesByUuid = new Map(messages.map((m) => [m.uuid, m]))
  const childrenByParent = new Map<string, Message[]>()
  for (const message of messages) {
    const parentKey = message.parentUuid ?? ROOT_KEY
    const list = childrenByParent.get(parentKey)
    if (list) list.push(message)
    else childrenByParent.set(parentKey, [message])
  }

  const roots = childrenByParent.get(ROOT_KEY) ?? []
  if (roots.length === 0) {
    return fallback(messages, 'Не удалось определить начало беседы — сообщения показаны в порядке из файла экспорта.')
  }

  // Полный обход всех веток — только для проверки достижимости (циклы/сироты).
  // Ветки, не выбранные как главные, останутся невидимыми в mainBranch, но
  // здесь должны быть учтены все, иначе легитимное ветвление примут за цикл.
  const reachable = new Set<string>()
  const walkStack = [...roots]
  while (walkStack.length > 0) {
    const node = walkStack.pop()!
    if (reachable.has(node.uuid)) continue // защита от цикла в этом обходе
    reachable.add(node.uuid)
    walkStack.push(...(childrenByParent.get(node.uuid) ?? []))
  }

  if (reachable.size !== messages.length) {
    const lost = messages.length - reachable.size
    return fallback(
      messages,
      `Обнаружены недостижимые сообщения (${lost} шт.) — возможен цикл или битая ссылка parent_message_uuid. Показан порядок из файла экспорта.`,
    )
  }

  const subtreeMaxMemo = new Map<string, number>()
  function subtreeMax(node: Message): number {
    const cached = subtreeMaxMemo.get(node.uuid)
    if (cached !== undefined) return cached
    subtreeMaxMemo.set(node.uuid, timestamp(node)) // временно, на случай самообращения
    let max = timestamp(node)
    for (const child of childrenByParent.get(node.uuid) ?? []) {
      max = Math.max(max, subtreeMax(child))
    }
    subtreeMaxMemo.set(node.uuid, max)
    return max
  }

  const branches = new Map<string, Message[]>()

  function resolvePath(fromUuid: string): Message[] {
    const start = nodesByUuid.get(fromUuid)
    if (!start) return []

    const path: Message[] = []
    let current: Message | undefined = start
    const seen = new Set<string>()
    while (current && !seen.has(current.uuid)) {
      seen.add(current.uuid)
      path.push(current)
      const children: Message[] = childrenByParent.get(current.uuid) ?? []
      if (children.length === 0) break
      if (children.length > 1) branches.set(current.uuid, children)

      let best = children[0]
      let bestScore = subtreeMax(best)
      for (let i = 1; i < children.length; i += 1) {
        const score = subtreeMax(children[i])
        if (score > bestScore) {
          best = children[i]
          bestScore = score
        }
      }
      current = best
    }
    return path
  }

  const mainBranch = roots.flatMap((root) => resolvePath(root.uuid))

  return { mainBranch, branches, fallbackToArrayOrder: false, warning: null, resolvePath }
}

/**
 * Строит путь показа с учётом ручных переключений веток пользователем:
 * `overrides` — uuid точки ветвления → uuid выбранного ребёнка. Идёт по
 * пути по умолчанию, и на первой развилке, где выбор пользователя расходится
 * с выбором по умолчанию, продолжает от выбранного ребёнка — так поддерживаются
 * и вложенные переключения на глубоко расположенных развилках.
 */
export function resolveDisplayPath(thread: ThreadResult, overrides: Record<string, string>): Message[] {
  if (thread.fallbackToArrayOrder || thread.mainBranch.length === 0) return thread.mainBranch

  const path: Message[] = []
  let cursor: string | undefined = thread.mainBranch[0].uuid

  while (cursor) {
    const chain = thread.resolvePath(cursor)
    if (chain.length === 0) break

    let divergeAt = -1
    for (let i = 0; i < chain.length; i += 1) {
      const node = chain[i]
      const siblings = thread.branches.get(node.uuid)
      const chosen = overrides[node.uuid]
      if (siblings && siblings.length > 1 && chosen && chosen !== chain[i + 1]?.uuid) {
        divergeAt = i
        break
      }
    }

    if (divergeAt === -1) {
      path.push(...chain)
      break
    }

    path.push(...chain.slice(0, divergeAt + 1))
    cursor = overrides[chain[divergeAt].uuid]
  }

  return path
}
