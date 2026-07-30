# Gestión Financiera Integral

Aplicación web (español, PWA offline-first) de gestión financiera para una S.L. de
retail con múltiples puntos de venta. Arquitectura **client-first**: todo el motor
contable en TypeScript puro y testeado, datos en IndexedDB, desplegable como estático.

> Vive en `finanzas/` dentro del repo `clauderoutine`. **No comparte código ni
> despliegue con la app de vóley ni con la de gestión laboral**, que siguen intactas.

## Comandos
```bash
cd finanzas
npm install
npm run dev      # desarrollo (http://localhost:5173)
npm test         # tests del motor (Vitest)
npm run build    # tsc -b && vite build
npm run preview  # previsualizar producción / PWA
```

## Estado — Fase 0 (cimientos) ✅
- Motor puro en `src/dominio/` con tests: `dinero` (aritmética en céntimos, sin float),
  `parseo-es` (heurística de millar: `180.000` = ciento ochenta mil), `iva` (base/cuota/total
  en cualquier dirección, exento/no sujeto/ISP), `partida-doble` (detección de descuadre).
- Configuración por defecto (PGC, tipos de IVA, calendario fiscal 303/111/115/200/202/347/573,
  impuesto especial de vapeo por ml y límite de pago en efectivo) **verificada y editable,
  nunca hardcodeada** en la lógica.
- Shell: tokens de diseño, modo claro/oscuro, layout responsive con navegación a los 13
  módulos, estados vacíos cuidados, esqueletos de carga y persistencia en IndexedDB.

## Arquitectura
- `src/dominio/` — motor contable en TS puro, sin React (testeable en aislamiento).
- `src/lib/` — persistencia (IndexedDB), router hash, registro de módulos.
- `src/store/` — estado global (Zustand) + persistencia con debounce.
- `src/componentes/` — UI reutilizable. `src/pantallas/` — pantallas por módulo.

## Roadmap
Fase 1 Configuración · 2 Ventas+Compras · 3 Caja+Bancos · 4 Stock · 5 Importación ·
6 Deudas+Deudores · 7 Presupuesto+Tesorería · 8 Dashboard · 9 Informes · 10 Copias ·
11 Conectores (Square, banca) · 12 Pulido. Ver `../PLAN_APP_FINANCIERA.md`.
