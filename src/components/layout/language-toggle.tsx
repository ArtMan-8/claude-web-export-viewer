import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '~/components/ui/button'
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '~/i18n/config'

export function LanguageToggle() {
  const { t, i18n } = useTranslation()
  const base = i18n.language.split('-')[0]
  const current = (SUPPORTED_LANGUAGES as readonly string[]).includes(base) ? (base as SupportedLanguage) : 'en'
  const label = t('language.toggle', { language: t(`language.${current}`) })

  const handleClick = () => {
    const next = SUPPORTED_LANGUAGES[(SUPPORTED_LANGUAGES.indexOf(current) + 1) % SUPPORTED_LANGUAGES.length]
    void i18n.changeLanguage(next)
  }

  return (
    <Button variant="ghost" size="icon" title={label} aria-label={label} onClick={handleClick}>
      <Languages className="size-4" />
    </Button>
  )
}
