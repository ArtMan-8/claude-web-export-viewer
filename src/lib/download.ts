/** Скачивание файла на клиенте через Blob URL — без обращения к серверу. */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function downloadText(filename: string, text: string, mime = 'text/plain;charset=utf-8'): void {
  downloadBlob(filename, new Blob([text], { type: mime }))
}

export function downloadBytes(filename: string, bytes: Uint8Array, mime = 'application/zip'): void {
  // .slice() гарантирует обычный ArrayBuffer (а не ArrayBufferLike/SharedArrayBuffer), который требует тип BlobPart
  downloadBlob(filename, new Blob([bytes.slice()], { type: mime }))
}
