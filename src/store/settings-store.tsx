import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Theme = 'light' | 'dark' | 'system'

interface Settings {
  theme: Theme
  /** Показывать блоки инструментов (web_search, bash_tool и т.д.) в чтении и экспорте по умолчанию */
  showTools: boolean
  /** Показывать email/IP на странице «Аккаунт» без маскировки */
  showPII: boolean
}

const DEFAULT_SETTINGS: Settings = { theme: 'system', showTools: true, showPII: false }
const STORAGE_KEY = 'claude-archive-viewer:settings'

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

interface SettingsContextValue extends Settings {
  resolvedTheme: 'light' | 'dark'
  setTheme(theme: Theme): void
  setShowTools(value: boolean): void
  setShowPII(value: boolean): void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings должен использоваться внутри SettingsProvider')
  return ctx
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches,
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches)
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // приватный режим браузера и т.п. — настройки просто не переживут перезагрузку
    }
  }, [settings])

  const resolvedTheme: 'light' | 'dark' = settings.theme === 'system' ? (systemPrefersDark ? 'dark' : 'light') : settings.theme

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
  }, [resolvedTheme])

  const value = useMemo<SettingsContextValue>(
    () => ({
      ...settings,
      resolvedTheme,
      setTheme: (theme) => setSettings((s) => ({ ...s, theme })),
      setShowTools: (showTools) => setSettings((s) => ({ ...s, showTools })),
      setShowPII: (showPII) => setSettings((s) => ({ ...s, showPII })),
    }),
    [settings, resolvedTheme],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}
