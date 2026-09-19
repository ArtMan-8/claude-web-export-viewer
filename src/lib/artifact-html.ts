/**
 * Готовит HTML артефакта к показу через `<iframe srcdoc>` в песочнице.
 *
 * У srcdoc-документа URL `about:srcdoc`, а базовый URL наследуется от
 * родителя — поэтому якорь `href="#id"` резолвится в адрес самой читалки и
 * превращается в переход на другой документ, который песочница молча
 * блокирует. `<base href="about:srcdoc">` заставляет `#id` резолвиться в
 * `about:srcdoc#id` — тот же документ, обычная прокрутка к якорю. Работает и
 * без `allow-same-origin`; blob:-URL этого не даёт (Chrome блокирует переход по
 * blob из непрозрачного origin).
 *
 * Тег вставляется первым в `<head>`: `<base>` действует на всё, что после него,
 * а если у документа уже есть свой `<base href>`, первый побеждает. Абсолютные
 * ссылки (шрифты с fonts.googleapis.com и т. п.) не затрагиваются.
 */
const SRCDOC_BASE = '<base href="about:srcdoc">'

export function prepareArtifactSrcdoc(html: string): string {
  const head = /<head(\s[^>]*)?>/i.exec(html)
  if (head) return html.slice(0, head.index + head[0].length) + SRCDOC_BASE + html.slice(head.index + head[0].length)

  const htmlTag = /<html(\s[^>]*)?>/i.exec(html)
  if (htmlTag) {
    const at = htmlTag.index + htmlTag[0].length
    return html.slice(0, at) + `<head>${SRCDOC_BASE}</head>` + html.slice(at)
  }

  // Ни <head>, ни <html> — фрагмент; doctype, если есть, должен остаться первым
  const doctype = /^\s*<!doctype[^>]*>/i.exec(html)
  const at = doctype ? doctype[0].length : 0
  return html.slice(0, at) + SRCDOC_BASE + html.slice(at)
}
