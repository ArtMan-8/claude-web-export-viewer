import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function BranchSwitcher({
  index,
  total,
  onSelect,
}: {
  index: number
  total: number
  onSelect: (nextIndex: number) => void
}) {
  return (
    <div className="flex items-center justify-center gap-1 py-1 text-xs text-muted-foreground">
      <Button
        variant="ghost"
        size="icon"
        className="size-5"
        disabled={index <= 0}
        onClick={() => onSelect(index - 1)}
        aria-label="Предыдущая ветка"
      >
        <ChevronLeft className="size-3.5" />
      </Button>
      <span>
        {index + 1}/{total}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="size-5"
        disabled={index >= total - 1}
        onClick={() => onSelect(index + 1)}
        aria-label="Следующая ветка"
      >
        <ChevronRight className="size-3.5" />
      </Button>
    </div>
  )
}
