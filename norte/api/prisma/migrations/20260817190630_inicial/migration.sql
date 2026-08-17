-- CreateEnum
CREATE TYPE "TipoEspacio" AS ENUM ('personal', 'pareja', 'negocio');

-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('propietario', 'editor', 'lector');

-- CreateEnum
CREATE TYPE "TipoCuenta" AS ENUM ('corriente', 'ahorro', 'efectivo', 'tarjeta_credito', 'inversion', 'prestamo', 'activo_no_liquido');

-- CreateEnum
CREATE TYPE "FlujoCategoria" AS ENUM ('gasto', 'ingreso');

-- CreateEnum
CREATE TYPE "TipoCategoria" AS ENUM ('fijo', 'variable', 'discrecional');

-- CreateEnum
CREATE TYPE "EstadoMovimiento" AS ENUM ('previsto', 'confirmado');

-- CreateEnum
CREATE TYPE "Periodicidad" AS ENUM ('semanal', 'quincenal', 'mensual', 'bimestral', 'trimestral', 'semestral', 'anual');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('extracto_banco', 'nomina', 'recibo', 'factura', 'cuadro_prestamo', 'informe_broker', 'desconocido');

-- CreateEnum
CREATE TYPE "EstadoDocumento" AS ENUM ('subido', 'procesando', 'revision', 'aplicado', 'fallido');

-- CreateEnum
CREATE TYPE "NaturalezaIngreso" AS ENUM ('nomina', 'autonomo', 'alquiler', 'dividendos', 'intereses', 'negocio', 'otros');

-- CreateEnum
CREATE TYPE "Variabilidad" AS ENUM ('fija', 'variable');

-- CreateEnum
CREATE TYPE "MetodoPresupuesto" AS ENUM ('base_cero', 'cincuenta_treinta_veinte', 'sobres');

-- CreateEnum
CREATE TYPE "TipoDeuda" AS ENUM ('hipoteca', 'prestamo_personal', 'auto', 'estudios', 'familiar', 'tarjeta_revolving');

-- CreateEnum
CREATE TYPE "SistemaAmortizacion" AS ENUM ('frances', 'aleman', 'americano');

-- CreateEnum
CREATE TYPE "ModalidadTarjeta" AS ENUM ('pago_total', 'aplazado');

-- CreateEnum
CREATE TYPE "ClaseActivo" AS ENUM ('renta_variable', 'renta_fija', 'monetario', 'inmobiliario', 'materias_primas', 'cripto', 'otros');

-- CreateEnum
CREATE TYPE "TipoCuentaInversion" AS ENUM ('broker', 'plan_pensiones', 'fondo', 'cripto', 'inmobiliario');

-- CreateEnum
CREATE TYPE "TipoMovimientoInversion" AS ENUM ('compra', 'venta', 'aportacion', 'retirada', 'dividendo', 'comision', 'split');

-- CreateEnum
CREATE TYPE "TipoReparto" AS ENUM ('mitades', 'proporcional_ingresos', 'porcentaje_manual', 'importe_fijo');

-- CreateEnum
CREATE TYPE "EstadoLiquidacion" AS ENUM ('pendiente', 'saldada');

-- CreateEnum
CREATE TYPE "TipoMovimientoCapital" AS ENUM ('aportacion', 'retirada', 'reparto_beneficios');

-- CreateEnum
CREATE TYPE "PlanLicencia" AS ENUM ('prueba', 'personal', 'pareja', 'negocio');

-- CreateEnum
CREATE TYPE "EstadoLicencia" AS ENUM ('activa', 'caducada', 'revocada');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "hashContrasena" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "divisaBase" TEXT NOT NULL DEFAULT 'EUR',
    "zonaHoraria" TEXT NOT NULL DEFAULT 'Europe/Madrid',
    "totpSecreto" TEXT,
    "totpActivo" BOOLEAN NOT NULL DEFAULT false,
    "preferencias" JSONB NOT NULL DEFAULT '{}',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "borradoEn" TIMESTAMP(3),

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "hashToken" TEXT NOT NULL,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "ultimoUso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agente" TEXT,
    "ip" TEXT,

    CONSTRAINT "sesiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "espacios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoEspacio" NOT NULL,
    "divisaBase" TEXT NOT NULL DEFAULT 'EUR',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "borradoEn" TIMESTAMP(3),

    CONSTRAINT "espacios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "miembros_espacio" (
    "id" TEXT NOT NULL,
    "espacioId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'editor',
    "participacion" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "altaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bajaEn" TIMESTAMP(3),

    CONSTRAINT "miembros_espacio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitaciones" (
    "id" TEXT NOT NULL,
    "espacioId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'editor',
    "hashToken" TEXT NOT NULL,
    "invitadaPorId" TEXT NOT NULL,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "aceptadaEn" TIMESTAMP(3),
    "revocadaEn" TIMESTAMP(3),

    CONSTRAINT "invitaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registro_actividad" (
    "id" TEXT NOT NULL,
    "espacioId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT,
    "detalle" JSONB NOT NULL DEFAULT '{}',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registro_actividad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuentas" (
    "id" TEXT NOT NULL,
    "espacioId" TEXT NOT NULL,
    "propietarioId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoCuenta" NOT NULL,
    "divisa" TEXT NOT NULL DEFAULT 'EUR',
    "saldoInicial" BIGINT NOT NULL DEFAULT 0,
    "ultimos4" TEXT,
    "entidad" TEXT,
    "computaPatrimonio" BOOLEAN NOT NULL DEFAULT true,
    "visibleEnEspacio" BOOLEAN NOT NULL DEFAULT true,
    "archivadaEn" TIMESTAMP(3),
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadaEn" TIMESTAMP(3) NOT NULL,
    "borradaEn" TIMESTAMP(3),

    CONSTRAINT "cuentas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" TEXT NOT NULL,
    "espacioId" TEXT NOT NULL,
    "padreId" TEXT,
    "nombre" TEXT NOT NULL,
    "flujo" "FlujoCategoria" NOT NULL DEFAULT 'gasto',
    "tipo" "TipoCategoria" NOT NULL DEFAULT 'variable',
    "esencial" BOOLEAN NOT NULL DEFAULT false,
    "icono" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "borradaEn" TIMESTAMP(3),

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos" (
    "id" TEXT NOT NULL,
    "espacioId" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "categoriaId" TEXT,
    "importe" BIGINT NOT NULL,
    "divisa" TEXT NOT NULL DEFAULT 'EUR',
    "tipoCambio" DECIMAL(18,8) NOT NULL DEFAULT 1,
    "importeBase" BIGINT NOT NULL,
    "fecha" DATE NOT NULL,
    "concepto" TEXT NOT NULL,
    "comercio" TEXT,
    "notas" TEXT,
    "etiquetas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "estado" "EstadoMovimiento" NOT NULL DEFAULT 'confirmado',
    "esCompartido" BOOLEAN NOT NULL DEFAULT false,
    "repartoId" TEXT,
    "documentoId" TEXT,
    "reglaId" TEXT,
    "idExterno" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "borradoEn" TIMESTAMP(3),

    CONSTRAINT "movimientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reglas_recurrentes" (
    "id" TEXT NOT NULL,
    "espacioId" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "categoriaId" TEXT,
    "concepto" TEXT NOT NULL,
    "importe" BIGINT NOT NULL,
    "periodicidad" "Periodicidad" NOT NULL DEFAULT 'mensual',
    "diaDelMes" INTEGER,
    "ultimoDiaHabil" BOOLEAN NOT NULL DEFAULT false,
    "desde" DATE NOT NULL,
    "hasta" DATE,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "borradaEn" TIMESTAMP(3),

    CONSTRAINT "reglas_recurrentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reglas_categorizacion" (
    "id" TEXT NOT NULL,
    "espacioId" TEXT NOT NULL,
    "patron" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "aciertos" INTEGER NOT NULL DEFAULT 0,
    "automatica" BOOLEAN NOT NULL DEFAULT true,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reglas_categorizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos" (
    "id" TEXT NOT NULL,
    "espacioId" TEXT NOT NULL,
    "subidoPorId" TEXT NOT NULL,
    "nombreOriginal" TEXT NOT NULL,
    "rutaAlmacen" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamanoBytes" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "tipo" "TipoDocumento" NOT NULL DEFAULT 'desconocido',
    "estado" "EstadoDocumento" NOT NULL DEFAULT 'subido',
    "motivoTipo" TEXT,
    "error" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "procesadoEn" TIMESTAMP(3),
    "borradoEn" TIMESTAMP(3),

    CONSTRAINT "documentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extracciones" (
    "id" TEXT NOT NULL,
    "documentoId" TEXT NOT NULL,
    "campo" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "confianza" DECIMAL(4,3) NOT NULL DEFAULT 0,
    "pagina" INTEGER,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extracciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuentes_ingreso" (
    "id" TEXT NOT NULL,
    "espacioId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "naturaleza" "NaturalezaIngreso" NOT NULL DEFAULT 'nomina',
    "bruto" BIGINT NOT NULL DEFAULT 0,
    "retencion" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "neto" BIGINT NOT NULL DEFAULT 0,
    "periodicidad" "Periodicidad" NOT NULL DEFAULT 'mensual',
    "pagasAnuales" INTEGER NOT NULL DEFAULT 12,
    "variabilidad" "Variabilidad" NOT NULL DEFAULT 'fija',
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "borradaEn" TIMESTAMP(3),

    CONSTRAINT "fuentes_ingreso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_ingresos" (
    "id" TEXT NOT NULL,
    "fuenteId" TEXT NOT NULL,
    "mes" DATE NOT NULL,
    "neto" BIGINT NOT NULL,

    CONSTRAINT "historico_ingresos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nominas" (
    "id" TEXT NOT NULL,
    "fuenteId" TEXT NOT NULL,
    "documentoId" TEXT,
    "mes" DATE NOT NULL,
    "bruto" BIGINT NOT NULL,
    "cotizaciones" BIGINT NOT NULL DEFAULT 0,
    "irpf" BIGINT NOT NULL DEFAULT 0,
    "otrasDeducciones" BIGINT NOT NULL DEFAULT 0,
    "neto" BIGINT NOT NULL,
    "esPagaExtra" BOOLEAN NOT NULL DEFAULT false,
    "atrasos" BIGINT NOT NULL DEFAULT 0,
    "empresa" TEXT,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nominas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presupuestos" (
    "id" TEXT NOT NULL,
    "espacioId" TEXT NOT NULL,
    "mes" DATE NOT NULL,
    "metodo" "MetodoPresupuesto" NOT NULL DEFAULT 'sobres',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presupuestos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lineas_presupuesto" (
    "id" TEXT NOT NULL,
    "presupuestoId" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "asignado" BIGINT NOT NULL DEFAULT 0,
    "arrastrado" BIGINT NOT NULL DEFAULT 0,
    "rollover" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "lineas_presupuesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periodos_presupuesto" (
    "id" TEXT NOT NULL,
    "espacioId" TEXT NOT NULL,
    "mes" DATE NOT NULL,
    "ingresosReales" BIGINT NOT NULL DEFAULT 0,
    "gastosReales" BIGINT NOT NULL DEFAULT 0,
    "ahorroReal" BIGINT NOT NULL DEFAULT 0,
    "previstoTotal" BIGINT NOT NULL DEFAULT 0,
    "cerradoEn" TIMESTAMP(3),
    "resumen" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "periodos_presupuesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deudas" (
    "id" TEXT NOT NULL,
    "espacioId" TEXT NOT NULL,
    "cuentaId" TEXT,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoDeuda" NOT NULL,
    "entidad" TEXT,
    "principalOriginal" BIGINT NOT NULL,
    "saldoPendiente" BIGINT NOT NULL,
    "tin" DECIMAL(7,4) NOT NULL,
    "tae" DECIMAL(7,4),
    "plazoMeses" INTEGER NOT NULL,
    "cuota" BIGINT NOT NULL,
    "sistema" "SistemaAmortizacion" NOT NULL DEFAULT 'frances',
    "fechaPrimerPago" DATE NOT NULL,
    "diaDePago" INTEGER NOT NULL DEFAULT 1,
    "tipoVariable" BOOLEAN NOT NULL DEFAULT false,
    "diferencial" DECIMAL(7,4),
    "revisionMeses" INTEGER,
    "comisionAmortizacion" DECIMAL(5,3) NOT NULL DEFAULT 0,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liquidadaEn" TIMESTAMP(3),
    "borradaEn" TIMESTAMP(3),

    CONSTRAINT "deudas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuadro_amortizacion" (
    "id" TEXT NOT NULL,
    "deudaId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "cuota" BIGINT NOT NULL,
    "interes" BIGINT NOT NULL,
    "capital" BIGINT NOT NULL,
    "saldoVivo" BIGINT NOT NULL,
    "pagadaEn" TIMESTAMP(3),

    CONSTRAINT "cuadro_amortizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "amortizaciones_extra" (
    "id" TEXT NOT NULL,
    "deudaId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "importe" BIGINT NOT NULL,
    "reducePlazo" BOOLEAN NOT NULL DEFAULT true,
    "comision" BIGINT NOT NULL DEFAULT 0,
    "interesAhorrado" BIGINT NOT NULL DEFAULT 0,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "amortizaciones_extra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarjetas" (
    "id" TEXT NOT NULL,
    "espacioId" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "ultimos4" TEXT,
    "limite" BIGINT NOT NULL,
    "diaCorte" INTEGER NOT NULL,
    "diaPago" INTEGER NOT NULL,
    "modalidad" "ModalidadTarjeta" NOT NULL DEFAULT 'pago_total',
    "tin" DECIMAL(7,4),
    "minimoPorcentaje" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "minimoSuelo" BIGINT NOT NULL DEFAULT 0,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "borradaEn" TIMESTAMP(3),

    CONSTRAINT "tarjetas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ciclos_tarjeta" (
    "id" TEXT NOT NULL,
    "tarjetaId" TEXT NOT NULL,
    "desde" DATE NOT NULL,
    "hasta" DATE NOT NULL,
    "fechaPago" DATE NOT NULL,
    "consumido" BIGINT NOT NULL DEFAULT 0,
    "pagado" BIGINT NOT NULL DEFAULT 0,
    "interesAplicado" BIGINT NOT NULL DEFAULT 0,
    "cerrado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ciclos_tarjeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuentas_inversion" (
    "id" TEXT NOT NULL,
    "espacioId" TEXT NOT NULL,
    "cuentaId" TEXT,
    "nombre" TEXT NOT NULL,
    "broker" TEXT,
    "tipo" "TipoCuentaInversion" NOT NULL DEFAULT 'broker',
    "divisa" TEXT NOT NULL DEFAULT 'EUR',
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "borradaEn" TIMESTAMP(3),

    CONSTRAINT "cuentas_inversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posiciones" (
    "id" TEXT NOT NULL,
    "cuentaInversionId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "isin" TEXT,
    "ticker" TEXT,
    "clase" "ClaseActivo" NOT NULL DEFAULT 'renta_variable',
    "region" TEXT,
    "divisa" TEXT NOT NULL DEFAULT 'EUR',
    "participaciones" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "costeMedio" BIGINT NOT NULL DEFAULT 0,
    "ultimoPrecio" BIGINT,
    "fechaValoracion" TIMESTAMP(3),
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "borradaEn" TIMESTAMP(3),

    CONSTRAINT "posiciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_inversion" (
    "id" TEXT NOT NULL,
    "posicionId" TEXT NOT NULL,
    "tipo" "TipoMovimientoInversion" NOT NULL,
    "fecha" DATE NOT NULL,
    "participaciones" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "importe" BIGINT NOT NULL,
    "comision" BIGINT NOT NULL DEFAULT 0,
    "divisa" TEXT NOT NULL DEFAULT 'EUR',
    "tipoCambio" DECIMAL(18,8) NOT NULL DEFAULT 1,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_inversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objetivos_asignacion" (
    "id" TEXT NOT NULL,
    "espacioId" TEXT NOT NULL,
    "clase" "ClaseActivo" NOT NULL,
    "objetivo" DECIMAL(5,2) NOT NULL,
    "umbral" DECIMAL(5,2) NOT NULL DEFAULT 5,

    CONSTRAINT "objetivos_asignacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repartos" (
    "id" TEXT NOT NULL,
    "espacioId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoReparto" NOT NULL DEFAULT 'proporcional_ingresos',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "borradoEn" TIMESTAMP(3),

    CONSTRAINT "repartos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partes_reparto" (
    "id" TEXT NOT NULL,
    "repartoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "porcentaje" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "importeFijo" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "partes_reparto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidaciones" (
    "id" TEXT NOT NULL,
    "espacioId" TEXT NOT NULL,
    "desde" DATE NOT NULL,
    "hasta" DATE NOT NULL,
    "estado" "EstadoLiquidacion" NOT NULL DEFAULT 'pendiente',
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "saldadaEn" TIMESTAMP(3),

    CONSTRAINT "liquidaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos_liquidacion" (
    "id" TEXT NOT NULL,
    "liquidacionId" TEXT NOT NULL,
    "deUsuarioId" TEXT NOT NULL,
    "aUsuarioId" TEXT NOT NULL,
    "importe" BIGINT NOT NULL,
    "pagadoEn" TIMESTAMP(3),

    CONSTRAINT "pagos_liquidacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_capital" (
    "id" TEXT NOT NULL,
    "espacioId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" "TipoMovimientoCapital" NOT NULL,
    "importe" BIGINT NOT NULL,
    "fecha" DATE NOT NULL,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_capital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fotos_patrimonio" (
    "id" TEXT NOT NULL,
    "espacioId" TEXT NOT NULL,
    "mes" DATE NOT NULL,
    "activos" BIGINT NOT NULL,
    "pasivos" BIGINT NOT NULL,
    "patrimonioNeto" BIGINT NOT NULL,
    "desglose" JSONB NOT NULL DEFAULT '{}',
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fotos_patrimonio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licencias" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "plan" "PlanLicencia" NOT NULL DEFAULT 'prueba',
    "estado" "EstadoLicencia" NOT NULL DEFAULT 'activa',
    "titular" TEXT,
    "email" TEXT,
    "emitidaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "caducaEn" TIMESTAMP(3),
    "maxUsuarios" INTEGER NOT NULL DEFAULT 2,
    "notas" TEXT,

    CONSTRAINT "licencias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_borradoEn_idx" ON "usuarios"("borradoEn");

-- CreateIndex
CREATE UNIQUE INDEX "sesiones_hashToken_key" ON "sesiones"("hashToken");

-- CreateIndex
CREATE INDEX "sesiones_usuarioId_idx" ON "sesiones"("usuarioId");

-- CreateIndex
CREATE INDEX "sesiones_expiraEn_idx" ON "sesiones"("expiraEn");

-- CreateIndex
CREATE INDEX "espacios_borradoEn_idx" ON "espacios"("borradoEn");

-- CreateIndex
CREATE INDEX "miembros_espacio_usuarioId_idx" ON "miembros_espacio"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "miembros_espacio_espacioId_usuarioId_key" ON "miembros_espacio"("espacioId", "usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "invitaciones_hashToken_key" ON "invitaciones"("hashToken");

-- CreateIndex
CREATE INDEX "invitaciones_espacioId_idx" ON "invitaciones"("espacioId");

-- CreateIndex
CREATE INDEX "registro_actividad_espacioId_creadoEn_idx" ON "registro_actividad"("espacioId", "creadoEn");

-- CreateIndex
CREATE INDEX "cuentas_espacioId_borradaEn_idx" ON "cuentas"("espacioId", "borradaEn");

-- CreateIndex
CREATE INDEX "categorias_espacioId_borradaEn_idx" ON "categorias"("espacioId", "borradaEn");

-- CreateIndex
CREATE INDEX "categorias_padreId_idx" ON "categorias"("padreId");

-- CreateIndex
CREATE INDEX "movimientos_espacioId_fecha_idx" ON "movimientos"("espacioId", "fecha");

-- CreateIndex
CREATE INDEX "movimientos_espacioId_categoriaId_idx" ON "movimientos"("espacioId", "categoriaId");

-- CreateIndex
CREATE INDEX "movimientos_cuentaId_fecha_idx" ON "movimientos"("cuentaId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "movimientos_cuentaId_idExterno_key" ON "movimientos"("cuentaId", "idExterno");

-- CreateIndex
CREATE INDEX "reglas_recurrentes_espacioId_activa_idx" ON "reglas_recurrentes"("espacioId", "activa");

-- CreateIndex
CREATE INDEX "reglas_categorizacion_espacioId_idx" ON "reglas_categorizacion"("espacioId");

-- CreateIndex
CREATE INDEX "documentos_espacioId_estado_idx" ON "documentos"("espacioId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "documentos_espacioId_hash_key" ON "documentos"("espacioId", "hash");

-- CreateIndex
CREATE INDEX "extracciones_documentoId_idx" ON "extracciones"("documentoId");

-- CreateIndex
CREATE INDEX "fuentes_ingreso_espacioId_borradaEn_idx" ON "fuentes_ingreso"("espacioId", "borradaEn");

-- CreateIndex
CREATE UNIQUE INDEX "historico_ingresos_fuenteId_mes_key" ON "historico_ingresos"("fuenteId", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "nominas_fuenteId_mes_esPagaExtra_key" ON "nominas"("fuenteId", "mes", "esPagaExtra");

-- CreateIndex
CREATE UNIQUE INDEX "presupuestos_espacioId_mes_key" ON "presupuestos"("espacioId", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "lineas_presupuesto_presupuestoId_categoriaId_key" ON "lineas_presupuesto"("presupuestoId", "categoriaId");

-- CreateIndex
CREATE UNIQUE INDEX "periodos_presupuesto_espacioId_mes_key" ON "periodos_presupuesto"("espacioId", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "deudas_cuentaId_key" ON "deudas"("cuentaId");

-- CreateIndex
CREATE INDEX "deudas_espacioId_borradaEn_idx" ON "deudas"("espacioId", "borradaEn");

-- CreateIndex
CREATE UNIQUE INDEX "cuadro_amortizacion_deudaId_numero_key" ON "cuadro_amortizacion"("deudaId", "numero");

-- CreateIndex
CREATE INDEX "amortizaciones_extra_deudaId_idx" ON "amortizaciones_extra"("deudaId");

-- CreateIndex
CREATE UNIQUE INDEX "tarjetas_cuentaId_key" ON "tarjetas"("cuentaId");

-- CreateIndex
CREATE INDEX "tarjetas_espacioId_borradaEn_idx" ON "tarjetas"("espacioId", "borradaEn");

-- CreateIndex
CREATE UNIQUE INDEX "ciclos_tarjeta_tarjetaId_desde_key" ON "ciclos_tarjeta"("tarjetaId", "desde");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_inversion_cuentaId_key" ON "cuentas_inversion"("cuentaId");

-- CreateIndex
CREATE INDEX "cuentas_inversion_espacioId_borradaEn_idx" ON "cuentas_inversion"("espacioId", "borradaEn");

-- CreateIndex
CREATE INDEX "posiciones_cuentaInversionId_borradaEn_idx" ON "posiciones"("cuentaInversionId", "borradaEn");

-- CreateIndex
CREATE INDEX "movimientos_inversion_posicionId_fecha_idx" ON "movimientos_inversion"("posicionId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "objetivos_asignacion_espacioId_clase_key" ON "objetivos_asignacion"("espacioId", "clase");

-- CreateIndex
CREATE INDEX "repartos_espacioId_idx" ON "repartos"("espacioId");

-- CreateIndex
CREATE UNIQUE INDEX "partes_reparto_repartoId_usuarioId_key" ON "partes_reparto"("repartoId", "usuarioId");

-- CreateIndex
CREATE INDEX "liquidaciones_espacioId_estado_idx" ON "liquidaciones"("espacioId", "estado");

-- CreateIndex
CREATE INDEX "pagos_liquidacion_liquidacionId_idx" ON "pagos_liquidacion"("liquidacionId");

-- CreateIndex
CREATE INDEX "movimientos_capital_espacioId_fecha_idx" ON "movimientos_capital"("espacioId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "fotos_patrimonio_espacioId_mes_key" ON "fotos_patrimonio"("espacioId", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "licencias_clave_key" ON "licencias"("clave");

-- AddForeignKey
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "miembros_espacio" ADD CONSTRAINT "miembros_espacio_espacioId_fkey" FOREIGN KEY ("espacioId") REFERENCES "espacios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "miembros_espacio" ADD CONSTRAINT "miembros_espacio_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitaciones" ADD CONSTRAINT "invitaciones_espacioId_fkey" FOREIGN KEY ("espacioId") REFERENCES "espacios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitaciones" ADD CONSTRAINT "invitaciones_invitadaPorId_fkey" FOREIGN KEY ("invitadaPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_actividad" ADD CONSTRAINT "registro_actividad_espacioId_fkey" FOREIGN KEY ("espacioId") REFERENCES "espacios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_actividad" ADD CONSTRAINT "registro_actividad_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas" ADD CONSTRAINT "cuentas_espacioId_fkey" FOREIGN KEY ("espacioId") REFERENCES "espacios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas" ADD CONSTRAINT "cuentas_propietarioId_fkey" FOREIGN KEY ("propietarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_espacioId_fkey" FOREIGN KEY ("espacioId") REFERENCES "espacios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_padreId_fkey" FOREIGN KEY ("padreId") REFERENCES "categorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_espacioId_fkey" FOREIGN KEY ("espacioId") REFERENCES "espacios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_repartoId_fkey" FOREIGN KEY ("repartoId") REFERENCES "repartos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "documentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_reglaId_fkey" FOREIGN KEY ("reglaId") REFERENCES "reglas_recurrentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reglas_recurrentes" ADD CONSTRAINT "reglas_recurrentes_espacioId_fkey" FOREIGN KEY ("espacioId") REFERENCES "espacios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reglas_recurrentes" ADD CONSTRAINT "reglas_recurrentes_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reglas_recurrentes" ADD CONSTRAINT "reglas_recurrentes_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reglas_categorizacion" ADD CONSTRAINT "reglas_categorizacion_espacioId_fkey" FOREIGN KEY ("espacioId") REFERENCES "espacios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reglas_categorizacion" ADD CONSTRAINT "reglas_categorizacion_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_espacioId_fkey" FOREIGN KEY ("espacioId") REFERENCES "espacios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_subidoPorId_fkey" FOREIGN KEY ("subidoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracciones" ADD CONSTRAINT "extracciones_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "documentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuentes_ingreso" ADD CONSTRAINT "fuentes_ingreso_espacioId_fkey" FOREIGN KEY ("espacioId") REFERENCES "espacios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_ingresos" ADD CONSTRAINT "historico_ingresos_fuenteId_fkey" FOREIGN KEY ("fuenteId") REFERENCES "fuentes_ingreso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nominas" ADD CONSTRAINT "nominas_fuenteId_fkey" FOREIGN KEY ("fuenteId") REFERENCES "fuentes_ingreso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nominas" ADD CONSTRAINT "nominas_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "documentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presupuestos" ADD CONSTRAINT "presupuestos_espacioId_fkey" FOREIGN KEY ("espacioId") REFERENCES "espacios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lineas_presupuesto" ADD CONSTRAINT "lineas_presupuesto_presupuestoId_fkey" FOREIGN KEY ("presupuestoId") REFERENCES "presupuestos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lineas_presupuesto" ADD CONSTRAINT "lineas_presupuesto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodos_presupuesto" ADD CONSTRAINT "periodos_presupuesto_espacioId_fkey" FOREIGN KEY ("espacioId") REFERENCES "espacios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deudas" ADD CONSTRAINT "deudas_espacioId_fkey" FOREIGN KEY ("espacioId") REFERENCES "espacios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deudas" ADD CONSTRAINT "deudas_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "cuentas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuadro_amortizacion" ADD CONSTRAINT "cuadro_amortizacion_deudaId_fkey" FOREIGN KEY ("deudaId") REFERENCES "deudas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amortizaciones_extra" ADD CONSTRAINT "amortizaciones_extra_deudaId_fkey" FOREIGN KEY ("deudaId") REFERENCES "deudas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarjetas" ADD CONSTRAINT "tarjetas_espacioId_fkey" FOREIGN KEY ("espacioId") REFERENCES "espacios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarjetas" ADD CONSTRAINT "tarjetas_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ciclos_tarjeta" ADD CONSTRAINT "ciclos_tarjeta_tarjetaId_fkey" FOREIGN KEY ("tarjetaId") REFERENCES "tarjetas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_inversion" ADD CONSTRAINT "cuentas_inversion_espacioId_fkey" FOREIGN KEY ("espacioId") REFERENCES "espacios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_inversion" ADD CONSTRAINT "cuentas_inversion_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "cuentas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posiciones" ADD CONSTRAINT "posiciones_cuentaInversionId_fkey" FOREIGN KEY ("cuentaInversionId") REFERENCES "cuentas_inversion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inversion" ADD CONSTRAINT "movimientos_inversion_posicionId_fkey" FOREIGN KEY ("posicionId") REFERENCES "posiciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objetivos_asignacion" ADD CONSTRAINT "objetivos_asignacion_espacioId_fkey" FOREIGN KEY ("espacioId") REFERENCES "espacios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repartos" ADD CONSTRAINT "repartos_espacioId_fkey" FOREIGN KEY ("espacioId") REFERENCES "espacios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partes_reparto" ADD CONSTRAINT "partes_reparto_repartoId_fkey" FOREIGN KEY ("repartoId") REFERENCES "repartos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidaciones" ADD CONSTRAINT "liquidaciones_espacioId_fkey" FOREIGN KEY ("espacioId") REFERENCES "espacios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_liquidacion" ADD CONSTRAINT "pagos_liquidacion_liquidacionId_fkey" FOREIGN KEY ("liquidacionId") REFERENCES "liquidaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_capital" ADD CONSTRAINT "movimientos_capital_espacioId_fkey" FOREIGN KEY ("espacioId") REFERENCES "espacios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos_patrimonio" ADD CONSTRAINT "fotos_patrimonio_espacioId_fkey" FOREIGN KEY ("espacioId") REFERENCES "espacios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
