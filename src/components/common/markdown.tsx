import { memo, type ComponentProps } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { mermaidSourceFromPre } from '~/lib/mermaid-fence'
import { MermaidDiagram } from './mermaid-diagram'

// Таблицы и блоки кода не переносятся по словам и иначе раздвигают всю
// страницу вширь (flex-контейнеры без overflow наследуют их минимальную
// ширину вверх по дереву). overflow-x-auto даёт им собственный скролл и
// обнуляет их вклад в это распространение — горизонтальный скролл остаётся
// только внутри самого блока.
const components: ComponentProps<typeof ReactMarkdown>['components'] = {
  table: ({ node: _node, ...props }) => (
    <div className="overflow-x-auto">
      <table {...props} />
    </div>
  ),
  // Фенс ```mermaid уходит в MermaidDiagram; обычный <pre> остаётся у него запасным видом
  pre: ({ node, ...props }) => {
    const source = mermaidSourceFromPre(node)
    const pre = <pre className="overflow-x-auto" {...props} />
    return source ? <MermaidDiagram source={source} fallback={pre} /> : pre
  },
}

/**
 * rehype-raw намеренно не подключается: часть текста в архиве получена через
 * web_fetch с произвольных сайтов, и исполнять её сырой HTML небезопасно.
 */
export const Markdown = memo(function Markdown({ children }: { children: string }) {
  // Фон и отступ `pre` заданы глобально в index.css (`.prose pre`)
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  )
})
