import { describe, expect, it } from 'vitest'
import { leerApunte } from './lenguaje-natural.js'

// Martes 18 de agosto de 2026. Todas las pruebas parten de aquí: el dominio no
// mira el reloj, se le dice qué día es.
const HOY = new Date(2026, 7, 18)

const leer = (texto: string) => leerApunte(texto, HOY)

describe('el ejemplo del encargo', () => {
  it('«café 3,40 ayer» sale entero', () => {
    expect(leer('café 3,40 ayer')).toMatchObject({
      concepto: 'Café',
      importe: -340,
      fecha: '2026-08-17',
      esIngreso: false,
    })
  })
})

describe('importe', () => {
  it('lo encuentra vaya donde vaya', () => {
    expect(leer('45 gasolina').importe).toBe(-4500)
    expect(leer('gasolina 45').importe).toBe(-4500)
    expect(leer('compra 12,90 mercadona').importe).toBe(-1290)
  })

  it('entiende el símbolo pegado y los miles', () => {
    expect(leer('alquiler 1.200€').importe).toBe(-120000)
    expect(leer('tv 899,99').importe).toBe(-89999)
  })

  it('con varios números elige el que parece dinero', () => {
    // «5 cañas 12,50»: lo gastado son 12,50; las 5 son cañas.
    expect(leer('5 cañas 12,50').importe).toBe(-1250)
    expect(leer('5 cañas 12,50').concepto).toBe('5 cañas')
    // Y si ninguno lleva decimales ni símbolo, manda el primero.
    expect(leer('45 gasolina').importe).toBe(-4500)
    expect(leer('2 entradas 30€').importe).toBe(-3000)
  })

  it('sin importe no se lo inventa', () => {
    const apunte = leer('cena con Marta')
    expect(apunte.importe).toBeNull()
    expect(apunte.entendido.importe).toBe(false)
    expect(apunte.concepto).toBe('Cena con Marta')
  })
})

describe('signo', () => {
  it('por defecto es gasto', () => {
    expect(leer('cena 32,50').importe).toBeLessThan(0)
    expect(leer('cena 32,50').esIngreso).toBe(false)
  })

  it('el «+» lo convierte en ingreso', () => {
    expect(leer('+2400 nomina').importe).toBe(240000)
    expect(leer('+2400 nomina').esIngreso).toBe(true)
  })

  it('algunas palabras ya dicen que es un ingreso', () => {
    expect(leer('nómina 2400').importe).toBe(240000)
    expect(leer('devolución hacienda 320').esIngreso).toBe(true)
    expect(leer('sueldo 1850').esIngreso).toBe(true)
  })

  it('un menos explícito manda sobre la palabra', () => {
    // «devolución -50» es una devolución que hago yo, no que me hacen.
    expect(leer('devolución -50').esIngreso).toBe(false)
    expect(leer('devolución -50').importe).toBe(-5000)
  })
})

describe('fecha', () => {
  it('sin decir nada, hoy', () => {
    expect(leer('café 1,20')).toMatchObject({ fecha: '2026-08-18' })
    expect(leer('café 1,20').entendido.fecha).toBe(false)
  })

  it('ayer, hoy, anteayer y mañana', () => {
    expect(leer('café 1,20 ayer').fecha).toBe('2026-08-17')
    expect(leer('café 1,20 hoy').fecha).toBe('2026-08-18')
    expect(leer('café 1,20 anteayer').fecha).toBe('2026-08-16')
    expect(leer('recibo 60 mañana').fecha).toBe('2026-08-19')
  })

  it('«el viernes» es el viernes que ya pasó', () => {
    // Se apunta lo que ya se ha gastado, no lo que se gastará.
    expect(leer('cena 40 el viernes').fecha).toBe('2026-08-14')
  })

  it('el mismo día de la semana que hoy es el de la semana pasada', () => {
    expect(leer('gasolina 50 el martes').fecha).toBe('2026-08-11')
  })

  it('fechas escritas', () => {
    expect(leer('seguro 120 el 5/8').fecha).toBe('2026-08-05')
    expect(leer('itv 45 el 30/07/2026').fecha).toBe('2026-07-30')
  })

  it('«el 5» es de este mes, y del anterior si aún no ha llegado', () => {
    expect(leer('luz 78 el 5').fecha).toBe('2026-08-05')
    // El 25 todavía no ha llegado en agosto, así que fue el de julio.
    expect(leer('luz 78 el 25').fecha).toBe('2026-07-25')
  })

  it('la palabra de la fecha no se queda en el concepto', () => {
    expect(leer('café 3,40 ayer').concepto).toBe('Café')
    expect(leer('cena 40 el viernes').concepto).toBe('Cena')
  })
})

describe('concepto', () => {
  it('quita el relleno y deja algo presentable', () => {
    expect(leer('20 en el mercadona').concepto).toBe('Mercadona')
    expect(leer('cena con la familia 60').concepto).toBe('Cena con familia')
  })

  it('aguanta la entrada vacía sin romperse', () => {
    expect(leer('')).toMatchObject({ concepto: '', importe: null })
    expect(leer(undefined as unknown as string).importe).toBeNull()
  })
})
