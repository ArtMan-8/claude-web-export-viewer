/** Общая схема id для якорей карточек файлов беседы — используется рендером
 * блока present_files (FilesResult) и секцией «Файлы беседы» (§3.6 плана). */
export function conversationFileAnchorId(path: string): string {
  return `file-${encodeURIComponent(path)}`
}
