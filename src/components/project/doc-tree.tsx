import { ChevronRight, FileText, Folder, FolderOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible'
import type { DocTreeNode } from '~/lib/archive/doc-tree'
import { displayNameOf } from '~/lib/display-name'

interface DocTreeProps {
  nodes: DocTreeNode[]
  selectedDocUuid: string | null
  /** Пути свёрнутых папок; при непустом фильтре игнорируется — всё развёрнуто (3.3 плана) */
  collapsedPaths: Set<string>
  forceExpanded: boolean
  onSelectDoc(uuid: string): void
  onToggleDir(path: string): void
  depth?: number
}

/** Рекурсивный список: папки — Collapsible с отступом по глубине, файлы — кнопка выбора документа. */
export function DocTree({
  nodes,
  selectedDocUuid,
  collapsedPaths,
  forceExpanded,
  onSelectDoc,
  onToggleDir,
  depth = 0,
}: DocTreeProps) {
  const { t } = useTranslation()
  const indent = { paddingLeft: `${0.75 + depth * 0.875}rem` }

  return (
    <>
      {nodes.map((node) => {
        if (node.kind === 'dir') {
          const open = forceExpanded || !collapsedPaths.has(node.path)
          return (
            <Collapsible key={node.path} open={open} onOpenChange={() => onToggleDir(node.path)}>
              <CollapsibleTrigger
                title={node.path}
                className="flex w-full items-center gap-1.5 truncate border-b px-3 py-2 text-left text-sm hover:bg-accent"
                style={indent}
              >
                <ChevronRight className={`size-3 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} />
                {open ? (
                  <FolderOpen className="size-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <Folder className="size-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate">{node.name}</span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <DocTree
                  nodes={node.children}
                  selectedDocUuid={selectedDocUuid}
                  collapsedPaths={collapsedPaths}
                  forceExpanded={forceExpanded}
                  onSelectDoc={onSelectDoc}
                  onToggleDir={onToggleDir}
                  depth={depth + 1}
                />
              </CollapsibleContent>
            </Collapsible>
          )
        }

        const doc = node.doc!
        return (
          <button
            key={doc.uuid}
            onClick={() => onSelectDoc(doc.uuid)}
            title={doc.filename}
            className={`flex w-full items-center gap-1.5 truncate border-b px-3 py-2 text-left text-sm hover:bg-accent ${
              selectedDocUuid === doc.uuid ? 'bg-accent' : ''
            }`}
            style={indent}
          >
            <FileText className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{displayNameOf(node.name, t('common.noName'))}</span>
          </button>
        )
      })}
    </>
  )
}
