# Asignación y Supervisión — mapea a servicio Asignación (arquitectura nueva)

## Casos de uso y requerimientos que cubre

- **CU-01** Gestión de pipeline (Vendedor): vista unificada del embudo por etapa, priorización de gestiones activas.
- **CU-07** Vista de supervisor (Supervisor): actividad desagregada por vendedor, recordatorios no gestionados, consolidado de actividades.
- **CU-08** Reasignación de cartera (Supervisor): transferencia de contactos y solicitudes de un vendedor a otro ante licencia o baja.
- **RF-15** Asignación automática de leads por reglas de sucursal, puntaje y disponibilidad, con posibilidad de reasignación manual.
- **RF-18** Vista de supervisor con actividad desagregada por vendedor y reporte de recordatorios no gestionados.
- **RF-19** Reasignación de cartera entre vendedores, con trazabilidad de la operación.

## Qué hace hoy (comportamiento actual)

### Modelo de propiedad de datos

No existe un concepto de "asignación" como entidad o evento independiente. La propiedad de un registro es simplemente el campo `userId` (string, ID de Mongo del `User`) presente en `Lead`, `Deal` y `Activity` (`src/models/Lead.ts`, `src/models/Deal.ts`, `src/models/Activity.ts`). Quien crea el registro —o a quien se le asigna manualmente el `userId`— es su dueño. No hay tabla/colección de asignaciones, historial de propietarios, ni relación formal entre `Lead.userId` y los `userId` de sus `Deal`/`Activity` asociados (son campos independientes que hoy en la práctica siempre coinciden, pero nada en el modelo lo garantiza).

### Alta y asignación inicial de un lead (contact page / carga manual)

Cuando un vendedor (`user`) crea un contacto desde `/contacts`, el lead nace con `userId` = el propio vendedor (ver `useContacts.ts`). No hay paso de "asignación": el creador es automáticamente el dueño. No hay reglas de sucursal, puntaje ni disponibilidad involucradas.

### Carga e ingreso de prospectos por Supervisor (CSV)

`importProspectsFromCSV` en `src/app/actions/supervisor.ts` (invocada desde la pestaña "Cargar Prospectos" de `src/components/SupervisorDashboard.tsx`):
- Valida rol de supervisor (`getSupervisorIdOrThrow`).
- Por cada fila: valida campos obligatorios (DNI, nombre, apellido, email), formato de email/teléfono/cédula paraguaya.
- Verifica duplicados por `documentIdHash` o `emailHash` contra leads no eliminados (`deleted: { $ne: true }`) en toda la base, sin filtrar por vendedor/supervisor.
- Si no hay duplicado, crea el `Lead` con `userId: supervisorId` (es decir, el supervisor queda como dueño temporal del prospecto, no hay owner "sin asignar" explícito) y `crmSynced: false`.
- No hay ninguna regla de ruteo automático hacia un vendedor específico en este paso — todo prospecto importado queda en poder del supervisor que lo cargó, a la espera de asignación manual.

### Asignación manual de un prospecto a un vendedor (pestaña "Asignar Contactos")

`assignLeadToSalesperson(leadId, salespersonId)` en `src/app/actions/supervisor.ts`:
1. Valida rol de supervisor.
2. Valida que `salespersonId` pertenezca al equipo del supervisor (`User.findOne({ _id: salespersonId, supervisorId, roles: 'user' })`).
3. Valida que el lead le pertenezca actualmente al supervisor (`Lead.findOne({ _id: leadId, userId: supervisorId, deleted: { $ne: true } })`) — si el lead ya tiene otro dueño (ej. ya está en manos de un vendedor), la operación falla con "El lead no pertenece a tus prospectos o ya fue asignado".
4. Cambia `lead.userId = salespersonId` y marca `lead.crmSynced = false` para que el motor de sincronización outbound (`sync-engine.ts`) actualice el `hubspot_owner_id` en HubSpot usando el `crmOwnerId` del vendedor.

Este es el único mecanismo de "asignación" que existe hoy, y es 100% manual desde la UI de supervisor, uno por uno (no hay asignación masiva ni por lote). Solo aplica a leads que hoy son propiedad del supervisor (prospectos recién importados o creados por él); **no** es un mecanismo de transferencia de un vendedor activo a otro.

### Jerarquía organizacional (Admin)

`src/models/User.ts` define:
- `roles: ('admin' | 'supervisor' | 'user')[]` (multi-rol; existe también un campo legado `role` singular que se está migrando).
- `supervisorId?: string` — referencia plana (no populada, no indexada con `ref`) al `_id` del supervisor de un vendedor.
- `disbursementGoal?: number` — meta de desembolso, propia del supervisor.
- No hay campo de sucursal/branch/zona/oficina en ningún lado del modelo (`User`, `Lead`, `Deal`) — confirmado por búsqueda en todo `src/`.

`src/app/actions/admin.ts` expone (solo rol `admin`):
- `getAdminUserData()`: lista todos los usuarios con su supervisor resuelto por nombre (join manual en memoria, sin `.populate()`).
- `updateUserRoles(userId, roles)`: cambia los roles de un usuario. Si deja de ser `supervisor`, limpia `supervisorId` de todos sus vendedores (`$unset`). Si deja de ser `user`, limpia su propio `supervisorId`.
- `assignSalespeopleToSupervisor(supervisorId, salespeopleIds[])`: asignación masiva N-a-1 de vendedores a un supervisor — set/unset de `supervisorId` en `User`, no toca `Lead`/`Deal`. Esto es jerarquía organizacional (quién reporta a quién), no asignación de cartera de clientes.

La UI está en `src/app/(dashboard)/admin/page.tsx` + `src/hooks/useAdmin.ts`: tabla de usuarios con checkboxes de rol, y panel de asignación vendedor→supervisor con selección múltiple.

### Vista de supervisor (dashboard)

`getSupervisorDashboardData()` en `src/app/actions/supervisor.ts`, consumida por `SupervisorDashboard.tsx` (se renderiza automáticamente en `/` cuando `session.user.roles.includes('supervisor')`, ver `src/app/(dashboard)/page.tsx`):
- Trae todos los vendedores con `supervisorId` = el supervisor logueado.
- Trae todos los `Deal` de esos vendedores (`userId: { $in: salespeopleIds }`) y calcula: total desembolsado (`stage` en `disbursed`/`completed`), total de operaciones, cantidad en aprobación (`under_evaluation`/`approved`).
- Desagrega esas mismas métricas por vendedor (`salespeoplePerformance`): nombre, email, `crmOwnerId`, desembolsado, deals totales, deals pendientes.
- Trae los prospectos del propio supervisor (`Lead.userId === supervisorId`) pendientes de asignar.
- Polling cada 15s desde el cliente (mismo patrón que `useSync`).

Esto cubre parcialmente CU-07/RF-18 (actividad desagregada por vendedor, pero solo en términos de **deals**, no de actividades/gestiones ni de recordatorios).

### "Recordatorios no gestionados" — no existe hoy

Los recordatorios (`Activity.reminderDate` / `reminderStatus`) son una feature enteramente client-side:
- `useNotifications.ts` lee actividades **del propio usuario logueado** desde Dexie (`localDb.activities.where('userId').equals(userId)`), las traduce a `notifications` locales y dispara `Notification` del navegador cuando vencen.
- Todo vive en IndexedDB del dispositivo del vendedor; no hay colección de notificaciones en MongoDB, ni agregación de recordatorios vencidos/no gestionados por vendedor a nivel servidor.
- El supervisor no tiene ninguna vista de recordatorios pendientes o vencidos de su equipo — ese dato ni siquiera es accesible desde el servidor porque las notificaciones no se sincronizan (solo las `Activity` originales sí se sincronizan vía `pushClientChanges`/`pullServerUpdates`, pero sin el concepto de "vencido/no gestionado" calculado).

### Pipeline / priorización de gestiones (vendedor)

`src/hooks/useDashboard.ts` + `src/app/(dashboard)/page.tsx` calculan, para el vendedor logueado, conteos de leads por bucket de embudo (Nuevos / En Proceso / Aprobados / Rechazados) a partir de sus propios `Deal.stage`, y porcentajes sobre el total. No hay ordenamiento ni "priorización" real de gestiones activas (por urgencia de recordatorio, antigüedad, scoring, etc.) — es una vista puramente descriptiva/estática, sin lógica de ranking.

## Reglas de negocio y validaciones

- Solo `supervisor` puede: ver dashboard de equipo, importar CSV, asignar prospectos, editar su `disbursementGoal`.
- Solo `admin` puede: cambiar roles de cualquier usuario, asignar vendedores a supervisores.
- Un vendedor solo puede recibir un lead vía `assignLeadToSalesperson` si pertenece al equipo (`supervisorId`) del supervisor que ejecuta la acción.
- Un lead solo puede reasignarse por esta vía si su dueño actual es el supervisor mismo (no permite tomar un lead de otro vendedor).
- Al cambiar de `userId`, el lead se marca `crmSynced: false` para forzar la actualización del owner en HubSpot en el próximo ciclo del `sync-engine`.
- Validaciones de importación CSV: DNI paraguayo (5–9 dígitos), email válido, teléfono válido si viene informado, duplicados por hash de email o documento a nivel global (no por vendedor).
- Reglas de jerarquía: un usuario no puede quedar sin roles (`roles.length === 0` lanza error); si deja de ser `user`, se le limpia `supervisorId`; si deja de ser `supervisor`, se limpia `supervisorId` en cascada de sus vendedores.
- Índice único `{ emailHash: 1, userId: 1 }` en `Lead`: la unicidad de email es **por vendedor**, no global. Esto es relevante para una futura reasignación automática/masiva: si se mueve un lead a un vendedor que ya tiene otro lead con el mismo email, la operación de reasignación fallaría por violación de índice único (no hay manejo explícito de este caso en `assignLeadToSalesperson` hoy, aunque en la práctica es poco probable porque `documentIdHash` es único global y suele detectar el duplicado antes).

## Datos que toca

- **`User`** (`src/models/User.ts`): `roles`, `supervisorId`, `disbursementGoal`, `crmOwnerId` (usado para mapear el owner nativo en HubSpot).
- **`Lead`** (`src/models/Lead.ts`): `userId` (único campo que representa "asignación" de un contacto).
- **`Deal`** (`src/models/Deal.ts`): `userId` propio, independiente del `userId` del `Lead` relacionado (no se actualiza en cascada al reasignar el lead).
- **`Activity`** (`src/models/Activity.ts`): `userId` propio, tampoco se reasigna en cascada.
- No se toca ninguna colección de auditoría/histórico — no existe tal colección para asignaciones.

## Integraciones externas involucradas

- **HubSpot** (`src/lib/crm/sync-engine.ts`, `src/lib/crm/hubspot.ts`): al reasignar un lead, el motor outbound sincroniza el nuevo `hubspot_owner_id` a partir del `crmOwnerId` del vendedor destino. Esto asume que cada vendedor tiene un `crmOwnerId` (usuario nativo en HubSpot) ya configurado — ver brecha relacionada en memoria del proyecto (`project_hubspot_owner_pending.md`): vendedores sin licencia HubSpot no pueden ser owner nativo.
- No hay integración con ningún sistema externo de scoring, disponibilidad o geolocalización de sucursales.

## Edge cases y comportamientos conocidos

- Reasignar un lead **no reasigna sus `Deal` ni `Activity` asociados** — quedan con el `userId` del vendedor original salvo que se actualicen aparte (no hay código que lo haga). Esto puede generar inconsistencia: un `Deal` visible en el pipeline de un vendedor que ya no tiene el `Lead` asignado en su lista de contactos.
- `assignLeadToSalesperson` solo opera sobre leads cuyo dueño actual es el supervisor (flujo de "prospecto nuevo → vendedor"). No hay función para transferir un lead que ya es propiedad de un vendedor activo directamente a otro vendedor (el caso real de CU-08 "licencia o baja de un vendedor"); habría que hacerlo indirectamente (ej. un admin/supervisor tocando la base o, hoy, sin ningún flujo soportado en la UI).
- No hay trazabilidad/auditoría: ni `Lead` ni `Deal` guardan quién fue el dueño anterior, cuándo se reasignó, ni quién ejecutó la reasignación. Solo queda el estado final (`userId` actual) y el `updatedAt` del documento.
- La importación de CSV no detecta duplicados por vendedor sino globalmente (por hash de documento/email), lo que es correcto dado que el documento es único a nivel de negocio, pero el email sí es único solo por vendedor (índice compuesto) — combinación que puede sorprender si se decide más adelante hacer reasignaciones automáticas masivas.
- No existe ningún concepto de "disponibilidad" del vendedor (carga de trabajo actual, capacidad máxima, fuera de oficina) ni de "sucursal" en el modelo de datos — cualquier regla de ruteo por sucursal/disponibilidad/puntaje (RF-15) es funcionalidad enteramente nueva a diseñar.
- El "puntaje" que sí existe en el sistema (`Lead.scoring`) es un **scoring crediticio** del prospecto (evaluación de riesgo), no un puntaje de rendimiento/carga del vendedor. RF-15 probablemente necesita un concepto de "puntaje" distinto (de vendedor o de matching), a definir.
- La vista de supervisor sólo desagrega por **deals**, no por actividades de gestión (llamadas, notas, WhatsApp) ni por recordatorios — para RF-18 completo hace falta agregar esa desagregación, hoy inexistente.
- El dashboard de supervisor hace polling cada 15s en el cliente sin invalidación por evento — mismo patrón (y misma limitación de "casi tiempo real") que el resto de la app.

## Disposición en la migración

Este contexto mapea al futuro microservicio **Asignación** ("Scoring y reglas de ruteo por sucursal, disponibilidad y puntaje"), señalado en la arquitectura nueva como la pieza con mayor probabilidad de cambio de reglas de negocio (sección 3.1, diseñado para "iterar sin afectar al resto"). Dado que hoy la asignación es un campo plano (`userId`) sin motor de reglas, sin eventos ni historial, la migración implica:

- Modelar una entidad explícita de **Asignación** (o "ownership assignment") separada del propio `Lead`/`Deal`, con historial (quién, cuándo, por qué regla o de forma manual) — insumo directo para trazabilidad de RF-19.
- Diseñar desde cero el motor de reglas de ruteo automático (RF-15): sucursal, disponibilidad, puntaje — ninguno de estos conceptos existe hoy en el dominio (no hay `branchId`/`sucursal` en `User` ni `Lead`, no hay noción de carga de trabajo/disponibilidad de vendedor, y el único "puntaje" existente es el scoring crediticio del lead, no aplicable directamente a ruteo).
- La reasignación manual (`assignLeadToSalesperson`) y la asignación de vendedores a supervisores (`assignSalespeopleToSupervisor`) son las piezas reutilizables conceptualmente, pero deberían reimplementarse para: (a) cubrir el caso real de transferir cartera de un vendedor activo a otro (hoy no soportado), y (b) propagar la reasignación a `Deal`/`Activity` relacionados o, más probablemente en la arquitectura de eventos, emitir un evento `LeadReassigned` que los servicios de Pipeline/Actividades consuman para mantener consistencia (equivalente al bus de eventos mencionado en el documento de arquitectura).
- La vista de supervisor (CU-07/RF-18) necesita ampliarse con datos que hoy no se calculan en el servidor: recordatorios vencidos/no gestionados por vendedor (hoy 100% client-side en Dexie) y desagregación por actividades, no solo por deals.
- El campo `supervisorId` como string plano y el `role`/`roles` legado en `User` deberán normalizarse (probablemente a un servicio de Usuarios/Identidad separado del de Asignación) al migrar a PostgreSQL con relaciones formales.

## Brechas / preguntas abiertas detectadas

- **RF-15 (asignación automática por sucursal/disponibilidad/puntaje) no existe de ninguna forma hoy.** Es funcionalidad 100% nueva a construir: no hay modelo de sucursal, no hay noción de disponibilidad/carga de un vendedor, y el único "puntaje" del sistema es el scoring crediticio del lead (no de matching vendedor-lead). Hoy toda asignación inicial es manual (supervisor elige vendedor uno por uno) o implícita (el creador del lead es su dueño).
- **RF-19 (reasignación de cartera con trazabilidad) está parcialmente cubierto**: existe `assignLeadToSalesperson`, pero solo sirve para asignar prospectos que son propiedad del supervisor — no hay flujo para transferir un lead/deal que ya pertenece a un vendedor activo a otro vendedor (el caso central de "licencia o baja"). Tampoco hay ningún registro de auditoría/histórico de reasignaciones (quién, cuándo, motivo).
- **Reasignación no propaga a `Deal`/`Activity`**: al mover un `Lead.userId`, sus préstamos y actividades asociadas no se mueven, lo que puede dejar el pipeline y el historial de gestión inconsistentes entre vendedores.
- **"Recordatorios no gestionados" (RF-18) no existe como concepto de servidor**: los recordatorios son enteramente locales (Dexie/IndexedDB) y no se agregan ni son visibles para el supervisor. Habría que decidir si se sincroniza el estado de recordatorios al servidor o se calcula "no gestionado" a partir de `Activity.reminderDate`/`reminderStatus` ya sincronizados (estos sí llegan a Mongo vía sync normal de actividades).
- **Falta de campo de sucursal** en `User`/`Lead`: si RF-15 requiere ruteo por sucursal, hay que definir de cero dónde vive ese dato (¿por vendedor? ¿por lead/zona geográfica del prospecto?) — no hay ningún precedente en el modelo actual.
- **Confirmar con negocio**: si "puntaje" en RF-15 se refiere al scoring crediticio del lead (reutilizable) o a un puntaje de desempeño/prioridad del vendedor (a diseñar desde cero) — la redacción del requerimiento es ambigua respecto al modelo actual.
