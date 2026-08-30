import type { Message } from '~/lib/archive/model'
import { TextBlock } from './blocks/text-block'
import { ThinkingBlock } from './blocks/thinking-block'
import { ToolBlock } from './blocks/tool-block'
import { UnknownBlock } from './blocks/unknown-block'

function MessageBlocks({ message, showTools }: { message: Message; showTools: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {message.blocks.map((block, i) => {
        switch (block.kind) {
          case 'text':
            return <TextBlock key={i} text={block.text} citations={block.citations} />
          case 'thinking':
            return <ThinkingBlock key={i} summaries={block.summaries} text={block.text} isTruncated={block.isTruncated} />
          case 'tool':
            return showTools ? <ToolBlock key={i} block={block} /> : null
          case 'unknown':
            return showTools ? <UnknownBlock key={i} blockType={block.blockType} raw={block.raw} /> : null
          default:
            return null
        }
      })}
    </div>
  )
}

export function MessageItem({ message, showTools }: { message: Message; showTools: boolean }) {
  const body = <MessageBlocks message={message} showTools={showTools} />

  if (message.sender === 'human') {
    return (
      <div className="flex justify-end" title={message.createdAt}>
        <div className="max-w-[80%] rounded-2xl bg-muted px-4 py-2.5 text-sm">{body}</div>
      </div>
    )
  }

  return (
    <div className="max-w-none text-sm leading-relaxed" title={message.createdAt}>
      {body}
    </div>
  )
}
