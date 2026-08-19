import { describe, expect, it } from 'vitest'
import { agruparCopias, juzgarCopias, juzgarExterno, type EstadoCopias } from './copias.js'

const AHORA = new Date('2026-08-19T10:00:00Z')

const BUENO: EstadoCopias = {
  ultima: '2026-08-19T04:30:00Z',
  fichero: 'norte-2026-08-19-0430.dump',
  bytes: 1_200_000,
  copias: 8,
  ok: true,
  mensaje: null,
  externo: null,
}

describe('juzgar el estado de las copias', () => {
  it('con una copia de esta madrugada, todo en orden', () => {
    const juicio = juzgarCopias({ estado: BUENO, servicioVivo: true }, AHORA)
    expect(juicio.salud).toBe('al_dia')
    expect(juicio.detalle).toContain('8 copias')
  })

  it('si el servicio no da señales, eso manda sobre cualquier estado guardado', () => {
    // Es el caso peligroso: el fichero de estado dice «todo bien» porque lo
    // escribió ayer, y el contenedor lleva parado desde entonces.
    const juicio = juzgarCopias({ estado: BUENO, servicioVivo: false }, AHORA)
    expect(juicio.salud).toBe('sin_servicio')
    expect(juicio.titulo).toMatch(/no se están haciendo/i)
  })

  it('una copia de hace tres días está atrasada y lo dice con números', () => {
    const juicio = juzgarCopias(
      { estado: { ...BUENO, ultima: '2026-08-16T04:30:00Z' }, servicioVivo: true },
      AHORA,
    )
    expect(juicio.salud).toBe('atrasada')
    expect(juicio.titulo).toContain('3 días')
  })

  it('tolera una noche con el servidor apagado sin dar un susto', () => {
    const juicio = juzgarCopias(
      { estado: { ...BUENO, ultima: '2026-08-18T04:30:00Z' }, servicioVivo: true },
      AHORA,
    )
    expect(juicio.salud).toBe('al_dia')
  })

  it('un fallo se cuenta con el motivo que dio el servicio', () => {
    const juicio = juzgarCopias(
      { estado: { ...BUENO, ok: false, mensaje: 'No queda espacio en el disco.' }, servicioVivo: true },
      AHORA,
    )
    expect(juicio.salud).toBe('fallida')
    expect(juicio.detalle).toBe('No queda espacio en el disco.')
  })

  it('recién instalado, dice que espere en vez de dar una alarma', () => {
    const juicio = juzgarCopias(
      { estado: { ...BUENO, ultima: null, copias: 0 }, servicioVivo: true },
      AHORA,
    )
    expect(juicio.salud).toBe('atrasada')
    expect(juicio.detalle).toMatch(/unos minutos/)
  })
})

describe('agrupar los ficheros de cada copia', () => {
  it('junta el volcado y los documentos del mismo momento', () => {
    const copias = agruparCopias([
      { fichero: 'norte-2026-08-19-0430.dump', bytes: 1000 },
      { fichero: 'norte-2026-08-19-0430-documentos.tar.gz', bytes: 500 },
      { fichero: 'norte-2026-08-18-0430.dump', bytes: 900 },
    ])
    expect(copias).toHaveLength(2)
    expect(copias[0]).toEqual({
      sello: '2026-08-19-0430',
      fecha: '2026-08-19',
      bytes: 1500,
      conDocumentos: true,
    })
    expect(copias[1]!.conDocumentos).toBe(false)
  })

  it('las ordena de la más nueva a la más vieja', () => {
    const copias = agruparCopias([
      { fichero: 'norte-2026-07-01-0430.dump', bytes: 1 },
      { fichero: 'norte-2026-08-19-0430.dump', bytes: 1 },
      { fichero: 'norte-2026-08-19-1200.dump', bytes: 1 },
    ])
    expect(copias.map((c) => c.sello)).toEqual([
      '2026-08-19-1200',
      '2026-08-19-0430',
      '2026-07-01-0430',
    ])
  })

  it('ignora lo que haya en la carpeta y no sea una copia', () => {
    expect(agruparCopias([{ fichero: 'estado.json', bytes: 100 }])).toEqual([])
  })
})

describe('juzgar el disco externo', () => {
  const CONECTADO = {
    conectado: true,
    ruta: '/externo/midisco/norte-copias',
    copias: 42,
    ultima: '2026-08-19T04:31:00Z',
    libresMb: 51_200,
    mensaje: null,
    vistoAlgunaVez: true,
  }

  it('conectado, cuenta lo que hay y cuánto sitio queda', () => {
    const juicio = juzgarExterno(CONECTADO, AHORA)
    expect(juicio.salud).toBe('al_dia')
    expect(juicio.detalle).toBe('42 copias en el disco. Quedan 50 GB libres.')
  })

  it('sin disco y sin haberlo tenido nunca, explica cómo se pone', () => {
    const juicio = juzgarExterno(null, AHORA)
    expect(juicio.salud).toBe('sin_configurar')
    expect(juicio.detalle).toMatch(/norte-copias/)
  })

  it('desconectado hace poco no es una alarma', () => {
    const juicio = juzgarExterno({ ...CONECTADO, conectado: false }, AHORA)
    expect(juicio.salud).toBe('desconectado')
    expect(juicio.titulo).toMatch(/no está conectado/)
    expect(juicio.detalle).toMatch(/Nada grave/)
  })

  it('desconectado desde hace semanas sí lo es, y dice cuánto', () => {
    // El caso que motiva guardar «vistoAlgunaVez»: el disco estaba, alguien lo
    // desenchufó y nadie se ha enterado.
    const juicio = juzgarExterno(
      { ...CONECTADO, conectado: false, ultima: '2026-07-19T04:31:00Z' },
      AHORA,
    )
    expect(juicio.titulo).toMatch(/lleva días sin aparecer/)
    expect(juicio.detalle).toContain('31 días')
  })

  it('un problema del disco se cuenta tal cual lo dijo el servicio', () => {
    const juicio = juzgarExterno({ ...CONECTADO, mensaje: 'Quedan 12 MB libres.' }, AHORA)
    expect(juicio.salud).toBe('con_problema')
    expect(juicio.detalle).toBe('Quedan 12 MB libres.')
  })
})

describe('la carpeta marcada está en el mismo disco', () => {
  it('lo canta en vez de dar por buena una copia que no protege de nada', () => {
    // Pasa al crear «norte-copias» en un punto de montaje que no llegó a
    // montarse: la marca está, pero es el disco del propio Umbrel.
    const juicio = juzgarExterno(
      {
        conectado: false,
        ruta: null,
        copias: 0,
        ultima: null,
        libresMb: null,
        mensaje: 'La carpeta norte-copias esta en el mismo disco que el Umbrel, no en uno aparte.',
        vistoAlgunaVez: false,
      },
      AHORA,
    )
    expect(juicio.salud).toBe('con_problema')
    expect(juicio.detalle).toMatch(/mismo disco/)
  })
})
