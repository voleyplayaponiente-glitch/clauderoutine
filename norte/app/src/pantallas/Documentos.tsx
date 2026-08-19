import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import { Aviso, Boton, Cifra, Esqueleto, EstadoVacio, Etiqueta, Tarjeta } from '../componentes/ui.js'
import {
  api,
  ErrorDeApi,
  type ApunteLeido,
  type DocumentoResumen,
  type EspacioResumen,
  type LecturaDocumento,
} from '../lib/api.js'

/**
 * La bandeja de entrada.
 *
 * Un solo sitio donde soltar extractos y nóminas, y **una revisión antes de que
 * nada entre en las cuentas**. Esa segunda parte no es una cortesía: un lector
 * automático se equivoca de vez en cuando, y la diferencia entre una app en la
 * que se confía y una en la que no es si te enseña lo que ha entendido antes de
 * darlo por bueno.
 */

const FORMATOS = '.pdf,.xlsx,.xls,.xlsm,.ods,.csv,.tsv,.txt,.q43,.n43,.c43,.aeb43'

export function Documentos({ espacio }: { espacio: EspacioResumen }) {
  const [abierto, setAbierto] = useState<string | null>(null)
  const puedeEditar = espacio.rol !== 'lector'

  const documentos = useQuery({
    queryKey: ['documentos', espacio.id],
    queryFn: () => api.documentos(espacio.id),
  })

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 px-5 py-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-[-0.02em]">Documentos</h1>
        <p className="text-texto-2">
          Suelta aquí el extracto del banco o la nómina y Norte los lee. Nada entra en tus cuentas
          hasta que lo revises.
        </p>
      </header>

      {puedeEditar && <Buzon espacio={espacio} alSubir={setAbierto} />}

      {documentos.isLoading ? (
        <Esqueleto className="h-24 w-full" />
      ) : documentos.data && documentos.data.documentos.length === 0 ? (
        <EstadoVacio
          titulo="Todavía no has subido nada"
          texto="Si tu banco te deja elegir, baja el fichero en formato Norma 43 (.q43): es el que viene con los importes exactos y sin adivinar nada. Un Excel o un PDF también valen."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {documentos.data?.documentos.map((documento) => (
            <FilaDocumento
              key={documento.id}
              espacio={espacio}
              documento={documento}
              abierto={abierto === documento.id}
              alAbrir={() => setAbierto(abierto === documento.id ? null : documento.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────── Buzón

function Buzon({
  espacio,
  alSubir,
}: {
  espacio: EspacioResumen
  alSubir: (documentoId: string) => void
}) {
  const clientes = useQueryClient()
  const entrada = useRef<HTMLInputElement>(null)
  const [encima, setEncima] = useState(false)

  const subir = useMutation({
    mutationFn: (fichero: File) => api.subirDocumento(espacio.id, fichero),
    onSuccess: ({ documento }) => {
      clientes.invalidateQueries({ queryKey: ['documentos', espacio.id] })
      // Se abre solo el que se acaba de subir: el paso siguiente es revisarlo,
      // y obligar a buscarlo en la lista sería un clic de más en el único sitio
      // donde el usuario ya sabe qué quiere hacer.
      alSubir(documento.id)
    },
  })

  function elegir(ficheros: FileList | null) {
    const fichero = ficheros?.[0]
    if (fichero) subir.mutate(fichero)
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setEncima(true)
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => {
          e.preventDefault()
          setEncima(false)
          elegir(e.dataTransfer.files)
        }}
        className={`flex flex-col items-center gap-3 rounded-tarjeta border-2 border-dashed px-6 py-9 text-center transition-colors ${
          encima ? 'border-marca bg-marca-tenue' : 'border-linea bg-sup-2'
        }`}
      >
        <p className="text-sm text-texto-2">
          Arrastra aquí un fichero, o
        </p>
        <Boton
          variante="secundario"
          cargando={subir.isPending}
          onClick={() => entrada.current?.click()}
        >
          Elegir del ordenador
        </Boton>
        <input
          ref={entrada}
          type="file"
          accept={FORMATOS}
          className="hidden"
          onChange={(e) => {
            elegir(e.target.files)
            // Sin esto, volver a elegir el mismo fichero no dispara `change` y
            // parece que la app se ha quedado colgada.
            e.target.value = ''
          }}
        />
        <p className="text-xs text-texto-3">
          Norma 43 (.q43), Excel, CSV o PDF. Hasta 15 MB.
        </p>
      </div>

      {subir.error instanceof ErrorDeApi && (
        <Aviso tono={subir.error.codigo === 'conflicto' ? 'atencion' : 'error'} titulo="No se ha subido">
          {subir.error.message}
        </Aviso>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────── Fila y revisión

const ESTADOS: Record<DocumentoResumen['estado'], string> = {
  subido: 'Subido',
  procesando: 'Leyendo',
  revision: 'Por revisar',
  aplicado: 'Importado',
  fallido: 'No se ha podido leer',
}

const TIPOS: Record<string, string> = {
  extracto_banco: 'Extracto',
  nomina: 'Nómina',
  recibo: 'Recibo',
  factura: 'Factura',
  cuadro_prestamo: 'Préstamo',
  informe_broker: 'Inversión',
  desconocido: 'Sin identificar',
}

function FilaDocumento({
  espacio,
  documento,
  abierto,
  alAbrir,
}: {
  espacio: EspacioResumen
  documento: DocumentoResumen
  abierto: boolean
  alAbrir: () => void
}) {
  const clientes = useQueryClient()
  const puedeEditar = espacio.rol !== 'lector'

  const borrar = useMutation({
    mutationFn: () => api.borrarDocumento(espacio.id, documento.id),
    onSuccess: () => clientes.invalidateQueries({ queryKey: ['documentos', espacio.id] }),
  })

  return (
    <Tarjeta className="p-0">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{documento.nombreOriginal}</p>
          <p className="text-sm text-texto-3">
            {new Date(documento.creadoEn).toLocaleDateString('es-ES')} ·{' '}
            {Math.max(1, Math.round(documento.tamanoBytes / 1024))} KB
            {documento.movimientos ? ` · ${documento.movimientos} movimientos` : ''}
          </p>
        </div>
        <Etiqueta tono={documento.estado === 'aplicado' ? 'marca' : 'neutro'}>
          {TIPOS[documento.tipo] ?? documento.tipo}
        </Etiqueta>
        <Etiqueta>{ESTADOS[documento.estado]}</Etiqueta>
        <Boton variante="secundario" tamano="pequeno" onClick={alAbrir}>
          {abierto ? 'Cerrar' : 'Revisar'}
        </Boton>
        {puedeEditar && (
          <Boton
            variante="fantasma"
            tamano="pequeno"
            cargando={borrar.isPending}
            onClick={() => borrar.mutate()}
          >
            Borrar
          </Boton>
        )}
      </div>

      {abierto && <Revision espacio={espacio} documentoId={documento.id} />}
    </Tarjeta>
  )
}

function Revision({ espacio, documentoId }: { espacio: EspacioResumen; documentoId: string }) {
  const clientes = useQueryClient()
  const lectura = useQuery({
    queryKey: ['lectura', documentoId],
    queryFn: () => api.lecturaDocumento(espacio.id, documentoId),
  })
  const cuentas = useQuery({ queryKey: ['cuentas', espacio.id], queryFn: () => api.cuentas(espacio.id) })
  const categorias = useQuery({
    queryKey: ['categorias', espacio.id],
    queryFn: () => api.categorias(espacio.id),
  })

  const [cuentaId, setCuentaId] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [excluidas, setExcluidas] = useState<Set<string>>(new Set())
  const [resultado, setResultado] = useState<{ creados: number; omitidos: number } | null>(null)

  const disponibles = (cuentas.data?.cuentas ?? []).filter((c) => !c.archivada)
  // La cuenta se propone, no se impone: si el extracto trae los cuatro últimos
  // del IBAN y coinciden con una cuenta, esa; si no, la primera.
  const sugerida = useMemo(() => {
    const ultimos4 = lectura.data?.cuenta?.ibanUltimos4
    const porIban = ultimos4 ? disponibles.find((c) => c.ultimos4 === ultimos4) : undefined
    return porIban?.id ?? disponibles[0]?.id ?? ''
  }, [lectura.data, disponibles])

  const cuentaElegida = cuentaId || sugerida

  const apuntes = lectura.data?.apuntes ?? []
  const marcados = apuntes.filter((a) => !excluidas.has(a.huella) && !a.yaImportado)

  const aplicar = useMutation({
    mutationFn: () =>
      api.aplicarDocumento(espacio.id, documentoId, {
        cuentaId: cuentaElegida,
        categoriaId: categoriaId || null,
        apuntes: marcados.map((a) => ({
          huella: a.huella,
          fecha: a.fecha,
          concepto: a.concepto,
          importe: a.importe,
        })),
      }),
    onSuccess: (datos) => {
      setResultado(datos)
      clientes.invalidateQueries({ queryKey: ['documentos', espacio.id] })
      clientes.invalidateQueries({ queryKey: ['lectura', documentoId] })
      clientes.invalidateQueries({ queryKey: ['movimientos', espacio.id] })
      clientes.invalidateQueries({ queryKey: ['cuentas', espacio.id] })
    },
  })

  if (lectura.isLoading) return <div className="border-t border-linea p-4"><Esqueleto className="h-24 w-full" /></div>

  if (lectura.error instanceof ErrorDeApi) {
    return (
      <div className="border-t border-linea p-4">
        <Aviso tono="error" titulo="No se ha podido leer">{lectura.error.message}</Aviso>
      </div>
    )
  }

  const datos = lectura.data as LecturaDocumento

  return (
    <div className="flex flex-col gap-4 border-t border-linea p-4">
      <p className="text-sm text-texto-2">
        <strong className="font-medium text-texto-1">Qué he entendido:</strong> {datos.deteccion.motivo}
        {datos.hoja && ` He leído la pestaña «${datos.hoja}».`}
      </p>

      {datos.error && <Aviso tono="error" titulo="Al leerlo">{datos.error}</Aviso>}
      {datos.avisos?.map((aviso) => (
        <Aviso key={aviso} tono="atencion">{aviso}</Aviso>
      ))}

      {datos.nomina && <ResumenNomina nomina={datos.nomina} />}
      {datos.cuenta && (datos.cuenta.titular || datos.cuenta.ibanUltimos4) && (
        <p className="text-sm text-texto-3">
          {datos.cuenta.titular}
          {datos.cuenta.ibanUltimos4 && ` · cuenta acabada en ${datos.cuenta.ibanUltimos4}`}
          {datos.desde && ` · del ${fecha(datos.desde)} al ${fecha(datos.hasta ?? datos.desde)}`}
        </p>
      )}

      {apuntes.length === 0 ? (
        <Aviso tono="atencion" titulo="No he sacado ningún movimiento">
          Puedes borrar el documento y probar con otro formato. Si tu banco ofrece la Norma 43
          (.q43), es el que nunca falla.
        </Aviso>
      ) : (
        <>
          <TablaApuntes
            apuntes={apuntes}
            excluidas={excluidas}
            alternar={(huella) => {
              const nuevas = new Set(excluidas)
              if (nuevas.has(huella)) nuevas.delete(huella)
              else nuevas.add(huella)
              setExcluidas(nuevas)
            }}
          />

          {/* Que salgan cero por marcar no es un fallo: pasa siempre que se
              vuelve a subir un extracto que solapa con el anterior, y decirlo
              es mejor que dejar un botón apagado sin explicación. */}
          {marcados.length === 0 && apuntes.every((a) => a.yaImportado) && (
            <Aviso titulo="Esto ya lo tienes">
              Los {apuntes.length} movimientos de este documento ya están en tus cuentas. No hay
              nada que importar.
            </Aviso>
          )}

          {espacio.rol !== 'lector' && marcados.length + excluidas.size > 0 && (
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-texto-2">A la cuenta</span>
                <select
                  value={cuentaElegida}
                  onChange={(e) => setCuentaId(e.target.value)}
                  className="h-11 rounded-campo border border-linea bg-sup-2 px-3 text-texto-1"
                >
                  {disponibles.map((cuenta) => (
                    <option key={cuenta.id} value={cuenta.id}>
                      {cuenta.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-texto-2">Categoría (opcional)</span>
                <select
                  value={categoriaId}
                  onChange={(e) => setCategoriaId(e.target.value)}
                  className="h-11 rounded-campo border border-linea bg-sup-2 px-3 text-texto-1"
                >
                  <option value="">Sin categoría</option>
                  {(categorias.data?.categorias ?? []).map((categoria) => (
                    <option key={categoria.id} value={categoria.id}>
                      {categoria.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <Boton
                cargando={aplicar.isPending}
                disabled={marcados.length === 0 || !cuentaElegida}
                onClick={() => aplicar.mutate()}
              >
                {marcados.length === 1
                  ? 'Importar 1 movimiento'
                  : `Importar ${marcados.length} movimientos`}
              </Boton>
            </div>
          )}

          {aplicar.error instanceof ErrorDeApi && (
            <Aviso tono="error" titulo="No se ha importado">{aplicar.error.message}</Aviso>
          )}
          {resultado && (
            <Aviso titulo="Listo">
              {resultado.creados === 0
                ? 'No había nada nuevo que añadir: ya estaban todos.'
                : `Se han añadido ${resultado.creados} movimientos.`}
              {resultado.omitidos > 0 && ` ${resultado.omitidos} ya estaban y no se han duplicado.`}
            </Aviso>
          )}
        </>
      )}
    </div>
  )
}

function TablaApuntes({
  apuntes,
  excluidas,
  alternar,
}: {
  apuntes: ApunteLeido[]
  excluidas: Set<string>
  alternar: (huella: string) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-[0.08em] text-texto-3">
            <th className="w-8 pb-2" />
            <th className="pb-2 font-medium">Fecha</th>
            <th className="pb-2 font-medium">Concepto</th>
            <th className="pb-2 text-right font-medium">Importe</th>
          </tr>
        </thead>
        <tbody>
          {apuntes.map((apunte) => {
            const fuera = apunte.yaImportado || excluidas.has(apunte.huella)
            return (
              <tr key={apunte.huella} className={`border-t border-linea ${fuera ? 'opacity-50' : ''}`}>
                <td className="py-2 align-top">
                  <input
                    type="checkbox"
                    checked={!fuera}
                    disabled={apunte.yaImportado}
                    onChange={() => alternar(apunte.huella)}
                    aria-label={`Importar ${apunte.concepto}`}
                    className="mt-1 size-4 accent-[var(--color-marca)]"
                  />
                </td>
                <td className="py-2 align-top whitespace-nowrap tabular-nums text-texto-2">
                  {fecha(apunte.fecha)}
                </td>
                <td className="py-2 align-top">
                  <span>{apunte.concepto}</span>
                  {apunte.yaImportado && (
                    <span className="ml-2 text-xs text-texto-3">ya lo tienes</span>
                  )}
                  {apunte.parecidoA && (
                    <span className="ml-2 text-xs text-aviso">
                      se parece a «{apunte.parecidoA.concepto}» del {fecha(apunte.parecidoA.fecha)}
                    </span>
                  )}
                </td>
                <td className="py-2 text-right align-top">
                  <Cifra centimos={apunte.importe} tamano="pequena" colorear />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ResumenNomina({ nomina }: { nomina: NonNullable<LecturaDocumento['nomina']> }) {
  return (
    <div className="grid gap-3 rounded-campo bg-sup-2 p-4 sm:grid-cols-4">
      <Dato nombre="Empresa" texto={nomina.empresa ?? '—'} />
      <Dato
        nombre="Periodo"
        texto={nomina.periodo ? `${fecha(nomina.periodo.desde)} – ${fecha(nomina.periodo.hasta)}` : '—'}
      />
      <Dato nombre="Bruto" importe={nomina.bruto} />
      <Dato nombre="Líquido" importe={nomina.neto} />
      <Dato nombre="IRPF" importe={nomina.irpf} />
      <Dato nombre="Seguridad Social" importe={nomina.cotizaciones} />
    </div>
  )
}

function Dato({ nombre, texto, importe }: { nombre: string; texto?: string; importe?: number | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.08em] text-texto-3">{nombre}</p>
      {/* Un hueco que no se ha sabido leer se enseña como hueco. Poner un cero
          ahí sería inventarse un dato que nadie ha comprobado. */}
      <p className="text-sm">
        {importe !== undefined ? (
          importe === null ? (
            <span className="text-texto-3">no lo he sabido leer</span>
          ) : (
            <Cifra centimos={importe} tamano="pequena" />
          )
        ) : (
          texto
        )}
      </p>
    </div>
  )
}

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}
