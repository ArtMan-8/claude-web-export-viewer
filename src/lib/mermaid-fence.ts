/**
 * Достаёт исходник диаграммы из hast-узла `<pre>`, который react-markdown
 * строит для фенса ```mermaid. Работает по дереву, а не по React-children:
 * rehype-highlight может разбить содержимое `<code>` на span'ы, а нам нужен
 * плоский текст.
 */

interface HastNode {
  type: string
  value?: string
  tagName?: string
  properties?: { className?: string | string[] }
  children?: HastNode[]
}

function textOf(node: HastNode): string {
  if (node.type === 'text') return node.value ?? ''
  return (node.children ?? []).map(textOf).join('')
}

function hasLanguage(node: HastNode, language: string): boolean {
  const className = node.properties?.className
  const classes = Array.isArray(className) ? className : className ? [className] : []
  return classes.includes(`language-${language}`)
}

/** Текст диаграммы, если `pre` содержит ровно один `<code class="language-mermaid">`; иначе null. */
export function mermaidSourceFromPre(pre: unknown): string | null {
  const node = pre as HastNode | undefined
  if (!node || node.tagName !== 'pre') return null

  const children = (node.children ?? []).filter((child) => !(child.type === 'text' && child.value?.trim() === ''))
  const code = children.length === 1 ? children[0] : undefined
  if (!code || code.type !== 'element' || code.tagName !== 'code' || !hasLanguage(code, 'mermaid')) return null

  const source = textOf(code).trim()
  return source ? source : null
}
