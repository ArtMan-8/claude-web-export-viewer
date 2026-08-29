import { Outlet, createFileRoute } from '@tanstack/react-router'
import { ConversationListPanel } from '@/components/conversation/conversation-list-panel'

export const Route = createFileRoute('/conversations')({
  component: ConversationsLayout,
})

function ConversationsLayout() {
  return (
    <div className="flex h-full">
      <ConversationListPanel />
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}
