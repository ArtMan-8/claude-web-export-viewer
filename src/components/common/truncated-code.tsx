import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Markdown } from '@/components/common/markdown'

/** Бюджет усечения тел (Q2/Q10 плана) — общий для тел инструментов и файлов беседы. */
export const TRUNCATE_BUDGET = 2000

export function TruncatedCode({ code, language }: { code: string; language?: string | null }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const isLong = code.length > TRUNCATE_BUDGET
  const shown = !isLong || expanded ? code : code.slice(0, TRUNCATE_BUDGET)
  const fence = '```' + (language ?? '')

  return (
    <div className="space-y-1">
      {/* Markdown задаёт prose-pre:bg-transparent для тел сообщений — здесь код должен читаться
          как терминальный вывод, поэтому фон и отступ возвращаем на обёртке. */}
      <div className="rounded bg-background p-2 [&_pre]:m-0 [&_pre]:p-0">
        <Markdown>{`${fence}\n${shown}\n\`\`\``}</Markdown>
      </div>
      {isLong && !expanded && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{t('common.truncatedChars', { shown: TRUNCATE_BUDGET, total: code.length })}</span>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="underline-offset-2 hover:text-foreground hover:underline"
          >
            {t('common.showFull')}
          </button>
        </div>
      )}
    </div>
  )
}
