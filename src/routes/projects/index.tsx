import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/projects/')({
  component: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Выберите проект слева</div>
  ),
})
