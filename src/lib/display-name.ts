/** Название для отображения: пустое сырое имя архива заменяется на переведённый фолбэк. */
export function displayNameOf(name: string, fallback: string): string {
  return name.trim() ? name : fallback
}
