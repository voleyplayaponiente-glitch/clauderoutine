/** Generador de identificadores con fallback si no hay crypto.randomUUID. */
export function nuevoId(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  } catch {
    /* sigue al fallback */
  }
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}
