import { memo, type ComponentProps } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

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
  pre: ({ node: _node, ...props }) => <pre className="overflow-x-auto" {...props} />,
}

/**
 * rehype-raw намеренно не подключается: часть текста в архиве получена через
 * web_fetch с произвольных сайтов, и исполнять её сырой HTML небезопасно.
 */
export const Markdown = memo(function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:bg-transparent prose-pre:p-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  )
})
