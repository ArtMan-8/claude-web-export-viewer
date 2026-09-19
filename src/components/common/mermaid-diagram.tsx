import { useEffect, useState, type ReactNode } from 'react'
import { Maximize2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '~/components/ui/button'
import { useSettings } from '~/store/settings-store'
import { DiagramViewer } from './diagram-viewer'

type Mermaid = typeof import('mermaid').default

// mermaid тянет d3/cytoscape/elk — грузится отдельным чанком при первой диаграмме
let mermaidPromise: Promise<Mermaid> | null = null
function loadMermaid(): Promise<Mermaid> {
  mermaidPromise ??= import('mermaid').then((m) => m.default)
  return mermaidPromise
}

// render() требует уникальный DOM-id, пригодный для CSS-селекторов — useId даёт `:r1:`
let renderCounter = 0

interface Rendered {
  svg: string
  /** Натуральный размер из viewBox — для «вписать» и масштаба в просмотрщике */
  width: number
  height: number
}

/**
 * mermaid отдаёт `width="100%"` + `style="max-width: Npx"` — размер схемы решает
 * сама страница. Снимаем оба, чтобы контейнеры (превью и просмотрщик) задавали
 * размер через CSS, и забираем натуральный размер из viewBox.
 */
function prepareSvg(svg: string): Rendered {
  // Разбираем как HTML — тем же парсером, которым строка потом уйдёт в innerHTML
  const host = document.createElement('div')
  host.innerHTML = svg
  const root = host.querySelector('svg')
  if (!root) return { svg, width: 0, height: 0 }

  const viewBox = (root.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number)
  const [width, height] = viewBox.length === 4 ? [viewBox[2], viewBox[3]] : [0, 0]
  root.removeAttribute('width')
  root.removeAttribute('height')
  root.style.maxWidth = ''
  return { svg: host.innerHTML, width, height }
}

type RenderState = { status: 'pending' } | ({ status: 'ok' } & Rendered) | { status: 'error'; message: string }

async function renderDiagram(source: string, theme: 'light' | 'dark'): Promise<RenderState> {
  try {
    const mermaid = await loadMermaid()
    // strict — DOMPurify и никаких click/href в узлах: часть текстов в архиве пришла через web_fetch
    // с произвольных сайтов. Тема глобальная, поэтому initialize перед каждым рендером.
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      suppressErrorRendering: true,
      theme: theme === 'dark' ? 'dark' : 'default',
      fontFamily: 'inherit',
      look: 'classic',
      layout: 'dagre',
    })
    if (!(await mermaid.parse(source, { suppressErrors: true }))) {
      return { status: 'error', message: 'parse' }
    }
    renderCounter += 1
    const { svg } = await mermaid.render(`mermaid-${renderCounter}`, source)
    return { status: 'ok', ...prepareSvg(svg) }
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Рисует фенс ```mermaid как компактное превью (схема вписана целиком), по клику
 * открывает полноэкранный просмотрщик с масштабом и панорамированием. Пока чанк
 * грузится или если диаграмма не распарсилась, показывает `fallback` — обычный
 * блок кода.
 */
export function MermaidDiagram({ source, fallback }: { source: string; fallback: ReactNode }) {
  const { t } = useTranslation()
  const { resolvedTheme } = useSettings()
  const [state, setState] = useState<RenderState>({ status: 'pending' })
  const [viewerOpen, setViewerOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setState({ status: 'pending' })
    void renderDiagram(source, resolvedTheme).then((result) => {
      if (!cancelled) setState(result)
    })
    return () => {
      cancelled = true
    }
  }, [source, resolvedTheme])

  if (state.status !== 'ok') {
    return (
      <div className="my-4 space-y-1 [&_pre]:my-0">
        {fallback}
        {state.status === 'error' && (
          <p className="text-xs text-muted-foreground" title={state.message}>
            {t('diagram.failed')}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="group relative my-4 h-[500px] overflow-hidden rounded-md border border-border bg-background">
      {/* Схема вписана в превью целиком: у svg остался только viewBox, размер — от контейнера */}
      <div
        role="button"
        tabIndex={0}
        aria-label={t('diagram.expand')}
        className="h-full w-full cursor-zoom-in p-2 [&_svg]:h-full [&_svg]:w-full"
        onClick={() => setViewerOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setViewerOpen(true)
          }
        }}
        dangerouslySetInnerHTML={{ __html: state.svg }}
      />
      <Button
        variant="outline"
        size="icon-sm"
        className="absolute top-2 right-2 opacity-70 group-hover:opacity-100"
        title={t('diagram.expand')}
        onClick={() => setViewerOpen(true)}
      >
        <Maximize2 />
      </Button>
      <DiagramViewer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        svg={state.svg}
        width={state.width}
        height={state.height}
        source={fallback}
      />
    </div>
  )
}
