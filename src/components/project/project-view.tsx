import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronDown, Download, FileText, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Markdown } from '@/components/common/markdown'
import { LINK_CHIP_CLASS } from '@/components/common/link-chip'
import { ScrollToTopButton } from '@/components/common/scroll-to-top-button'
import type { Project } from '@/lib/archive/model'
import { projectToJson } from '@/lib/export/json'
import { buildProjectDocsZip } from '@/lib/export/zip-all'
import { downloadBytes, downloadText } from '@/lib/download'
import { useArchive } from '@/store/archive-store'

export function ProjectView({ project }: { project: Project }) {
  const { archive } = useArchive()
  const [filter, setFilter] = useState('')
  const [selectedDocUuid, setSelectedDocUuid] = useState(project.docs[0]?.uuid ?? null)
  const [promptOpen, setPromptOpen] = useState(false)
  const docScrollRef = useRef<HTMLDivElement>(null)

  // Компонент маршрута переиспользуется между проектами — без сброса состояние
  // (раскрытые инструкции, поиск, выбранный документ) утекало бы из одного проекта в другой
  useEffect(() => {
    setFilter('')
    setSelectedDocUuid(project.docs[0]?.uuid ?? null)
    setPromptOpen(false)
  }, [project.uuid])

  const filteredDocs = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    if (!needle) return project.docs
    return project.docs.filter(
      (doc) => doc.displayName.toLowerCase().includes(needle) || doc.content.toLowerCase().includes(needle),
    )
  }, [project.docs, filter])

  const selectedDoc = project.docs.find((d) => d.uuid === selectedDocUuid) ?? filteredDocs[0] ?? null

  const linkedConversations = useMemo(() => {
    if (!archive) return []
    const uuids = archive.projectLinks.filter((l) => l.projectUuid === project.uuid).map((l) => l.conversationUuid)
    return archive.conversations.filter((c) => uuids.includes(c.uuid))
  }, [archive, project.uuid])

  const handleExport = () => {
    downloadText(`${project.displayName}.json`, projectToJson(project), 'application/json;charset=utf-8')
  }

  const handleExportDocsZip = () => {
    downloadBytes(`${project.displayName}-docs.zip`, buildProjectDocsZip(project))
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-start gap-3 border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">{project.displayName}</h2>
          {project.description && <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Download className="size-4" />
              Экспорт
              <ChevronDown className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExport}>JSON</DropdownMenuItem>
            {project.docs.length > 0 && (
              <DropdownMenuItem onClick={handleExportDocsZip}>Документы (.zip)</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {project.promptTemplate && (
        <Collapsible open={promptOpen} onOpenChange={setPromptOpen} className="border-b px-4 py-2">
          <CollapsibleTrigger className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
            <ChevronDown className={`size-3.5 transition-transform ${promptOpen ? '' : '-rotate-90'}`} />
            Пользовательские инструкции проекта
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <Markdown>{project.promptTemplate}</Markdown>
          </CollapsibleContent>
        </Collapsible>
      )}

      {linkedConversations.length > 0 && (
        <div className="border-b px-4 py-2">
          <p className="mb-1 text-sm font-medium text-muted-foreground">Беседы этого проекта (определено по документам)</p>
          <div className="flex flex-wrap gap-2">
            {linkedConversations.map((c) => (
              <Link key={c.uuid} to="/conversations/$uuid" params={{ uuid: c.uuid }} className={LINK_CHIP_CLASS}>
                <MessageSquare className="size-3 shrink-0" /> {c.displayName}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="flex w-72 shrink-0 flex-col border-r">
          <div className="border-b p-2">
            <Input placeholder="Поиск по документам" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredDocs.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">Документы не найдены</p>
            ) : (
              filteredDocs.map((doc) => (
                <button
                  key={doc.uuid}
                  onClick={() => setSelectedDocUuid(doc.uuid)}
                  title={doc.filename}
                  className={`flex w-full items-center gap-1.5 truncate border-b px-3 py-2 text-left text-sm hover:bg-accent ${
                    selectedDoc?.uuid === doc.uuid ? 'bg-accent' : ''
                  }`}
                >
                  <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{doc.displayName}</span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="relative min-w-0 flex-1">
          <div ref={docScrollRef} className="h-full overflow-y-auto p-4">
            {selectedDoc ? (
              <Markdown>{selectedDoc.content}</Markdown>
            ) : (
              <p className="text-sm text-muted-foreground">В этом проекте нет документов</p>
            )}
          </div>
          <ScrollToTopButton scrollRef={docScrollRef} />
        </div>
      </div>
    </div>
  )
}
