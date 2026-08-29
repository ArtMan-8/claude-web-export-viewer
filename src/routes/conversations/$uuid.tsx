import { createFileRoute } from '@tanstack/react-router'
import { ConversationView } from '@/components/conversation/conversation-view'
import { useArchive } from '@/store/archive-store'

export const Route = createFileRoute('/conversations/$uuid')({
  component: ConversationRoute,
})

function ConversationRoute() {
  const { uuid } = Route.useParams()
  const { archive } = useArchive()
  const conversation = archive?.conversations.find((c) => c.uuid === uuid)

  if (!conversation) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Беседа не найдена</div>
  }

  return <ConversationView conversation={conversation} />
}
