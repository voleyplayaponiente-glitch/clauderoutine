import { parsearImporte } from '@norte/dominio'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Aviso, Boton, Campo, Cifra, Esqueleto, EstadoVacio, Etiqueta, Tarjeta } from '../componentes/ui.js'
import { api, ErrorDeApi, type EspacioResumen } from '../lib/api.js'

const TIPOS: { valor: string; texto: string }[] = [
  { valor: 'corriente', texto: 'Cuenta corriente' },
  { valor: 'ahorro', texto: 'Ahorro' },
  { valor: 'efectivo', texto: 'Efectivo' },
  { valor: 'tarjeta_credito', texto: 'Tarjeta de crédito' },
  { valor: 'inversion', texto: 'Inversión' },
  { valor: 'prestamo', texto: 'Préstamo' },
  { valor: 'activo_no_liquido', texto: 'Bien (piso, coche…)' },
]

const PERIODICIDADES = [
  { valor: 'mensual', texto: 'Cada mes' },
  { valor: 'semanal', texto: 'Cada semana' },
  { valor: 'quincenal', texto: 'Cada quince días' },
  { valor: 'bimestral', texto: 'Cada dos meses' },
  { valor: 'trimestral', texto: 'Cada trimestre' },
  { valor: 'semestral', texto: 'Cada semestre' },
  { valor: 'anual', texto: 'Cada año' },
]

export function Cuentas({ espacio }: { espacio: EspacioResumen }) {
  const cuentas = useQuery({ queryKey: ['cuentas', espacio.id], queryFn: () => api.cuentas(espacio.id) })
  const puedeEditar = espacio.rol !== 'lector'

  const total = (cuentas.data?.cuentas ?? [])
    .filter((c) => c.computaPatrimonio && !c.archivada)
    .reduce((suma, c) => suma + c.saldo, 0)

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 px-5 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.02em]">Cuentas</h1>
          <p className="text-texto-2">{espacio.nombre}</p>
        </div>
        {cuentas.data && cuentas.data.cuentas.length > 0 && (
          <div className="text-right">
            <span className="text-xs uppercase tracking-[0.08em] text-texto-3">Suma</span>
            <p className="cifra-heroe text-2xl font-semibold">
              <Cifra centimos={total} tamano="grande" />
            </p>
          </div>
        )}
      </header>

      {cuentas.isLoading ? (
        <Esqueleto className="h-32 w-full" />
      ) : cuentas.data && cuentas.data.cuentas.length === 0 ? (
        <EstadoVacio
          titulo="Aún no tienes cuentas"
          texto="Una cuenta es donde está tu dinero: la corriente del banco, el efectivo de la cartera, una tarjeta. Crea la primera y ya podrás apuntar movimientos."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {(cuentas.data?.cuentas ?? []).map((cuenta) => (
            <FichaCuenta key={cuenta.id} espacioId={espacio.id} cuenta={cuenta} puedeEditar={puedeEditar} />
          ))}
        </div>
      )}

      {puedeEditar && <NuevaCuenta espacioId={espacio.id} />}
      {puedeEditar && <Recurrentes espacio={espacio} />}
    </div>
  )
}

function FichaCuenta({
  espacioId,
  cuenta,
  puedeEditar,
}: {
  espacioId: string
  cuenta: import('../lib/api.js').CuentaResumen
  puedeEditar: boolean
}) {
  const clientes = useQueryClient()
  const borrar = useMutation({
    mutationFn: () => api.borrarCuenta(espacioId, cuenta.id),
    onSuccess: () => {
      clientes.invalidateQueries({ queryKey: ['cuentas', espacioId] })
      clientes.invalidateQueries({ queryKey: ['movimientos', espacioId] })
    },
  })

  const nombreTipo = TIPOS.find((t) => t.valor === cuenta.tipo)?.texto ?? cuenta.tipo

  return (
    <Tarjeta>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-medium">{cuenta.nombre}</h2>
          <p className="text-sm text-texto-3">
            {nombreTipo}
            {cuenta.ultimos4 && ` ····${cuenta.ultimos4}`}
          </p>
        </div>
        <Cifra centimos={cuenta.saldo} tamano="grande" colorear={cuenta.saldo < 0} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!cuenta.visibleEnEspacio && <Etiqueta>Solo tuya</Etiqueta>}
        {!cuenta.computaPatrimonio && <Etiqueta>Fuera del patrimonio</Etiqueta>}
        {cuenta.archivada && <Etiqueta>Archivada</Etiqueta>}
        {puedeEditar && cuenta.esMia && (
          <Boton
            variante="fantasma"
            tamano="pequeno"
            className="ml-auto"
            cargando={borrar.isPending}
            onClick={() => borrar.mutate()}
          >
            Borrar
          </Boton>
        )}
      </div>
    </Tarjeta>
  )
}

function NuevaCuenta({ espacioId }: { espacioId: string }) {
  const clientes = useQueryClient()
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState('corriente')
  const [saldo, setSaldo] = useState('')
  const [privada, setPrivada] = useState(false)

  const crear = useMutation({
    mutationFn: () =>
      api.crearCuenta(espacioId, {
        nombre: nombre.trim(),
        tipo,
        // El saldo se escribe como se escribe en España: «1.250,40».
        saldoInicial: parsearImporte(saldo) ?? 0,
        visibleEnEspacio: !privada,
      }),
    onSuccess: () => {
      setNombre('')
      setSaldo('')
      clientes.invalidateQueries({ queryKey: ['cuentas', espacioId] })
    },
  })
  const error = crear.error instanceof ErrorDeApi ? crear.error : null

  return (
    <Tarjeta titulo="Nueva cuenta">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (nombre.trim()) crear.mutate()
        }}
      >
        <div className="min-w-44 flex-1">
          <Campo etiqueta="Nombre" placeholder="Cuenta del banco" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-texto-2">Tipo</span>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="h-11 rounded-campo border border-linea bg-sup-2 px-3 text-texto-1"
          >
            {TIPOS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.texto}
              </option>
            ))}
          </select>
        </label>
        <div className="w-36">
          <Campo
            etiqueta="Saldo de hoy"
            placeholder="1.250,40"
            value={saldo}
            onChange={(e) => setSaldo(e.target.value)}
          />
        </div>
        <Boton type="submit" cargando={crear.isPending} disabled={!nombre.trim()}>
          Crear
        </Boton>
      </form>

      <label className="mt-3 flex items-center gap-2 text-sm text-texto-2">
        <input type="checkbox" checked={privada} onChange={(e) => setPrivada(e.target.checked)} />
        Solo yo puedo verla, aunque el espacio sea compartido
      </label>

      {error && (
        <div className="mt-3">
          <Aviso tono="error">{error.message}</Aviso>
        </div>
      )}
    </Tarjeta>
  )
}

/**
 * Lo que se repite todos los meses: alquiler, nómina, Netflix.
 *
 * Generan movimientos **previstos**, que no tocan el saldo hasta que se
 * confirman. Se ven en la lista con su etiqueta y ahí se confirman de uno en uno
 * cuando pasan de verdad.
 */
function Recurrentes({ espacio }: { espacio: EspacioResumen }) {
  const clientes = useQueryClient()
  const [concepto, setConcepto] = useState('')
  const [importe, setImporte] = useState('')
  const [cuentaId, setCuentaId] = useState('')
  const [periodicidad, setPeriodicidad] = useState('mensual')
  const [diaDelMes, setDiaDelMes] = useState('1')

  const cuentas = useQuery({ queryKey: ['cuentas', espacio.id], queryFn: () => api.cuentas(espacio.id) })
  const lista = useQuery({ queryKey: ['recurrentes', espacio.id], queryFn: () => api.recurrentes(espacio.id) })

  const invalidar = () => {
    clientes.invalidateQueries({ queryKey: ['recurrentes', espacio.id] })
    clientes.invalidateQueries({ queryKey: ['movimientos', espacio.id] })
  }

  const crear = useMutation({
    mutationFn: () => {
      const hoy = new Date()
      return api.crearRecurrente(espacio.id, {
        cuentaId: cuentaId || cuentas.data?.cuentas[0]?.id,
        concepto: concepto.trim(),
        importe: parsearImporte(importe) ?? 0,
        periodicidad,
        desde: `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`,
        diaDelMes: Number(diaDelMes) || 1,
      })
    },
    onSuccess: () => {
      setConcepto('')
      setImporte('')
      invalidar()
    },
  })

  const generar = useMutation({ mutationFn: () => api.generarPrevistos(espacio.id), onSuccess: invalidar })
  const borrar = useMutation({
    mutationFn: (id: string) => api.borrarRecurrente(espacio.id, id),
    onSuccess: invalidar,
  })

  const error = crear.error instanceof ErrorDeApi ? crear.error : null
  const sinCuentas = (cuentas.data?.cuentas ?? []).length === 0

  return (
    <Tarjeta
      titulo="Se repite cada mes"
      accion={
        (lista.data?.recurrentes ?? []).length > 0 ? (
          <Boton variante="secundario" tamano="pequeno" cargando={generar.isPending} onClick={() => generar.mutate()}>
            {generar.data ? `${generar.data.creados} previstos` : 'Generar previstos'}
          </Boton>
        ) : undefined
      }
    >
      <p className="mb-4 text-sm leading-relaxed text-texto-2">
        El alquiler, la nómina, el gimnasio. Norte los deja como <strong>previstos</strong>: aparecen
        en la lista pero no tocan el saldo hasta que confirmas que han pasado.
      </p>

      {(lista.data?.recurrentes ?? []).length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          {lista.data!.recurrentes.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center gap-3 rounded-campo bg-sup-2 px-3 py-2 text-sm"
            >
              <span className="text-texto-1">{r.concepto}</span>
              <Cifra centimos={r.importe} tamano="pequena" colorear conSigno />
              <span className="text-texto-3">
                {PERIODICIDADES.find((p) => p.valor === r.periodicidad)?.texto.toLowerCase()}
                {r.proxima && ` · próxima el ${r.proxima.slice(8, 10)}/${r.proxima.slice(5, 7)}`}
              </span>
              <Boton
                variante="fantasma"
                tamano="pequeno"
                className="ml-auto"
                onClick={() => borrar.mutate(r.id)}
              >
                Quitar
              </Boton>
            </div>
          ))}
        </div>
      )}

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (concepto.trim() && parsearImporte(importe)) crear.mutate()
        }}
      >
        <div className="min-w-40 flex-1">
          <Campo etiqueta="Concepto" placeholder="Alquiler" value={concepto} onChange={(e) => setConcepto(e.target.value)} />
        </div>
        <div className="w-32">
          <Campo etiqueta="Importe" placeholder="-850" value={importe} onChange={(e) => setImporte(e.target.value)} />
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-texto-2">Cuándo</span>
          <select
            value={periodicidad}
            onChange={(e) => setPeriodicidad(e.target.value)}
            className="h-11 rounded-campo border border-linea bg-sup-2 px-3 text-texto-1"
          >
            {PERIODICIDADES.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.texto}
              </option>
            ))}
          </select>
        </label>
        <div className="w-20">
          <Campo etiqueta="Día" value={diaDelMes} onChange={(e) => setDiaDelMes(e.target.value)} />
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-texto-2">Cuenta</span>
          <select
            value={cuentaId || cuentas.data?.cuentas[0]?.id || ''}
            onChange={(e) => setCuentaId(e.target.value)}
            className="h-11 rounded-campo border border-linea bg-sup-2 px-3 text-texto-1"
          >
            {(cuentas.data?.cuentas ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <Boton type="submit" cargando={crear.isPending} disabled={sinCuentas || !concepto.trim()}>
          Añadir
        </Boton>
      </form>

      {sinCuentas && <p className="mt-3 text-sm text-texto-3">Necesitas una cuenta antes.</p>}
      {error && (
        <div className="mt-3">
          <Aviso tono="error">{error.message}</Aviso>
        </div>
      )}
    </Tarjeta>
  )
}
