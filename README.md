# 🏐 Gestor de Torneos de Vóley Playa

Aplicación web **responsive** y **offline-first (PWA)** para gestionar cuadros de
competición de torneos deportivos, especialmente de vóley playa. Permite crear
torneos de **8, 16 o 32 equipos**, con **fase de grupos** previa y **fase final
eliminatoria**, gestionando **varias categorías simultáneamente** (p. ej. SUB-17
y SÉNIOR) de forma totalmente independiente.

La interfaz está **en español**, con una estética limpia y minimalista inspirada
en el estilo de Apple, **modo claro y oscuro**, y funciona **sin conexión**
guardando los datos en el dispositivo (IndexedDB).

---

## ✨ Funcionalidades principales

- **Torneos y categorías**: varias categorías por torneo, cada una con su propio
  formato (8/16/32), color, equipos, grupos, resultados y cuadro. Añadir nuevas
  categorías (SUB-10, veteranos, mixto…) no afecta al resto.
- **Equipos y jugadores**: alta manual, **importar/exportar CSV**, cabezas de
  serie, estado de inscripción, importe pagado, teléfono y observaciones.
- **Sorteo de grupos**: automático o manual, con cabezas de serie repartidas y
  posibilidad de **impedir que dos equipos coincidan** en el mismo grupo.
- **Liga de grupos**: calendario round-robin generado automáticamente.
- **Clasificación automática** con criterios de desempate **reordenables**:
  partidos ganados → dif. de sets → sets a favor → dif. de puntos → puntos a
  favor → **enfrentamiento directo** (mini-liga entre empatados) → decisión
  manual. Avisa de los empates que los criterios no resuelven.
- **Cuadro eliminatorio** (octavos/cuartos/semifinales/3.º puesto/final) generado
  con siembra que **evita cruces del mismo grupo** antes de la final. Se
  **actualiza automáticamente** al guardar cada resultado y determina el campeón.
- **Resultados**: sets al mejor de 3 o a un set, puntos configurables, diferencia
  de 2 puntos, estados (pendiente/en juego/finalizado/aplazado/cancelado).
  Al **corregir** un resultado de una ronda avanzada, avisa si afecta a cruces
  posteriores.
- **Horarios y pistas**: generador que asigna pistas y horas evitando que un
  equipo juegue dos partidos a la vez, con descanso mínimo, edición manual y
  **detección de conflictos**. **Vista general** de todas las categorías por hora
  y pista.
- **Roles**: **Administrador** (edición completa) y **Vista pública** (solo
  lectura) compartible por **enlace y código QR**.
- **Exportación**: PDF de equipos, grupos, horario, hoja de resultados,
  clasificaciones, cuadro e **informe completo**; **impresión A4** optimizada;
  exportación **CSV**.
- **Copia de seguridad**: exportar/restaurar todos los datos en **JSON**.
- **PWA**: instalable y funcional sin conexión.
- **Datos de demostración** para torneos de 8, 16 y 32 equipos.

---

## 🚀 Instalación y uso

Requisitos: **Node.js 20+**.

```bash
# 1. Instalar dependencias
npm install

# 2. Arrancar en modo desarrollo
npm run dev
# Abre la URL que aparece (por defecto http://localhost:5173)

# 3. Ejecutar las pruebas unitarias
npm test

# 4. Compilar para producción
npm run build

# 5. Previsualizar la versión de producción (PWA)
npm run preview
```

### Primeros pasos
1. En el **Panel principal**, pulsa **«Cargar demo»** para ver un torneo completo,
   o **«Crear torneo»** para empezar de cero.
2. En **Categorías**, define SUB-17 / SÉNIOR (u otras) y su número de equipos.
3. En **Equipos**, añade o importa los equipos (CSV).
4. En **Sorteo y grupos**, genera los grupos.
5. En **Resultados**, introduce los marcadores: la clasificación y el cuadro se
   actualizan solos.
6. En **Calendario**, genera y ajusta los horarios.
7. Comparte la **Vista pública** por enlace/QR y exporta en **PDF/CSV**.

---

## 🧱 Arquitectura y modelo de datos

```
Torneo
 ├── ScheduleConfig (horarios, pistas)
 └── Categoría[]            (SUB-17, SÉNIOR, …)  ← independientes entre sí
      ├── CompetitionConfig (formato, puntos, desempates…)
      ├── Team[]            (equipos + jugadores)
      ├── Group[]           (grupos y sus equipos)
      ├── Match[]           (grupos + eliminatoria, con enlaces de avance)
      └── manualTiebreaks   (desempates manuales)
```

- **Motor de cálculo en TypeScript puro**, separado de la interfaz, en
  [`src/engine/`](src/engine/):
  - `standings.ts` — clasificación y desempates (partición jerárquica con
    mini-liga de enfrentamiento directo, correcta ante empates cíclicos).
  - `groups.ts` / `fixtures.ts` — sorteo y liga round-robin.
  - `bracket.ts` — generación y resolución del cuadro (8/16/32).
  - `schedule.ts` — horarios y detección de conflictos.
  - `match.ts` — cómputo y validación de resultados.
- **Persistencia** offline en IndexedDB (con respaldo en localStorage) —
  [`src/lib/persist.ts`](src/lib/persist.ts).
- **Estado** con Zustand — [`src/store/store.ts`](src/store/store.ts).
- **Interfaz** React + Tailwind CSS v4, componentes reutilizables en
  [`src/components/`](src/components/) y pantallas en
  [`src/screens/`](src/screens/).

### ¿Por qué Vite en lugar de Next.js + Prisma?
El enunciado recomienda Next.js/Prisma/SQLite pero permite alternativas
justificadas. El requisito central es **funcionar sin conexión y no perder
resultados**. Una arquitectura **100 % en cliente con IndexedDB** cumple ese
objetivo de forma más robusta que un servidor con base de datos, se despliega
como **PWA estática** en cualquier hosting y no necesita backend. El motor de
cálculo queda aislado en TypeScript puro, por lo que añadir en el futuro una
capa de **sincronización remota** (PostgreSQL) no requeriría reescribir la
lógica. Se mantienen el resto de tecnologías recomendadas (React, TypeScript,
Tailwind, Zod-like validación en el motor, PWA + IndexedDB, librería de PDF).

---

## 🧪 Pruebas

`npm test` ejecuta pruebas unitarias (Vitest) sobre el motor:

- Clasificaciones y **todos los criterios de desempate**, incluidos empates
  cíclicos de 3 equipos y desempate manual.
- Cómputo y **validación de resultados** (mejor de 3 / a un set, diferencia de 2).
- **Generación de cruces** para 8/16/32 y verificación de que no se cruzan
  equipos del mismo grupo antes de la final; propagación de ganadores hasta el
  campeón.
- **Sorteo** (reparto equilibrado, cabezas de serie, restricciones) y **round-robin**.
- **Horarios** y **detección de conflictos** (pista, equipo, descanso).

---

## 🎨 Diseño y accesibilidad
- Fuente **Inter / SF Pro** (con la tipografía del sistema Apple como base legal
  por defecto, sin dependencias externas para funcionar offline).
- Tarjetas con esquinas redondeadas, sombras discretas y mucho espacio en blanco.
- Color principal azul y **un color por categoría**.
- Tipografía grande y legible, pensada para buena accesibilidad.
- **Responsive** (ordenador, tablet y móvil), con el cuadro desplazable en
  horizontal y una vista de impresión **A4** simplificada.

---

## ✅ Estado de las funciones

**Terminadas y funcionales**
- Torneos y categorías múltiples e independientes (formatos 8/16/32).
- Equipos/jugadores con import/export CSV.
- Sorteo (auto/manual, cabezas de serie, restricciones) y grupos.
- Clasificación automática con desempates reordenables y avisos.
- Cuadro eliminatorio automático con campeón y 3.º puesto.
- Introducción y corrección de resultados con recálculo y avisos.
- Generador de horarios con pistas, conflictos y vista general multi-categoría.
- Roles admin/público + compartir por enlace y QR.
- Exportación PDF/CSV, impresión A4, copia/restauración JSON.
- PWA offline + datos de demostración (8/16/32).
- Pruebas unitarias del motor.

**Mejoras pendientes / posibles ampliaciones**
- **Arrastrar y soltar** en el calendario (actualmente edición mediante
  selectores de pista/hora, que es plenamente funcional).
- **Clasificación de mejores terceros** en el cuadro: configurable en la interfaz;
  la siembra automática de terceros en el bracket queda como ampliación (el
  formato predeterminado clasifica a los 2 primeros de cada grupo).
- **Sincronización remota** (PostgreSQL) para compartir datos entre dispositivos
  en tiempo real; hoy se comparte por copia JSON o enlace en el mismo dispositivo.
- Exportación a **.xlsx** nativo (actualmente CSV compatible con Excel).

---

## 📄 Licencia
Proyecto de ejemplo. Úsalo y adáptalo libremente.
