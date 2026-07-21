// Validaciones de formato para la interfaz (español).

const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE'

/** Valida DNI (8 dígitos + letra) o NIE (X/Y/Z + 7 dígitos + letra). */
export function dniNieValido(valor: string): boolean {
  const v = valor.trim().toUpperCase()
  if (/^\d{8}[A-Z]$/.test(v)) {
    const num = parseInt(v.slice(0, 8), 10)
    return LETRAS_DNI[num % 23] === v[8]
  }
  if (/^[XYZ]\d{7}[A-Z]$/.test(v)) {
    const pref = { X: '0', Y: '1', Z: '2' }[v[0] as 'X' | 'Y' | 'Z']
    const num = parseInt(pref + v.slice(1, 8), 10)
    return LETRAS_DNI[num % 23] === v[8]
  }
  return false
}

/** Validación de IBAN (longitud España 24 y dígito de control módulo 97). */
export function ibanValido(valor: string): boolean {
  const v = valor.replace(/\s+/g, '').toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(v)) return false
  if (v.startsWith('ES') && v.length !== 24) return false
  const reordenado = v.slice(4) + v.slice(0, 4)
  const numerico = reordenado.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55))
  let resto = 0
  for (const ch of numerico) resto = (resto * 10 + Number(ch)) % 97
  return resto === 1
}

/** Formatea un IBAN en grupos de 4 para mostrarlo. */
export function formateaIban(valor: string): string {
  return valor
    .replace(/\s+/g, '')
    .toUpperCase()
    .replace(/(.{4})/g, '$1 ')
    .trim()
}
