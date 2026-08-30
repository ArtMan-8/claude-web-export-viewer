import { Outlet, createFileRoute } from '@tanstack/react-router'
import { ProjectListPanel } from '~/components/project/project-list-panel'

export const Route = createFileRoute('/projects')({
  component: ProjectsLayout,
})

function ProjectsLayout() {
  return (
    <div className="flex h-full">
      <ProjectListPanel />
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}
