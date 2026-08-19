import { Aviso, Tarjeta } from '../componentes/ui.js'

/**
 * Aviso legal, condiciones de uso y privacidad.
 *
 * Están escritos **desde lo que el programa hace de verdad**, no copiados de
 * una plantilla. La diferencia importa mucho aquí: en una instalación
 * autoalojada, Norte no recoge nada, no llama a ningún servidor y no puede ver
 * los datos de nadie, así que la mitad de las cláusulas de una política de
 * privacidad al uso —transferencias internacionales, encargados, cesiones—
 * simplemente no aplican, y ponerlas sería mentir en el sentido tranquilizador.
 *
 * Y va dicho también aquí, aunque no guste: **esto no es asesoramiento legal**.
 * Los textos describen con exactitud el comportamiento del programa, que es
 * justo lo que un abogado necesita para adaptarlos; venderlo a terceros sin que
 * alguien los revise es asumir un riesgo que nadie tiene por qué asumir.
 */
export function Legal() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-5 py-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-[-0.02em]">Aviso legal y privacidad</h1>
        <p className="text-texto-2">De Norte y de esta instalación</p>
      </header>

      <Aviso tono="atencion" titulo="Léelo antes de vender Norte a nadie">
        Estos textos describen con exactitud lo que el programa hace, que es lo que un abogado
        necesita para adaptarlos a tu caso. <strong>No son asesoramiento legal</strong> y no los ha
        revisado ningún jurista.
      </Aviso>

      <Tarjeta titulo="Qué es Norte y qué no es">
        <div className="flex flex-col gap-3 text-[0.95rem] leading-relaxed text-texto-2">
          <p>
            Norte es un programa de <strong>control presupuestario personal</strong>. Sirve para
            anotar y entender tu dinero.
          </p>
          <p>
            <strong>Norte no es una entidad de pago ni una entidad financiera.</strong> No mueve
            dinero, no ordena transferencias, no se conecta a tu banco y no tiene acceso a ninguna
            cuenta tuya. Cuando la aplicación dice que alguien «le pasa 40 € a otro», está
            proponiendo una transferencia que harás tú por tu cuenta, en tu banco.
          </p>
          <p>
            <strong>Norte no da asesoramiento de inversión ni fiscal.</strong> Los cálculos de
            rentabilidad, amortización, plusvalía o patrimonio son aritmética sobre lo que tú has
            apuntado. Pueden servirte para decidir, pero la decisión y sus consecuencias son tuyas.
            En particular, la plusvalía que enseña Norte usa coste medio ponderado y{' '}
            <strong>Hacienda liquida por FIFO</strong>: para tu declaración, el número puede no ser
            ese.
          </p>
          <p>
            Los informes que genera Norte <strong>no son documentos contables</strong> y no sirven
            para presentar nada ante ninguna administración.
          </p>
        </div>
      </Tarjeta>

      <Tarjeta titulo="Tus datos, en tu servidor">
        <div className="flex flex-col gap-3 text-[0.95rem] leading-relaxed text-texto-2">
          <p>
            Esta instalación de Norte corre en un servidor que controla quien la instaló. Los datos
            —cuentas, movimientos, documentos que subas— se guardan en una base de datos{' '}
            <strong>de ese servidor</strong>.
          </p>
          <p>
            <strong>Norte no envía nada a ninguna parte.</strong> No hay analítica, no hay
            telemetría, no hay servicios de terceros, no hay publicidad y no se comprueba la
            licencia contra ningún servidor: la clave se valida con criptografía dentro de tu
            instalación, sin conexión.
          </p>
          <p>
            En términos del RGPD: si te autoalojas, <strong>tú eres el responsable</strong> del
            tratamiento de tus datos y de los de quien invites. Quien te vendió el programa no es
            encargado del tratamiento, porque no accede a los datos ni puede hacerlo.
          </p>
          <p>
            <strong>Puedes llevarte todo cuando quieras</strong>, en JSON y en CSV, desde Ajustes.
            Exportar funciona siempre: también sin licencia, también con la licencia caducada y
            también si tu cuenta está en solo lectura.
          </p>
          <p>
            Al borrar algo, Norte lo marca como borrado y lo guarda 30 días antes de eliminarlo,
            para que un descuido tenga arreglo.
          </p>
        </div>
      </Tarjeta>

      <Tarjeta titulo="Condiciones de uso">
        <div className="flex flex-col gap-3 text-[0.95rem] leading-relaxed text-texto-2">
          <p>
            La licencia de Norte es de uso: te permite instalar y usar el programa según el plan
            contratado. No es una suscripción a un servicio; el programa ya está en tu máquina.
          </p>
          <p>
            <strong>Si la licencia caduca, no pierdes nada.</strong> No se borra ni se bloquea
            ningún dato. Lo único que ocurre es que el cupo de personas vuelve al de una
            instalación sin licencia; quien exceda ese cupo puede seguir consultando y exportando,
            pero no escribir. Quien ya usaba la instalación antes de que existieran las licencias
            no cuenta para el cupo, nunca.
          </p>
          <p>
            El programa se entrega <strong>tal cual</strong>, sin garantía de que sea apto para un
            fin concreto. Es aritmética sobre tus datos, y la responsabilidad de lo que decidas con
            ella es tuya.
          </p>
          <p>
            Haz copias de seguridad. Norte trae un servicio de copias automáticas y avisa en la
            pantalla de inicio cuando no está funcionando; hacerle caso a ese aviso es parte de
            usar el programa.
          </p>
        </div>
      </Tarjeta>
    </div>
  )
}
