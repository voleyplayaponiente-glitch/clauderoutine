import { describe, it, expect } from 'vitest'
import { esModelo200, leerModelo200 } from './modelo200'

/**
 * Modelo 200 REAL del ejercicio 2025 de BTC EMBASSY SPAIN HOLDING, S.L.
 * (NIF B19730290, presentado el 21/07/2026), tal y como lo entrega `celdasDePdf`.
 *
 * Se han conservado las filas que importan de las 26 páginas: identificación,
 * el apartado B de participaciones y socios, el balance, la cuenta de pérdidas
 * y ganancias, la liquidación y el detalle de bases imponibles negativas.
 *
 * Lo que este documento enseñó, y que no se sabía de antemano:
 *  · el modelo **reutiliza números de clave entre secciones** (00301 es
 *    «De valores negociables» en P y G y «Correcciones por IS» en la
 *    liquidación), así que las claves NO pueden vivir en un saco común;
 *  · una fila de aumentos/disminuciones puede traer **dos claves seguidas** y un
 *    solo importe, que es del segundo — de ahí la regla «cada clave se queda con
 *    el importe que va justo detrás»;
 *  · la AEAT **parte la razón social de la participada entre dos líneas**
 *    («BESPAIN 7777, S» + «.L.U.»);
 *  · y la última página **repite el resumen de la liquidación**, así que gana la
 *    primera aparición de cada clave.
 */
const MODELO_200_REAL: string[][] = [
  ["EL", "1", "1", "2025", "AL", "31", "12", "2025", "200"],
  ["Código CNAE-2025", "actividad principal ...", "6421"],
  ["Modelo", "NIF", "Apellidos y nombre o razón social", "2025"],
  ["200", "B19730290", "BTC EMBASSY SPAIN HOLDING, S.L.", "Página 2"],
  ["48682495M", "F", "NIETO LOPEZ, ANDREW"],
  ["B.1.", "Participaciones de la declarante en otras entidades"],
  ["NIF", "(o equivalente al NIF del país de residencia, si no tiene NIF en España)", "...", "B56241854"],
  ["Nombre o razón social", "...", "BESPAIN 7777, S"],
  [".L.U."],
  ["Porcentaje de participación (%, con 2 decimales)", "...", "100,00"],
  ["Valor nominal total de la participación", "...", "3.000,00", "01501", "3.000,00"],
  ["Valor en libros (en el activo de la declarante) de la participación", "...", "3.000,00", "01502", "3.000,00"],
  ["Ingresos por Dividendos recibidos en el ejercicio declarado(*)", "...", "25.000,00", "01503", "25.000,00"],
  ["B.2.", "Participaciones de personas o entidades en la declarante"],
  ["48682495M", "F", "NIETO LOPEZ, ANDREW", "03", "1.000,00", "33,33"],
  ["00834298L", "F", "NIETO CRISTOBAL, JULIO", "03", "1.000,00", "33,33"],
  ["09052282B", "F", "NIETO LOPEZ, JENNIFER", "03", "1.000,00", "33,33"],
  ["Balance: Activo (I)"],
  ["ACTIVO NO CORRIENTE", "(N, A, P)", "...", "00101", "59.189,54"],
  ["Inmovilizado intangible", "(N, A, P)", "...", "00102", "30.673,41"],
  ["Resto (A, P)...", "00110", "30.673,41"],
  ["Inversiones en empresas del grupo y asociadas a largo plazo", "(N, A, P)", "...", "00118", "3.000,00"],
  ["Instrumentos de patrimonio (N, A, P)...", "00119", "3.000,00"],
  ["Inversiones financieras a largo plazo", "(N, A, P) ...", "00126", "24.537,13"],
  ["Instrumentos de patrimonio (N, A, P)...", "00127", "24.537,13"],
  ["Activos por impuesto diferido", "(N, A, P)", "...", "00134", "979,00"],
  ["ACTIVO CORRIENTE", "(N, A, P)", "...", "00136", "21.264,34"],
  ["Balance: Activo (II)"],
  ["Inversiones en empresas del grupo y asociadas a corto plazo", "(N, A, P)", "...", "00160", "12.000,00"],
  ["Resto (A, P)...", "00167", "12.000,00"],
  ["Efectivo y otros activos líquidos equivalentes", "(N, A, P)", "...", "00177", "9.264,34"],
  ["TOTAL ACTIVO", "(N, A, P)", "...", "00180", "80.453,88"],
  ["Balance: Patrimonio neto y pasivo (I)"],
  ["PATRIMONIO NETO", "(N, A, P)", "...", "00185", "28.411,40"],
  ["Fondos propios", "(N, A, P)", "...", "00186", "28.411,40"],
  ["Capital", "(N, A, P)", "...", "00187", "3.000,00"],
  ["Capital escriturado (N, A, P) ...", "00188", "3.000,00"],
  ["Reservas", "(N, A, P)", "...", "00191", "5.467,39"],
  ["Otras reservas (N, A, P) ...", "00193", "5.467,39"],
  ["Resultado del ejercicio", "(N, A, P)", "...", "00199", "19.944,01"],
  ["PASIVO NO CORRIENTE", "(N, A, P)", "...", "00210", "51.863,28"],
  ["Deudas a largo plazo", "(N, A, P)", "...", "00216", "51.863,28"],
  ["Otras deudas a largo plazo (A, P)...", "00222", "51.863,28"],
  ["Balance: Patrimonio neto y pasivo (II)"],
  ["PASIVO CORRIENTE", "(N, A, P)", "...", "00228", "179,20"],
  ["Acreedores comerciales y otras cuentas a pagar", "(N, A, P)", "...", "00239", "179,20"],
  ["Otros acreedores (A, P)", "...", "00249", "179,20"],
  ["TOTAL PATRIMONIO NETO Y PASIVO", "(N, A, P)", "...", "00252", "80.453,88"],
  ["Cuenta de pérdidas y ganancias (I)"],
  ["Otros gastos de explotación", "(N, A, P)", "...", "00279", "-1.183,90"],
  ["Servicios exteriores (N, A, P) ...", "00280", "-1.183,90"],
  ["Servicios profesionales independientes (N, A, P) ...", "00253", "-917,10"],
  ["Resto (N, A, P) ...", "00254", "-266,80"],
  ["Amortización del inmovilizado", "(N, A, P)", "...", "00284", "-2.646,85"],
  ["Otros resultados", "(N, A, P)", "...", "00295", "-1.101,61"],
  ["RESULTADO DE EXPLOTACIÓN", "(N, A, P)", "...", "00296", "-4.932,36"],
  ["Cuenta de pérdidas y ganancias (II)"],
  ["Ingresos financieros", "(N, A, P)", "...", "00297", "25.000,00"],
  ["De participaciones en instrumentos de patrimonio (N, A, P) ...", "00298", "25.000,00"],
  ["En empresas del grupo y asociadas (N, A, P) ...", "00299", "25.000,00"],
  ["Gastos financieros", "(N, A, P)", "...", "00305", "-1.365,19"],
  ["Por deudas con terceros (N, A, P)...", "00307", "-1.365,19"],
  ["Variación de valor razonable en instrumentos financieros", "(N, A, P)", "...", "00309", "340,10"],
  ["RESULTADO FINANCIERO", "(N, A, P)", "...", "00324", "23.974,91"],
  ["RESULTADO ANTES DE IMPUESTOS", "(N, A, P)", "...", "00325", "19.042,55"],
  ["Impuestos sobre beneficios", "(N, A, P)", "...", "00326", "901,46"],
  ["RESULTADO DEL EJERCICIO PROCEDENTE DE OPERACIONES CONTINUADAS (N, A, P) ...", "00327", "19.944,01"],
  ["RESULTADO DE LA CUENTA DE PÉRDIDAS Y GANANCIAS", "(N, A, P)", "...", "00500", "19.944,01"],
  ["Liquidación (I)"],
  ["Resultado de la cuenta de pérdidas y ganancias", "...", "00500", "19.944,01"],
  ["Correcciones por Impuesto sobre Sociedades...", "00301", "00302", "901,46"],
  ["Resultado de la cuenta de pérdidas y ganancias antes de Impuesto sobre Sociedades e Impuesto Complementario ...", "00501", "19.042,55"],
  ["Correcciones al resultado contable al considerar los requisitos o calificaciones contables referidos al grupo", "01230", "01231"],
  ["Cambio de criterios contables (art. 11.3.2º LIS) ...", "00355", "00356"],
  ["Operaciones a plazos (art. 11.4 LIS)", "...", "00357", "00358"],
  ["Reversión del deterioro del valor de los elementos patrimoniales (art. 11.6 LIS)...", "00359", "00360"],
  ["Rentas negativas (art. 11.9 y 11.10 LIS)", "...", "00225", "00226"],
  ["Ajustes por rentas derivadas de operaciones con quita o espera (art. 11.13 LIS)", "...", "01514", "00272"],
  ["Otras diferencias de imputación temporal de ingresos y gastos (art. 11 LIS)", "...", "00361", "00362"],
  ["Diferencias entre amortización contable y fiscal (art. 12.1 LIS) ...", "00303", "00304"],
  ["Amortización del inmovilizado intangible y fondo de comercio (art. 12.2 LIS) y amortización de la DT 13ª.1 LIS ...", "01005", "01006"],
  ["Amortización de inmovilizado afecto a actividades de investigación y desarrollo (art. 12.3 b) LIS) ...", "00305", "00306"],
  ["Libertad de amortización de gastos de investigación y desarrollo (art. 12.3 c) LIS) ...", "00307", "00308"],
  ["Libertad de amortización inmovilizado material nuevo (art. 12.3 e) LIS) ...", "01003", "01004"],
  ["Otros supuestos de libertad de amortización (art. 12.3 a) y d), DA 16ª y 17ª LIS)", "...", "00309", "00310"],
  ["Amortización acelerada de determinados vehículos y de nuevas infraestructuras de recarga (DA 18ª LIS RDL 5/2023) ...", "00775", "00776"],
  ["Libertad de amortización de determinados vehículos y de nuevas infraestructuras de recarga (DA 18ª LIS RDL 4/2024 y RDL 7/2026)", "00005", "00006"],
  ["Libertad de amortización con mantenimiento de empleo (RDL 6/2010 y DT 13ª.2 LIS)", "...", "00514", "00509"],
  ["Libertad de amortización sin mantenimiento de empleo (RDL 13/2010 y DT 13ª.2 LIS)", "...", "00516", "00551"],
  ["Pérdidas por deterioro del art. 13.1 LIS no afectada por el art. 11.12", "ni por DT 33ª.1 LIS", "...", "00321", "00322"],
  ["Pérdidas por deterioro del art. 13.1 LIS y provisiones y gastos (art. 14.1 y 14.2 LIS) a los que se refiere el art. 11.12 y DT 33ª.1 LIS", ".", "00415", "00211"],
  ["Pérdidas por deterioro de IM, inversiones inmobiliarias e II, incluido el fondo de comercio (art. 13.2 a) y DT 15 LIS)", "...", "00331", "00332"],
  ["Ajustes por pérdidas por deterioro de valores repr. de partic. en el capital o fondos propios (art. 13.2 b) LIS)", "...", "00325", "00326"],
  ["Pérdidas por deterioro de valores representativos de deuda (art. 13.2 c) LIS y DT 15ª LIS)", "...", "00327", "00328"],
  ["Ajustes por deterioro de valores representativos de participaciones en el capital o fondos propios (DT 16ª.1 y 2 LIS)", "...", "02919", "02920"],
  ["Ajustes por deterioro de valores representativos de participaciones en el capital o fondos propios (DT 16ª.3 LIS)", "...", "00524", "00525"],
  ["Aplicación del límite del art. 11.12 LIS a las pérdidas por deterioro del art. 13.1 LIS y provisiones y gastos (art. 14.1 y 14.2 LIS) ...", "00416", "00543"],
  ["Gastos y provisiones por pensiones no afectados por el art. 11.12 LIS (art. 14.1, 14.6 y 14.8 LIS)", "...", "00335", "00336"],
  ["Otras provisiones no deducibles fiscalmente (art. 14 LIS) no afectadas por el art. 11.12 LIS ...", "00337", "00338"],
  ["Gastos por donativos y liberalidades (art. 15 e) LIS)", "...", "00339", "1.101,61"],
  ["Operaciones realizadas con jurisdicciones no cooperativas (art. 15 g) LIS)", "...", "00341", "00342"],
  ["Asimetrías híbridas (art. 15 bis LIS, excepto art. 15 bis.12 LIS)", "...", "02469", "02470"],
  ["Entidad en régimen de atribución de rentas: asimetrías híbridas (art. 15 bis.12 LIS)", "...", "00333", "00334"],
  ["Pérdidas por deterioro de valores repr. de partic. en el capital o fondos propios (art. 15 k) LIS) ...", "01807", "01811"],
  ["Disminución de valor originada por criterio de valor razonable (art. 15 l) LIS)", "...", "01808", "01812"],
  ["Deuda tributaria de actos jurídicos documentados (ITP y AJD) (art. 15 m) LIS) ...", "01813", "01814"],
  ["Ajustes por la limitación en la deducibilidad de gastos financieros (art. 16 LIS)", "...", "00363", "00364"],
  ["Revalorizaciones contables (art. 17.1 LIS)", "...", "00345", "00346"],
  ["Operaciones de aumento de capital o fondos propios por compensación de créditos (art. 17.2 LIS) ...", "01818", "01819"],
  ["Transmisiones lucrativas y societarias: aplicación del valor de mercado (art. 17.4 LIS)", "...", "00347", "00348"],
  ["Operaciones vinculadas: aplicación del valor de mercado (art. 18 LIS ) ...", "01011", "01012"],
  ["Cambio de residencia a Estados miembros de la Unión Europea o EEE (art. 19.1 LIS)", "...", "01572", "01573"],
  ["Liquidación (II)"],
  ["Operaciones del art. 19 LIS distintas del cambio de residencia a Estados miembros de la Unión Europea o EEE ...", "01574", "01575"],
  ["Efectos de la valoración contable diferente a la fiscal (art. 20 LIS) ...", "01015", "01016"],
  ["Exención sobre dividendos o participaciones en beneficios de entidades residentes (art. 21.1, 21.10 y DT 40ª LIS)", "...", "00370", "23.750,00"],
  ["Exención sobre la renta obtenida en la transmisión de valores entidades residentes (art. 21.3, 21.10 y DT 40ª LIS)", "...", "02182", "02183"],
  ["Exención sobre la renta obtenida en la transmisión de valores entidades no residentes (art. 21.3, 21.10 y DT 40ª LIS)", ".", "02184", "02185"],
  ["Exención sobre la renta obtenida en los supuestos del art. 21.3, 21.10 y DT 40ª LIS distintos a transmisiones de valores entidades residentes", "02186", "02187"],
  ["Exención sobre la renta obtenida en los supuestos del art. 21.3, 21.10 y DT 40ª LIS distintos a transmisiones de valores entidades no residentes", "02188", "02189"],
  ["Exención de rentas en el extranjero (art. 22 LIS)", "...", "00256", "00278"],
  ["Reducción de rentas procedentes de determinados activos intangibles (art. 23 LIS)", "...", "01822", "00372"],
  ["Obra benéfico-social de las cajas de ahorro y fundaciones bancarias (art. 24 LIS)", "...", "00373", "00374"],
  ["Impuesto extranjero soportado por el contribuyente, no deducible por afectar a rentas con deducción por doble imposición (art. 31.2 LIS)", "00340", "01589"],
  ["Agrupación de interés económico (Cap. II del Tít. VII LIS)", "...", "00375", "00376"],
  ["Unión temporal de empresas, ajustes del art. 45.1 LIS", "...", "01320", "01321"],
  ["Unión temporal de empresas, ajustes por rentas exentas de UTE que opera en el extranjero (art. 45.2 LIS)", "...", "00184", "00544"],
  ["análogas a las UTE (art. 45.2 LIS)", "...", "01022", "01023"],
  ["Unión temporal de empresas, ajustes por criterios de imputación temporal (art. 46.2 LIS)", "...", "01018", "01019"],
  ["Bases imponibles negativas generadas dentro del grupo fiscal por la ent. transmitida y que hayan sido compensadas (art. 62.2 LIS)", "01275", "01276"],
  ["Sociedades y fondos de capital-riesgo y sociedades de desarrollo industrial regional (capítulo IV del título VII LIS)", "...", "00377", "00378"],
  ["Valoración de bienes y derechos. Régimen especial operaciones reestructuración (capítulo VII del título VII LIS)", "...", "00379", "00380"],
  ["Minería e hidrocarburos: factor agotamiento (arts. 91 y 95 LIS)", "...", "00381", "00382"],
  ["Hidrocarburos: Amortización de inversiones intangibles y gastos de investigación (art. 99 LIS) ...", "00383", "00384"],
  ["Transparencia fiscal internacional (art. 100 LIS)", "...", "00387", "00388"],
  ["Empresas de reducida dimensión: libertad de amortización (art. 102 LIS)", "...", "00311", "00312"],
  ["Empresas de reducida dimensión: amortización acelerada (art. 103 LIS y DT 28ª LIS)", "...", "00313", "00314"],
  ["Empresas de reducida dimensión: pérdidas por deterioro créditos insolvencias (art. 104 LIS)", "...", "00323", "00324"],
  ["Arrendamiento financiero: régimen especial (art. 106 LIS)", "...", "00317", "00318"],
  ["Régimen fiscal entidades de tenencia de valores extranjeros (capítulo XIII del título VII LIS)", "...", "00385", "00386"],
  ["Régimen de entidades parcialmente exentas (capítulo XIV del título VII LIS) ...", "00389", "00390"],
  ["Régimen de entidades navieras en función del tonelaje (capítulo XVI del título VII LIS)", "...", "00397", "00398"],
  ["Aportaciones y colaboración a favor de entidades sin fines lucrativos ...", "00250", "00251"],
  ["Régimen fiscal entidades sin fines lucrativos (Ley 49/2002)", "...", "00391", "00392"],
  ["Reserva para inversiones en Canarias (Ley 19/1994) ...", "00403", "00404"],
  ["Reserva para inversiones en Illes Balears (DA 70ª Ley 31/2022) ...", "00778", "00813"],
  ["Exención transmisión bienes inmuebles (DA 6ª LIS) ...", "00518", "00519"],
  ["XXXVII Copa América Barcelona (Ley 31/2022) ...", "01905", "01906"],
  ["Operaciones a plazos (DT 1ª LIS)", "...", "00510", "00512"],
  ["Adquisición de participaciones en entidades no residentes (DT 14ª LIS) (Para participaciones adquiridas hasta el 21/12/07)...", "00329", "00330"],
  ["Reinversión de beneficios extraordinarios (DT 24ª LIS) ...", "00365", "01026"],
  ["Entidades en régimen de atribución de rentas constituidas en el extranjero con presencia en territorio español (art. 38 TRLIRNR)", "00409", "00410"],
  ["Correcciones específicas de entidades sometidas a la normativa foral", "...", "00411", "00412"],
  ["Eliminaciones pendientes de incorporar de sociedades que dejen de pertenecer a un grupo", "...", "01027", "01028"],
  ["Otras correcciones al resultado de la cuenta de pérdidas y ganancias", "...", "00413", "00414"],
  ["Total correcciones al resultado de la cuenta de pérdidas y ganancias", "(excluidas las correcciones por IS y por IC)", "00417", "1.101,61", "00418", "23.750,00"],
  ["Liquidación (III)"],
  ["Base imponible antes de la aplicación de la reserva de capitalización y compensación de bases imponibles negativas ...", "00550", "-3.605,84"],
  ["Base imponible", "...", "00552", "-3.605,84"],
  ["Base imponible después de la reserva de nivelación", "...", "01330", "-3.605,84"],
  ["Tipo de gravamen ...", "00558", "25"],
  ["se refiere el art. 11.12 LIS (convertida en cuota) ...", "00210", "00480"],
  ["y provisiones y gastos (art. 14.1 y 14.2 LIS) ...", "00408", "01037"],
  ["Reserva de nivelación convertido en cuotas (sólo entidades del art. 101 LIS)...", "01285", "01286"],
  ["Liquidación (IV)"],
  ["Retenciones por rendimientos del capital mobiliario", "...", "01785", "01786"],
  ["Retenciones por arrendamientos de inmuebles urbanos ...", "01787", "01788"],
  ["Retenciones por rendimientos del capital mobiliario atribuidas por", "entidades en atribución de rentas", "...", "01789", "01790"],
  ["Retenciones por arrendamientos de inmuebles urbanos atribuidas", "por entidades en atribución de rentas", "...", "01791", "01792"],
  ["arrendamientos de inmuebles urbanos atribuidas por entidades en", "atribución de rentas ...", "01793", "01794"],
  ["Retenciones e ingresos a cuenta participaciones IIC", "...", "01795", "01796"],
  ["Retenciones sobre los premios de determinadas loterías y apuestas...", "00597", "01797"],
  ["Retenciones por otros conceptos NO incluidos en las casillas anteriores", "...", "01798", "01799"],
  ["Total retenciones e ingresos a cuenta ...", "01766", "01784"],
  ["Cuota del ejercicio a ingresar o a devolver", "...", "00599", "00600"],
  ["1er", "pago fraccionado ...", "00601", "00602"],
  ["2º pago fraccionado ...", "00603", "00604"],
  ["3er", "pago fraccionado ...", "00605", "00606"],
  ["Cuota diferencial", "...", "00611", "00612"],
  ["Incremento por pérdida beneficios fiscales períodos anteriores...", "00615", "00616"],
  ["Incremento por incumplimiento de requisitos SOCIMI(**) ...", "00633", "00642"],
  ["Intereses de demora ...", "00617", "00618"],
  ["(opción art. 39.2 LIS) ...", "01234", "00083", "01332"],
  ["(art. 39.3 LIS)...", "01892", "01042", "01333"],
  ["Abono de deducciones por producciones cinematográficas extranjeras", "01319", "01893", "01881"],
  ["Discrepancia de criterio administrativo para determinados supuestos de", "00031", "00032", "00466"],
  ["Resultado de la autoliquidación", "...", "01586", "01587"],
  ["administrativas correspondientes al periodo impositivo 2025 ...", "01578", "01583"],
  ["anteriores o liquidaciones administrativas correspondientes al periodo", "impositivo 2025 ...", "01584", "01585"],
  ["Resultado", "...", "00621", "00622"],
  ["Importe integrado en la base imponible...", "01588", "02480"],
  ["Deuda tributaria resultante del fraccionamiento art. 19.1 LIS ...", "02481", "02482"],
  ["1er", "fraccionamiento ...", "02483", "02484"],
  ["Resultado de la autoliquidación incluido el 1er fraccionamiento del art. 19.1 LIS", "...", "02485", "02486"],
  ["autoliquidación anterior o liquidación administrativa correspondiente al período impositivo 2025", "...", "02487", "02488"],
  ["Resultado incluido el 1er fraccionamiento del art. 19.1 LIS ...", "02489", "03242"],
  ["exigible frente a la Administración tributaria (art. 130 LIS)", "...", "00150", "01020", "01043"],
  ["crédito exigible frente a la Administración tributaria (art. 130 LIS)", "...", "00506", "01021", "01044"],
  ["Rectificativa:", "Devolución acordada/compensada", "...", "03243", "03244", "03245"],
  ["Resultado de conversión de AID tras regularización: Abono", "...", "03317", "03318", "03319"],
  ["Resultado de conversión de AID tras regularización: Compensación", "03320", "02490", "02491"],
  ["Resultado de conversión de AID tras regularización: A ingresar...", "02492", "02493", "02494"],
  ["Detalle de la compensación de bases imponibles negativas"],
  ["Compensación de base año 2024 ...", "03402", "310,15", "03403", "03404", "310,15"],
  ["Compensación de base año 2025(*) ...", "02316", "02317", "02318"],
  ["Compensación de base año 2025 ...", "01048", "3.605,84", "01049", "3.605,84"],
  ["Liquidación (3)"],]

describe('Modelo 200 REAL (BTC EMBASSY SPAIN HOLDING, ejercicio 2025)', () => {
  const d = leerModelo200(MODELO_200_REAL)

  it('reconoce el documento', () => {
    expect(esModelo200(MODELO_200_REAL)).toBe(true)
  })

  it('lee la identificación y el periodo impositivo', () => {
    expect(d.nif).toBe('B19730290')
    expect(d.razonSocial).toBe('BTC EMBASSY SPAIN HOLDING, S.L.')
    expect(d.ejercicio).toBe(2025)
    expect(d.periodo).toEqual({ desde: '2025-01-01', hasta: '2025-12-31' })
    expect(d.cnae).toBe('6421')
  })

  it('lee el balance y CUADRA activo con patrimonio neto y pasivo', () => {
    expect(d.balance.activoNoCorriente).toBe(59189.54)
    expect(d.balance.activoCorriente).toBe(21264.34)
    expect(d.balance.totalActivo).toBe(80453.88)
    expect(d.balance.patrimonioNeto).toBe(28411.4)
    expect(d.balance.capital).toBe(3000)
    expect(d.balance.reservas).toBe(5467.39)
    expect(d.balance.pasivoNoCorriente).toBe(51863.28)
    expect(d.balance.pasivoCorriente).toBe(179.2)
    expect(d.balance.totalPasivo).toBe(80453.88)
    expect(d.avisos.some((a) => a.includes('no cuadra'))).toBe(false)
  })

  it('lee la cuenta de pérdidas y ganancias', () => {
    expect(d.perdidasYGanancias.otrosGastosExplotacion).toBe(-1183.9)
    expect(d.perdidasYGanancias.amortizacion).toBe(-2646.85)
    expect(d.perdidasYGanancias.resultadoExplotacion).toBe(-4932.36)
    expect(d.perdidasYGanancias.ingresosFinancieros).toBe(25000)
    expect(d.perdidasYGanancias.gastosFinancieros).toBe(-1365.19)
    expect(d.perdidasYGanancias.resultadoFinanciero).toBe(23974.91)
    expect(d.perdidasYGanancias.resultadoAntesImpuestos).toBe(19042.55)
    expect(d.perdidasYGanancias.resultado).toBe(19944.01)
  })

  it('el resultado del balance coincide con el de pérdidas y ganancias', () => {
    expect(d.balance.resultadoEjercicio).toBe(19944.01)
    expect(d.avisos.some((a) => a.includes('no coincide'))).toBe(false)
  })

  it('NO mezcla la clave 00301 de P y G con la de la liquidación', () => {
    // En P y G 00301 es «De valores negociables» (vacía) y en la liquidación es
    // «Correcciones por IS: aumentos» (también vacía, el importe es de 00302).
    expect(d.claves.PYG['00301']).toBeUndefined()
    expect(d.claves.LIQUIDACION['00301']).toBeUndefined()
    expect(d.claves.LIQUIDACION['00302']).toBe(901.46)
  })

  it('lee la liquidación, con la base imponible NEGATIVA', () => {
    expect(d.liquidacion.resultadoContable).toBe(19944.01)
    expect(d.liquidacion.baseAntesCompensacion).toBe(-3605.84)
    expect(d.liquidacion.baseImponible).toBe(-3605.84)
    expect(d.liquidacion.tipoGravamen).toBe(25)
    expect(d.avisos.some((a) => a.includes('negativa'))).toBe(true)
  })

  it('lee las bases negativas pendientes de compensar', () => {
    const b2024 = d.basesNegativas.find((b) => b.anio === 2024)
    expect(b2024?.pendienteFuturo).toBe(310.15)
    // 310,15 de 2024 + 3.605,84 generada en 2025
    expect(d.binPendiente).toBe(3915.99)
  })

  it('lee la participada, recomponiendo la razón social partida en dos líneas', () => {
    expect(d.participadas).toHaveLength(1)
    expect(d.participadas[0]).toEqual({
      nif: 'B56241854',
      nombre: 'BESPAIN 7777, S.L.U.',
      porcentaje: 100,
      nominal: 3000,
      valorLibros: 3000,
      dividendos: 25000,
    })
  })

  it('lee los tres socios con su nominal y su porcentaje', () => {
    expect(d.socios).toHaveLength(3)
    expect(d.socios[0]).toEqual({ nif: '48682495M', nombre: 'NIETO LOPEZ, ANDREW', nominal: 1000, porcentaje: 33.33 })
    expect(d.socios.map((s) => s.nif)).toEqual(['48682495M', '00834298L', '09052282B'])
    expect(d.socios.every((s) => s.nominal === 1000)).toBe(true)
  })
})
