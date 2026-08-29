/**
 * Общий стиль для ссылок-«таблеток» между беседой и проектом (в обе стороны).
 * Вынесено в константу, а не задублировано, чтобы hover не расходился между
 * местами использования, как уже случилось однажды между Badge и обычным Link.
 */
export const LINK_CHIP_CLASS =
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs hover:bg-accent'
