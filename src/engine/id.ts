let counter = 0

/** Deterministic-ish unique id. Uses crypto.randomUUID when available. */
export function uid(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  counter += 1
  return `${prefix}_${counter}_${Math.floor(Math.random() * 1e9).toString(36)}`
}
