/**
 * Validación de identificadores fiscales españoles (NIF/DNI, NIE, CIF).
 * Se usa como AVISO suave en la UI, nunca para bloquear el guardado: preferimos
 * advertir a impedir registrar un dato que el usuario sabe correcto.
 */
const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE'
const LETRAS_CIF = 'JABCDEFGHI'

export type TipoIdFiscal = 'DNI' | 'NIE' | 'CIF' | 'DESCONOCIDO'

export interface ResultadoValidacion {
  valido: boolean
  tipo: TipoIdFiscal
}

function validarDni(v: string): boolean {
  const m = /^(\d{8})([A-Z])$/.exec(v)
  if (!m) return false
  return LETRAS_DNI[Number(m[1]) % 23] === m[2]
}

function validarNie(v: string): boolean {
  const m = /^([XYZ])(\d{7})([A-Z])$/.exec(v)
  if (!m) return false
  const prefijo = { X: '0', Y: '1', Z: '2' }[m[1]]!
  return LETRAS_DNI[Number(prefijo + m[2]) % 23] === m[3]
}

function digitoControlCif(digitos: string): number {
  let suma = 0
  for (let i = 0; i < digitos.length; i++) {
    let n = Number(digitos[i])
    // Posiciones impares (1ª, 3ª…, índice par) se multiplican por 2.
    if (i % 2 === 0) {
      n *= 2
      if (n > 9) n -= 9
    }
    suma += n
  }
  return (10 - (suma % 10)) % 10
}

function validarCif(v: string): boolean {
  const m = /^([A-HJ-NP-SUVW])(\d{7})([0-9A-J])$/.exec(v)
  if (!m) return false
  const control = digitoControlCif(m[2])
  const control2 = LETRAS_CIF[control]
  // Según el tipo de organización el control es dígito, letra, o cualquiera de los dos.
  return m[3] === String(control) || m[3] === control2
}

/** Valida un NIF/NIE/CIF. Devuelve validez y tipo detectado. */
export function validarNifCif(entrada: string): ResultadoValidacion {
  const v = (entrada || '').toUpperCase().replace(/[\s-]/g, '')
  if (v === '') return { valido: false, tipo: 'DESCONOCIDO' }
  if (/^[XYZ]/.test(v)) return { valido: validarNie(v), tipo: 'NIE' }
  if (/^\d/.test(v)) return { valido: validarDni(v), tipo: 'DNI' }
  if (/^[A-Z]/.test(v)) return { valido: validarCif(v), tipo: 'CIF' }
  return { valido: false, tipo: 'DESCONOCIDO' }
}
