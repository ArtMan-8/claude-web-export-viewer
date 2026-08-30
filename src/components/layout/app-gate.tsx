import { useEffect, useState } from 'react'
import { useArchive } from '~/store/archive-store'
import { ArchiveDropzone } from './archive-dropzone'
import { AppShell } from './app-shell'

/** Решает, показывать экран загрузки или основной интерфейс; один раз пробует подхватить claude-data/ в dev. */
export function AppGate() {
  const { status, tryLoadLocalArchive } = useArchive()
  const [triedLocal, setTriedLocal] = useState(false)

  useEffect(() => {
    if (status === 'idle' && !triedLocal) {
      setTriedLocal(true)
      void tryLoadLocalArchive()
    }
  }, [status, triedLocal, tryLoadLocalArchive])

  if (status !== 'ready') return <ArchiveDropzone />
  return <AppShell />
}
