import { Link2 } from 'lucide-react'
import { Markdown } from '@/components/common/markdown'
import type { Citation } from '@/lib/archive/model'

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function TextBlock({ text, citations }: { text: string; citations: Citation[] }) {
  return (
    <div className="space-y-2">
      <Markdown>{text}</Markdown>
      {citations.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {citations.map((citation, i) => (
            <a
              key={`${citation.url}-${i}`}
              href={citation.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Link2 className="size-3" />
              {hostnameOf(citation.url)}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
