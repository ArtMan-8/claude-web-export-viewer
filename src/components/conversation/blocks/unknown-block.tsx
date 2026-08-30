import { useState } from 'react'
import { ChevronRight, HelpCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible'

/** Формат экспорта нестабилен — новый тип блока показываем как есть, а не роняем интерфейс. */
export function UnknownBlock({ blockType, raw }: { blockType: string; raw: unknown }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-md border border-dashed bg-muted/20">
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted-foreground">
        <ChevronRight className={`size-3.5 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
        <HelpCircle className="size-3.5 shrink-0" />
        <span>{t('common.unknownBlock', { type: blockType })}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3">
        <pre className="overflow-x-auto rounded bg-background p-2 text-xs">{JSON.stringify(raw, null, 2)}</pre>
      </CollapsibleContent>
    </Collapsible>
  )
}
