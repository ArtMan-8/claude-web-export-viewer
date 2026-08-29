import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Message } from '@/lib/archive/model'
import type { ThreadResult } from '@/lib/archive/thread'
import { ScrollToTopButton } from '@/components/common/scroll-to-top-button'
import { MessageItem } from './message-item'
import { BranchSwitcher } from './branch-switcher'

/** Выше этого порога переходим на виртуализацию — полный рендер держит нативный Ctrl+F */
const VIRTUALIZE_THRESHOLD = 500

interface MessageListProps {
  path: Message[]
  thread: ThreadResult
  showTools: boolean
  onSwitchBranch: (parentUuid: string, childUuid: string) => void
}

function renderItem(message: Message, index: number, path: Message[], thread: ThreadResult, showTools: boolean, onSwitchBranch: MessageListProps['onSwitchBranch']) {
  const siblings = thread.branches.get(message.uuid)
  const nextUuid = path[index + 1]?.uuid

  return (
    <div key={message.uuid} className="flex flex-col gap-1">
      <MessageItem message={message} showTools={showTools} />
      {siblings && siblings.length > 1 && nextUuid && (
        <BranchSwitcher
          index={siblings.findIndex((s) => s.uuid === nextUuid)}
          total={siblings.length}
          onSelect={(nextIndex) => onSwitchBranch(message.uuid, siblings[nextIndex].uuid)}
        />
      )}
    </div>
  )
}

function PlainMessageList({ path, thread, showTools, onSwitchBranch }: MessageListProps) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      {path.map((message, index) => renderItem(message, index, path, thread, showTools, onSwitchBranch))}
    </div>
  )
}

function VirtualizedMessageList({ path, thread, showTools, onSwitchBranch }: MessageListProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: path.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 160,
    overscan: 8,
  })

  return (
    <div className="relative h-full">
      <div ref={parentRef} className="h-full overflow-y-auto">
        <div className="mx-auto max-w-3xl p-4" style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const message = path[virtualRow.index]
            return (
              <div
                key={message.uuid}
                ref={virtualizer.measureElement}
                data-index={virtualRow.index}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${virtualRow.start}px)` }}
                className="pb-4"
              >
                {renderItem(message, virtualRow.index, path, thread, showTools, onSwitchBranch)}
              </div>
            )
          })}
        </div>
      </div>
      <ScrollToTopButton scrollRef={parentRef} />
    </div>
  )
}

export function MessageList(props: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  if (props.path.length > VIRTUALIZE_THRESHOLD) return <VirtualizedMessageList {...props} />

  return (
    <div className="relative h-full">
      <div ref={scrollRef} className="h-full overflow-y-auto">
        <PlainMessageList {...props} />
      </div>
      <ScrollToTopButton scrollRef={scrollRef} />
    </div>
  )
}
