import { useCallback, useRef, useState, type DragEvent } from 'react'
import { Archive as ArchiveIcon, Loader2, UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useArchive } from '@/store/archive-store'

/** Полноэкранный экран загрузки: показывается, пока архив не открыт. */
export function ArchiveDropzone() {
  const { status, error, loadFromFiles } = useArchive()
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      setIsDragging(false)
      if (event.dataTransfer.files.length > 0) void loadFromFiles(event.dataTransfer.files)
    },
    [loadFromFiles],
  )

  const isLoading = status === 'loading'

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <ArchiveIcon className="size-10 text-muted-foreground" strokeWidth={1.5} />
        <h1 className="text-2xl font-semibold">Архив Claude</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Перетащите сюда файлы экспорта claude.ai — manifest-*.json и .zip-архивы (conversations, projects,
          light_metadata) — или выберите их вручную. Всё обрабатывается локально в браузере.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`flex w-full max-w-md flex-col items-center gap-4 rounded-lg border-2 border-dashed p-10 transition-colors ${
          isDragging ? 'border-primary bg-accent' : 'border-border'
        }`}
      >
        {isLoading ? (
          <>
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Разбираем архив…</p>
          </>
        ) : (
          <>
            <UploadCloud className="size-8 text-muted-foreground" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground">Перетащите файлы сюда</p>
            <Button variant="outline" onClick={() => inputRef.current?.click()}>
              Выбрать файлы
            </Button>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".zip,.json,application/zip,application/json"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) void loadFromFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </>
        )}
      </div>

      {status === 'error' && error && (
        <Alert variant="destructive" className="max-w-md">
          <AlertTitle>Не удалось загрузить архив</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
