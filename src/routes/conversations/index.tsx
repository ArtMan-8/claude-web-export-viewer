import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/conversations/')({
  component: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Выберите беседу слева
    </div>
  ),
})
