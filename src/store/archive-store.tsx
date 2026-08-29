import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { buildArchive } from '@/lib/archive/build-archive'
import type { RawFileInput } from '@/lib/archive/load'
import type { Archive } from '@/lib/archive/model'
import { buildSearchIndex, type SearchEntry } from '@/lib/search'

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

interface ArchiveContextValue {
  archive: Archive | null
  status: LoadStatus
  error: string | null
  searchIndex: SearchEntry[]
  loadFromFiles(files: FileList | File[]): Promise<void>
  /** Пробует подхватить claude-data/ через dev-эндпоинт. Возвращает true, если что-то нашлось и загрузилось. */
  tryLoadLocalArchive(): Promise<boolean>
  reset(): void
}

const ArchiveContext = createContext<ArchiveContextValue | null>(null)

export function useArchive(): ArchiveContextValue {
  const ctx = useContext(ArchiveContext)
  if (!ctx) throw new Error('useArchive должен использоваться внутри ArchiveProvider')
  return ctx
}

async function fileToRawInput(file: File): Promise<RawFileInput> {
  return { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }
}

export function ArchiveProvider({ children }: { children: ReactNode }) {
  const [archive, setArchive] = useState<Archive | null>(null)
  const [status, setStatus] = useState<LoadStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const applyFiles = useCallback(async (files: RawFileInput[]) => {
    setStatus('loading')
    setError(null)
    try {
      const result = buildArchive(files)
      setArchive(result)
      setStatus('ready')
    } catch (e) {
      setArchive(null)
      setError(e instanceof Error ? e.message : String(e))
      setStatus('error')
    }
  }, [])

  const loadFromFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList)
      const rawInputs = await Promise.all(files.map(fileToRawInput))
      await applyFiles(rawInputs)
    },
    [applyFiles],
  )

  const tryLoadLocalArchive = useCallback(async () => {
    try {
      const listResponse = await fetch('/__local-archive/list')
      if (!listResponse.ok) return false

      const payload = (await listResponse.json()) as { files: { name: string }[] }
      if (!payload.files || payload.files.length === 0) return false

      const rawInputs = await Promise.all(
        payload.files.map(async (f): Promise<RawFileInput> => {
          const res = await fetch(`/__local-archive/file/${encodeURIComponent(f.name)}`)
          const buffer = await res.arrayBuffer()
          return { name: f.name, bytes: new Uint8Array(buffer) }
        }),
      )
      await applyFiles(rawInputs)
      return true
    } catch {
      return false
    }
  }, [applyFiles])

  const reset = useCallback(() => {
    setArchive(null)
    setStatus('idle')
    setError(null)
  }, [])

  const searchIndex = useMemo(() => (archive ? buildSearchIndex(archive.conversations) : []), [archive])

  const value = useMemo<ArchiveContextValue>(
    () => ({ archive, status, error, searchIndex, loadFromFiles, tryLoadLocalArchive, reset }),
    [archive, status, error, searchIndex, loadFromFiles, tryLoadLocalArchive, reset],
  )

  return <ArchiveContext.Provider value={value}>{children}</ArchiveContext.Provider>
}
