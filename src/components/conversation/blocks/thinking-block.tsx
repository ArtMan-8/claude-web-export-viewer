import { Sparkles } from 'lucide-react'

/** thinking почти всегда скрыт в экспорте — показываем то, что есть: краткое summary. */
export function ThinkingBlock({ summaries, text }: { summaries: string[]; text: string }) {
  const content = summaries.join(' ') || text
  if (!content) return null

  return (
    <p className="flex items-start gap-1.5 text-sm italic text-muted-foreground">
      <Sparkles className="mt-0.5 size-3.5 shrink-0" />
      <span>{content}</span>
    </p>
  )
}
