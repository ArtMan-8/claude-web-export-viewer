import { Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSettings } from '@/store/settings-store'
import type { Theme } from '@/store/settings-store'

const ORDER: Theme[] = ['system', 'light', 'dark']
const ICONS: Record<Theme, typeof Sun> = { system: Monitor, light: Sun, dark: Moon }
const LABELS: Record<Theme, string> = { system: 'Тема: системная', light: 'Тема: светлая', dark: 'Тема: тёмная' }

export function ThemeToggle() {
  const { theme, setTheme } = useSettings()
  const Icon = ICONS[theme]

  return (
    <Button
      variant="ghost"
      size="icon"
      title={LABELS[theme]}
      aria-label={LABELS[theme]}
      onClick={() => setTheme(ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length])}
    >
      <Icon className="size-4" />
    </Button>
  )
}
