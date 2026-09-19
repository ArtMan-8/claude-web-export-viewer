import { Outlet, createFileRoute } from '@tanstack/react-router'
import { ArtifactListPanel } from '~/components/artifact/artifact-list-panel'

export const Route = createFileRoute('/artifacts')({
  component: ArtifactsLayout,
})

function ArtifactsLayout() {
  return (
    <div className="flex h-full">
      <ArtifactListPanel />
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}
