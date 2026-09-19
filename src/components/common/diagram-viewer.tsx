import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Code, Maximize, Minus, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '~/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '~/components/ui/dialog'

const MIN_SCALE = 0.05
const MAX_SCALE = 8
const ZOOM_STEP = 1.25
const FIT_PADDING = 24

interface Transform {
  x: number
  y: number
  scale: number
}

interface DiagramViewerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  svg: string
  /** Натуральный размер схемы (из viewBox) — от него считается «вписать» и масштаб */
  width: number
  height: number
  /** Исходник для режима «код» */
  source: ReactNode
}

/**
 * Полноэкранный просмотр схемы: колесо — масштаб вокруг курсора, перетаскивание —
 * панорамирование, кнопки — шаг масштаба вокруг центра и «вписать». Трансформация
 * держится в CSS transform, DOM схемы при этом не перерисовывается.
 */
export function DiagramViewer({ open, onOpenChange, svg, width, height, source }: DiagramViewerProps) {
  const { t } = useTranslation()
  // Узел viewport — в состоянии, а не в ref: DialogContent монтируется через портал на тик
  // позже, и эффекты с ref.current успели бы отработать по null и не перезапуститься
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null)
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 })
  const [showSource, setShowSource] = useState(false)
  const drag = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null)

  const fit = useCallback(() => {
    if (!viewport || width <= 0 || height <= 0) return
    const cw = viewport.clientWidth - FIT_PADDING * 2
    const ch = viewport.clientHeight - FIT_PADDING * 2
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(cw / width, ch / height)))
    setTransform({
      x: (viewport.clientWidth - width * scale) / 2,
      y: (viewport.clientHeight - height * scale) / 2,
      scale,
    })
  }, [viewport, width, height])

  /** Масштаб вокруг точки (px, py) в координатах viewport — точка под ней остаётся на месте */
  const zoomAt = useCallback((factor: number, px: number, py: number) => {
    setTransform((prev) => {
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale * factor))
      const ratio = scale / prev.scale
      return { scale, x: px - (px - prev.x) * ratio, y: py - (py - prev.y) * ratio }
    })
  }, [])

  const zoomAtCenter = (factor: number) => {
    if (!viewport) return
    zoomAt(factor, viewport.clientWidth / 2, viewport.clientHeight / 2)
  }

  // Вписать при открытии и при смене режима — размеры viewport известны только после монтирования
  useEffect(() => {
    if (!open || showSource) return
    const frame = requestAnimationFrame(fit)
    return () => cancelAnimationFrame(frame)
  }, [open, showSource, fit])

  useEffect(() => {
    if (!open) setShowSource(false)
  }, [open])

  // wheel — через addEventListener: React вешает его passive, а нам нужен preventDefault
  useEffect(() => {
    if (!viewport || !open || showSource) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = viewport.getBoundingClientRect()
      const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
      zoomAt(factor, event.clientX - rect.left, event.clientY - rect.top)
    }
    viewport.addEventListener('wheel', onWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', onWheel)
  }, [viewport, open, showSource, zoomAt])

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: transform.x,
      originY: transform.y,
    }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.pointerId !== event.pointerId) return
    setTransform((prev) => ({ ...prev, x: d.originX + event.clientX - d.startX, y: d.originY + event.clientY - d.startY }))
  }

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return
    drag.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (showSource) return
    if (event.key === '+' || event.key === '=') zoomAtCenter(ZOOM_STEP)
    else if (event.key === '-') zoomAtCenter(1 / ZOOM_STEP)
    else if (event.key === '0') fit()
    else return
    event.preventDefault()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        onKeyDown={onKeyDown}
        className="inset-2 flex h-auto w-auto max-w-none translate-x-0 translate-y-0 flex-col gap-0 p-0 sm:max-w-none"
      >
        <DialogTitle className="sr-only">{t('diagram.title')}</DialogTitle>

        <div className="flex shrink-0 items-center gap-1 border-b px-3 py-2 pr-12">
          <Button variant="ghost" size="icon-sm" onClick={() => zoomAtCenter(1 / ZOOM_STEP)} title={t('diagram.zoomOut')} disabled={showSource}>
            <Minus />
          </Button>
          <span className="w-12 text-center font-mono text-xs tabular-nums text-muted-foreground">
            {Math.round(transform.scale * 100)}%
          </span>
          <Button variant="ghost" size="icon-sm" onClick={() => zoomAtCenter(ZOOM_STEP)} title={t('diagram.zoomIn')} disabled={showSource}>
            <Plus />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={fit} title={t('diagram.fit')} disabled={showSource}>
            <Maximize />
          </Button>
          <div className="flex-1" />
          <Button
            variant={showSource ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setShowSource((value) => !value)}
            title={showSource ? t('diagram.showDiagram') : t('diagram.showSource')}
          >
            <Code />
            {t('diagram.source')}
          </Button>
        </div>

        {showSource ? (
          <div className="prose prose-sm dark:prose-invert min-h-0 max-w-none flex-1 overflow-auto p-4 [&_pre]:my-0">{source}</div>
        ) : (
          <div
            ref={setViewport}
            className="relative min-h-0 flex-1 touch-none overflow-hidden bg-background select-none"
            style={{ cursor: drag.current ? 'grabbing' : 'grab' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div
              className="absolute top-0 left-0 origin-top-left [&_svg]:block [&_svg]:h-full [&_svg]:w-full"
              style={{ width, height, transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
