import { Monitor, Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useSettings } from '@/store/settings-store'
import type { Theme } from '@/store/settings-store'

const ORDER: Theme[] = ['system', 'light', 'dark']
const ICONS: Record<Theme, typeof Sun> = { system: Monitor, light: Sun, dark: Moon }
const LABEL_KEYS: Record<Theme, string> = { system: 'theme.system', light: 'theme.light', dark: 'theme.dark' }

export function ThemeToggle() {
  const { t } = useTranslation()
  const { theme, setTheme } = useSettings()
  const Icon = ICONS[theme]
  const label = t(LABEL_KEYS[theme])

  return (
    <Button
      variant="ghost"
      size="icon"
      title={label}
      aria-label={label}
      onClick={() => setTheme(ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length])}
    >
      <Icon className="size-4" />
    </Button>
  )
}
