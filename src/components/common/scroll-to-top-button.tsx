import { useEffect, useState, type RefObject } from 'react'
import { ArrowUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

const SHOW_AFTER_PX = 400

/**
 * Плавающая кнопка «наверх» в углу своего скролл-контейнера. Родитель должен
 * быть position:relative — кнопка позиционируется абсолютно внутри него, а не
 * относительно всего окна, чтобы оставаться в углу именно этой панели.
 */
export function ScrollToTopButton({ scrollRef }: { scrollRef: RefObject<HTMLElement | null> }) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const handleScroll = () => setVisible(el.scrollTop > SHOW_AFTER_PX)
    handleScroll()
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [scrollRef])

  if (!visible) return null

  return (
    <Button
      type="button"
      size="icon"
      variant="secondary"
      className="absolute right-4 bottom-4 z-10 rounded-full shadow-md"
      onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label={t('common.scrollTop')}
      title={t('common.scrollTop')}
    >
      <ArrowUp className="size-4" />
    </Button>
  )
}
