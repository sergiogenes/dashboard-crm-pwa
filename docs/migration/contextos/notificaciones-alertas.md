# Notificaciones y Alertas — mapea a servicio Notificación (arquitectura nueva)

> Contexto fuente: `dashboard-crm` (Portal de Vendedores HPN, Proyecto 307).
> Futuro microservicio de destino: **Notificación** — "Avisos en el portal y mensajes salientes por los canales habilitados".

## Casos de uso y requerimientos que cubre

- **CU-06 Pantalla de inicio con alertas (Vendedor):** "Alertas de leads pendientes, cambios de estado, documentación rechazada y vencimientos próximos."
- **RF-17:** Pantalla de inicio con alertas de leads pendientes, cambios de estado, documentación incompleta y vencimientos próximos.

De los cuatro tipos de alerta que enumeran CU-06/RF-17, **hoy la app implementa un único tipo real: recordatorios de actividad (tareas con fecha)**. Los otros tres (leads pendientes, cambios de estado, documentación rechazada/incompleta) **no existen como alertas proactivas** — como mucho hay datos o UI contextual de los que se podría derivar una alerta, pero no hay ningún mecanismo hoy que las genere, las liste en la campanita ni las cuente en un badge. El detalle de cada uno está en la sección "Brechas".

## Qué hace hoy (comportamiento actual)

El sistema de notificaciones actual es, en esencia, **un motor de recordatorios derivado de la tabla `activities`**, con dos piezas:

### 1. `useNotifications.ts` (`src/hooks/useNotifications.ts`) — motor de sincronización y disparo

Se monta una sola vez en `src/app/(dashboard)/layout.tsx` (`useNotifications()`), o sea corre en todo momento que el usuario está dentro del dashboard.

**a) Sincronización reactiva actividad → notificación** (efecto disparado por `useLiveQuery` sobre `localDb.activities.where('userId').equals(userId)`):
- Por cada actividad del usuario, la desencripta (`decryptActivity`) y calcula:
  - `scheduledAt` = `Number(act.reminderDate)` (o `0` si no tiene).
  - `reminderStatus` = `act.reminderStatus` si existe, si no cae al legado `act.reminderRead ? 'waiting' : 'active'`. `reminderStatus` es la fuente de verdad; `reminderRead` (booleano) queda solo por compatibilidad con datos viejos.
  - `isRead` = `reminderStatus !== 'active'`.
- **Se descarta / elimina la notificación** (no solo se marca leída) si: la actividad está `deleted`, no tiene `scheduledAt` válido, o `reminderStatus === 'completed'` — un recordatorio marcado "Realizado" desaparece de la campanita igual que uno borrado.
- Si sobrevive el filtro, busca el lead asociado (`leadId` puede ser `tempId` o `id` de MongoDB, se intenta ambos) y lo desencripta para armar el nombre a mostrar (`leadName`, o `'Contacto'` si no se encuentra).
- Si no existe notificación previa para esa actividad (`activityId` = `act.tempId || act.id`), crea un registro nuevo en `localDb.notifications` con:
  - `title`: `` `Recordatorio: ${act.title}` ``
  - `body`: `` `Lead: ${leadName}\n${act.body.substring(0, 80)}` `` (cuerpo de la actividad truncado a 80 caracteres)
  - `scheduledAt`, `read: isRead`, `notified: isRead` (si ya nace en estado no-activo, no dispara notificación del sistema), `createdAt: Date.now()`.
- Si ya existe, solo actualiza `scheduledAt`/`read`/`notified` cuando cambiaron (evita escrituras innecesarias).
- **Limpieza de huérfanas:** al final de cada corrida, borra cualquier notificación cuyo `activityId` ya no corresponda a ninguna actividad viva del usuario (cubre borrado directo y purga de caché en cascada, ver Edge cases).

**b) Disparo de notificaciones del sistema — polling cada 10 segundos** (`setInterval(..., 10000)`):
- Consulta `localDb.notifications` del usuario, filtra las que tienen `!n.notified && n.scheduledAt <= now`.
- Si hay alguna pendiente y `Notification.permission === 'default'`, pide permiso al navegador (`Notification.requestPermission()`).
- Si el permiso está concedido, dispara una `new Notification(title, { body, icon: '/icons/icon-192x192.png' })` del navegador por cada una.
- Marca cada una como `notified: true` inmediatamente después (se dispare o no la notificación nativa — p. ej. si el permiso fue denegado, igual queda marcada y no se reintenta).
- Corre una vez al montar y luego cada 10s mientras el layout del dashboard esté vivo.

### 2. Header / campanita (`src/components/Header.tsx`) — UI de consumo

- `useLiveQuery` trae todas las notificaciones del usuario y las filtra a `scheduledAt <= now` (solo muestra las que ya vencieron, no las futuras), ordenadas por `scheduledAt` descendente.
- `unreadCount` = cantidad con `read === false`. Si es `> 0`, el ícono de campana cambia a estilo "alerta" (badge rojo animado con `animate-ping`); si es `0`, queda en estilo neutro.
- El dropdown lista cada notificación (título, cuerpo, fecha) con dos acciones:
  - **Click en la fila:** navega a `/contacts?leadId=...&activityId=...`, cierra el dropdown y dispara un `CustomEvent('open-lead-reminder')` en `window` para que la página de contactos reaccione en caliente y abra el drawer del lead en la actividad correspondiente.
  - **Botón "marcar como leído" (individual) o "Marcar todo leído" (global):** actualiza `localDb.notifications` (`read: true`) y además llama a `markActivityReminderAsRead(activityId)`, que busca la actividad origen (por `tempId` o `id`) y la actualiza a `reminderRead: true, reminderStatus: 'waiting', synced: false, updatedAt: Date.now()` — es decir, **marcar como leída en el portal reescribe la actividad y la vuelve a encolar para sincronizar** (`synced: false`) hacia MongoDB/HubSpot.
- No hay lectura de notificaciones desde ningún otro componente; la campanita en `Header.tsx` es el único punto de consumo del contexto en la UI.

### Origen de los recordatorios (dónde nace un `reminderDate`)

Los recordatorios se crean desde `LeadDrawer.tsx` (pestaña Actividades/Recordatorios), como una `Activity` de tipo `TASK` con `reminderDate`, `reminderStatus: 'active'` y `reminderPriority: 'MEDIUM'` (por defecto — no hay selector de prioridad en la UI aunque el campo existe y se sincroniza con HubSpot como `hs_task_priority`). No hay ningún otro punto del sistema (deals, invoices, webhooks) que cree una `Activity`/recordatorio automáticamente hoy — el usuario siempre lo crea a mano.

## Reglas de negocio y validaciones

- **`reminderStatus` es la fuente de verdad** del ciclo de vida de un recordatorio: `active` → `waiting` (leído/pospuesto) → `completed` (realizado). `reminderRead` es un booleano legado que solo se consulta como fallback si `reminderStatus` no está seteado (datos viejos).
- Un recordatorio `completed` o de una actividad `deleted` **se elimina** de `notifications`, no se archiva.
- Una notificación se considera "vencida" (visible en la campanita) solo cuando `scheduledAt <= now`; las futuras existen en Dexie pero no se muestran todavía.
- `notified` es un flag de disparo único: evita reenviar la misma notificación del navegador en cada ciclo de polling una vez que ya se disparó (o se intentó disparar).
- La deduplicación de notificaciones por actividad usa `activityId = act.tempId || act.id` como clave — preferencia por el id temporal local sobre el id remoto de MongoDB.
- El botón "marcar como leído" tiene efecto de doble escritura: actualiza la notificación local y la actividad origen, y esta última se re-encola para sync saliente (`synced: false`).

## Datos que toca

- **`localDb.notifications` (Dexie, IndexedDB del cliente)** — única tabla propia de este contexto. Esquema (`src/lib/db.ts`, versión 5 en adelante):
  ```
  id: string (UUID)
  activityId?: string
  leadId: string
  userId: string
  title: string
  body: string
  scheduledAt: number
  read: boolean
  notified: boolean
  createdAt: number
  ```
  Índices Dexie: `id, userId, read, notified, scheduledAt, activityId, leadId`.
- **No tiene modelo Mongoose ni contraparte en MongoDB.** No aparece en `src/app/actions/sync.ts` (ni en `pushClientChanges` ni en `pullServerUpdates`) ni en `sync-engine.ts`. Es **100% local al dispositivo/navegador** — se recalcula por completo a partir de `activities` cada vez que la app carga, y se pierde con `localDb.delete()` en logout (`SessionPurgeObserver`) o si se limpia el IndexedDB del navegador.
- **Lee (no escribe) `localDb.leads`** para resolver el nombre del contacto a mostrar en el cuerpo del mensaje.
- **Lee y escribe `localDb.activities`**: lee `reminderDate/reminderStatus/reminderRead/deleted` de todas las actividades del usuario; escribe (`update`) `reminderRead/reminderStatus/synced/updatedAt` cuando el usuario marca como leído desde la campanita.
- Indirectamente, los campos de recordatorio de `activities` (`reminderDate`, `reminderStatus`, `reminderPriority`, `reminderRead`) sí viajan a MongoDB (`src/models/Activity.ts`) y de ahí a HubSpot como Task (`hs_task_priority`, `hs_timestamp`) vía `src/lib/crm/hubspot.ts` y `sync-engine.ts` — pero eso es sincronización de la *actividad*, no de la notificación derivada.

## Edge cases y comportamientos conocidos

- **No hay push real / background:** no existe integración con `PushManager`/Push API ni `showNotification` desde el service worker (`src/components/ServiceWorkerRegistration.tsx` solo registra el SW para caché PWA offline). El disparo usa la Web Notification API síncrona desde el propio tab, dentro de un `setInterval` de 10s en `useNotifications.ts`. Si la pestaña/app no está abierta, no se dispara nada; al reabrir, todos los recordatorios vencidos acumulados se disparan de una sola vez en el primer ciclo.
- **Permiso del navegador:** solo se pide `Notification.requestPermission()` en el momento en que hay al menos una notificación vencida pendiente de disparar — no al iniciar sesión. Si el usuario deniega el permiso, las notificaciones igual se marcan `notified: true` (no hay reintento ni fallback visual adicional más allá de la campanita).
- **Limpieza de huérfanas es la única red de seguridad ante borrados en cascada:** `purgeLocalCache()` (`src/hooks/useSync.ts`, ventana deslizante de 100 leads / 7 días) borra en cascada `invoices`, `activities` y `deals` de los leads purgados, pero **no borra `notifications` directamente**. La limpieza ocurre indirectamente en el siguiente ciclo de `useNotifications.ts`: al desaparecer las actividades, sus notificaciones asociadas quedan huérfanas y se eliminan por el chequeo `activityKeys.has(notif.activityId)`.
- **Fallback de nombre de lead:** si el lead asociado a la actividad no se encuentra (por ejemplo, purgado antes que la notificación), el cuerpo del mensaje muestra `'Contacto'` en lugar del nombre real.
- **Reminder sin companion task vs. con companion task:** en `LeadDrawer.tsx` hay dos rutas de creación de recordatorio (una directa desde la pestaña de Recordatorios, otra como "recordatorio + tarea" — `needsCompanionTask`), pero ambas terminan generando una `Activity` con `reminderDate` que `useNotifications.ts` procesa de forma idéntica.
- **Filtrado de "vencidas" en el Header duplica parcialmente el filtro del hook:** `Header.tsx` vuelve a filtrar por `scheduledAt <= now` sobre todo lo que ya está en `notifications`, en vez de confiar en que solo entren ahí las vencidas — es decir, notificaciones "futuras" si llegaran a crearse igual quedan en Dexie pero invisibles hasta que venzan (comportamiento intencional, no bug, pero es lógica de "vencido" duplicada en dos capas).
- **No hay agrupación ni límite de notificaciones mostradas** — el dropdown lista todas las vencidas del usuario (con scroll interno `max-h-64`), no hay paginación ni límite de retención por antigüedad más allá de lo que ya se purga vía actividades.

## Nota de diseño a futuro (adaptador OTP MFA)

Hoy el MFA de la app es exclusivamente TOTP basado en app autenticadora (`otplib`, ver `src/app/actions/mfa.ts`) — no hay envío de OTP por email ni SMS en el sistema actual. Sin embargo, está previsto que un futuro flujo de MFA envíe códigos OTP por **email (SendGrid inicialmente)** y por **SMS (proveedor a definir)**. Conceptualmente ese envío de OTP es un "mensaje saliente por un canal habilitado" — el mismo tipo de responsabilidad que ya cubre este contexto para WhatsApp/alertas — por lo que el futuro microservicio de Notificación es el candidato natural para alojar ese adaptador de envío (con su propio `IOtpChannelProvider` o equivalente, análogo a `ICRMProvider`/`IMessagingProvider`), aunque hoy no exista ningún código relacionado en el repo. Se deja como nota de diseño para quien planifique el servicio, no como funcionalidad a migrar.

## Disposición en la migración

- El **motor de recordatorios y su disparo** (`useNotifications.ts`, polling 10s, Web Notification API) es lógica de cliente/UI que en la arquitectura BFF + microservicios debería reconstruirse como una funcionalidad real del servicio Notificación: alertas persistidas server-side (no solo derivadas en el navegador), con entrega vía el canal que corresponda (in-app / push real / email), en vez de un `setInterval` client-side dependiente de que la pestaña esté abierta.
- La tabla `notifications` de Dexie **no tiene contraparte server-side hoy** — no hay modelo, endpoint ni entidad de dominio que migrar directamente; es un artefacto derivado y recalculable. La migración debería definir un modelo de "Notificación"/"Alerta" propio del nuevo servicio en PostgreSQL, generado a partir de eventos del bus (ej. `activity.reminder.due`, `lead.status.changed`, `document.rejected`, `invoice.due_soon`) en vez de recalcularse por polling desde el cliente.
- Los **datos de origen** de la única alerta real de hoy (recordatorios) — `reminderDate`, `reminderStatus`, `reminderPriority` en `Activity` — sí son datos de dominio persistentes y deberían mapear al futuro microservicio de Actividades/CRM, que emitiría el evento que dispara la alerta en el servicio Notificación (separación productor/consumidor vía bus de eventos, consistente con la arquitectura nueva).
- El patrón de "marcar como leído reescribe la entidad origen y la reencola para sync" (`Header.tsx` → `markActivityReminderAsRead`) es un acoplamiento directo UI↔actividad que no debería persistir tal cual: en la arquitectura nueva, marcar una alerta como leída debería ser una operación propia del servicio Notificación (estado de la alerta), independiente de si eso implica también actualizar el estado de la tarea en el servicio de origen (y si es así, debería hacerse vía comando/evento explícito, no como efecto secundario oculto de leer una notificación).
- Los tres tipos de alerta pedidos por RF-17/CU-06 que no existen hoy (leads pendientes, cambios de estado, documentación rechazada/incompleta) son **funcionalidad nueva a diseñar desde cero** para el servicio Notificación, no una migración de código existente — ver brechas abajo para qué señales/datos ya existen en otros contextos que podrían servir de disparador.

## Brechas / preguntas abiertas detectadas

1. **"Leads pendientes" — no existe como alerta.** Existe el concepto de lead "Nuevo / Sin Contactar" en el dashboard (`useDashboard.ts`, conteo `countNew`) y el campo "Última vez contactado" (`getLastContactedAt` en `useContacts.ts`), pero son solo datos mostrados en tablas/KPIs — ningún mecanismo los convierte en una alerta en la campanita ni dispara nada cuando un lead lleva N días sin contacto. Falta definir: ¿qué umbral de "pendiente" dispara la alerta (días sin contactar, sin actividad, sin deal creado)?
2. **"Cambios de estado" — no existe como alerta.** No hay ningún listener/hook que compare el estado anterior vs. nuevo de un `Lead` o `Deal` (incluyendo cambios que llegan vía webhook de HubSpot, `src/app/api/webhooks/crm/route.ts`) y genere una notificación. El webhook actualiza los datos en MongoDB/Dexie silenciosamente; el usuario se entera solo si mira la pantalla. Falta definir sobre qué transición de estado (stage de Deal, status de Lead) se debe alertar.
3. **"Documentación rechazada / incompleta" — no existe como concepto en el dominio actual.** No hay ningún campo de estado de documento (rechazado/incompleto/aprobado) en `Lead`, `Deal` ni `Invoice` en todo el código relevado. Lo más cercano es el `status` de `Invoice` (`PAID | PENDING | OVERDUE`), que es sobre facturas/cuotas, no sobre documentación de onboarding/KYC. Esta es la brecha más grande de las cuatro: falta modelar qué es "documentación" en el dominio antes de poder alertar sobre su rechazo.
4. **"Vencimientos próximos" — existe el dato pero no la alerta proactiva.** `Invoice.dueDate` y `Invoice.status === 'OVERDUE'` existen y se muestran, pero **solo dentro del drawer de un lead específico** (pestaña Finanzas de `LeadDrawer.tsx`, `overdueInvoices`), nunca agregado a nivel de cartera ni empujado a la campanita/dashboard. El único mecanismo "proactivo" real de todo el sistema son los recordatorios manuales (`reminderDate` en `Activity`), que el vendedor podría usar hoy como sustituto manual de un vencimiento próximo, pero no hay ninguna alerta automática basada en `dueDate` de facturas.
5. **Confirmar con negocio si "leads pendientes"/"cambios de estado" deben originarse en eventos del propio servicio de Leads/Deals (vía bus) o si el servicio Notificación debe hacer polling/consultas propias** — afecta el diseño del contrato de eventos entre microservicios.
6. **La prioridad del recordatorio (`reminderPriority`) existe en el modelo y se sincroniza con HubSpot pero no tiene UI** (`LeadDrawer.tsx` siempre crea `MEDIUM`) — evaluar si vale la pena exponerla en la migración o descartarla si nunca se usó.
