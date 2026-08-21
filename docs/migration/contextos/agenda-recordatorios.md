# Agenda y Recordatorios — mapea a servicio Agenda (arquitectura nueva)

## Casos de uso y requerimientos que cubre

- **CU-04 Agenda y recordatorios (Vendedor):** "Recordatorios con atajos frecuentes, separados de las actividades ya realizadas."
- **RF-08:** Separación de actividades realizadas y recordatorios pendientes como secciones distintas.
- **RF-09:** Recordatorios con atajos frecuentes y con especificación libre de fecha y hora.
- **RF-23 (parcial):** Registro sin conexión de recordatorio, con sincronización posterior sin duplicación.
- **Operación offline (sección 3.10):** "crear un recordatorio" es una de las 3 operaciones permitidas sin conexión.

## ¿Existe "Agenda" como concepto separado hoy? (conclusión clara, con evidencia)

**Parcialmente sí, parcialmente no.** Hay dos niveles de respuesta distintos y es importante no mezclarlos:

1. **A nivel de modelo de datos: NO existe una entidad "Recordatorio" separada.** Un recordatorio **es** una `Activity` (la misma tabla/colección que notas, llamadas, reuniones, correos y WhatsApp), distinguida únicamente por tener el campo `reminderDate` definido. No hay modelo `Reminder`, no hay tabla Dexie propia, no hay colección Mongo propia, no hay `ICRMProvider` método propio — todo pasa por `Activity` / `IActivitySchema` / `LocalActivity` y por `fetchActivitiesByLead` / `createActivity` de `ICRMProvider`. Evidencia:
   - `src/models/Activity.ts:13-15` — `reminderDate`, `reminderRead`, `reminderStatus`, `reminderPriority` son campos opcionales dentro del schema de `Activity`, no un modelo distinto.
   - `src/lib/db.ts:56-73` (`LocalActivity`) — mismos campos de recordatorio embebidos en la interfaz de actividad local; no hay `LocalReminder`.
   - `src/lib/crm/hubspot.ts:896-939` (`createActivity`) — cuando `activity.type === 'TASK'`, la misma función que sincroniza cualquier actividad crea/actualiza una Task nativa de HubSpot (`hs_task_*`); no hay un endpoint o método separado para "recordatorios".

2. **A nivel de UI/UX: SÍ existe la separación que pide RF-08**, y es reciente (feature `#16`, según los comentarios del código). `LeadDrawer.tsx` tiene una pestaña **"Actividades"** (línea 698) y una pestaña **"Recordatorios"** (línea 711) totalmente separadas, con:
   - Timeline de "Actividades" que **excluye explícitamente** las que tienen `reminderDate` (`src/components/contacts/LeadDrawer.tsx:1129`: `activities.filter((act) => !act.reminderDate)`), con un comentario en la línea 1249 aclarando que "los recordatorios ya no se muestran acá".
   - Sección "Recordatorios Registrados" que **solo** muestra actividades con `reminderDate` (`LeadDrawer.tsx:1356-1358`).
   - Badge numérico en la pestaña "Recordatorios" con la cantidad de recordatorios en estado `active` (`LeadDrawer.tsx:95-99`, `712-716`).
   - Formulario propio "Nuevo Recordatorio" dentro de la pestaña Recordatorios (`LeadDrawer.tsx:1269-1345`, función `handleAddReminder` en `539-599`), independiente del formulario "Registrar Actividad" de la otra pestaña.
   - Una campanita de notificaciones a nivel de header (`src/components/Header.tsx`) y un hook dedicado `useNotifications.ts` que solo trabaja con actividades que tienen `reminderDate`.

**Conclusión para la migración:** RF-08 (separación funcional/UX) **ya está resuelto** en el producto actual, pero está construido *sobre* el mismo modelo de actividad, no sobre una entidad de agenda independiente. Para el nuevo microservicio "Agenda" esto implica una decisión de diseño explícita: o bien (a) el servicio Agenda persiste su propia entidad `Reminder`/`Task` desacoplada de "Actividad" (más limpio, más alineado a microservicios por dominio), o bien (b) se mantiene el patrón actual de "actividad con `dueDate` opcional" pero como evento propio en el bus. La lógica de negocio (cambio de estado, atajos, offline) es igualmente trasladable en ambos casos; lo que cambia es el modelo de persistencia y el contrato de eventos.

## Qué hace hoy (comportamiento actual)

Un recordatorio es una actividad de tipo `TASK` con `reminderDate` (fecha/hora) definido, y opcionalmente `reminderPriority`. Se puede crear de dos maneras:

1. **Desde la pestaña "Recordatorios"** (`handleAddReminder`, `LeadDrawer.tsx:539-599`): formulario dedicado con título opcional, descripción obligatoria, fecha y hora. Crea una única `Activity` tipo `TASK` con `reminderStatus: 'active'`.
2. **Desde la pestaña "Actividades"** (`handleAddActivity`, alrededor de `LeadDrawer.tsx:352-406`): al registrar cualquier actividad (nota, llamada, reunión, correo) se puede tildar el checkbox "Programar recordatorio". Si la actividad ya es de tipo `TASK`, el recordatorio se guarda en la misma actividad; si es de otro tipo, se crea una **Task acompañante** por separado (`needsCompanionTask`, línea 366-406) — la actividad principal (p. ej. la nota) queda sin `reminderDate` propio, y se genera una segunda `Activity` tipo `TASK` con el mismo título/cuerpo y el `reminderDate`. Esto es así para que en HubSpot la actividad se sincronice como su tipo nativo (Nota, Llamada, etc.) y el recordatorio se sincronice, aparte, como una Task nativa.

**Ciclo de vida del recordatorio** (`reminderStatus`, fuente de verdad — reemplaza al booleano `reminderRead`, que se conserva solo por compatibilidad hacia atrás):
- `active` → recién creado, sin atender. Se muestra en rojo/"Activo" y cuenta para el badge de la pestaña y para la campanita.
- `waiting` ("Leído") → el vendedor lo marcó como leído/reconocido (`handleMarkReminderAsRead`, `LeadDrawer.tsx:445-457`), sin darlo por resuelto. Sincroniza como Task `WAITING`→ HubSpot `NOT_STARTED`/`IN_PROGRESS`... en realidad el mapeo de salida (`hubspot.ts:903-907`) usa `statusMap = { active: 'NOT_STARTED', waiting: 'NOT_STARTED', completed: 'COMPLETED' }` (ver Edge cases).
- `completed` ("Realizado") → el vendedor confirma que fue atendido (`handleCompleteReminder`, `LeadDrawer.tsx:463-484`, con diálogo de confirmación). Deja de contar para el badge y desaparece de la campanita de notificaciones (no solo se marca leída, se elimina de la lista de notificaciones — ver `useNotifications.ts:52-65`).

**Notificaciones (campanita):** `useNotifications.ts` corre dos efectos:
- Uno reactivo (`useLiveQuery` sobre `activities` del usuario) que mantiene una tabla `notifications` en Dexie sincronizada 1:1 con las actividades que tienen `reminderDate` y no están `completed`/eliminadas (líneas 38-115).
- Un timer cada 10 segundos (`setInterval`, línea 155) que revisa qué notificaciones ya vencieron (`scheduledAt <= now` y `!notified`) y dispara `Notification` del navegador (Web Notifications API) si el usuario dio permiso.

El header (`Header.tsx:38-52`) muestra en la campanita solo las notificaciones ya vencidas (`scheduledAt <= now`), con contador de no leídas y acción "Marcar todo leído". Al hacer clic en una notificación, navega a `/contacts?leadId=...&activityId=...` y dispara un `CustomEvent('open-lead-reminder')` para que la página de contactos abra el drawer directamente en la pestaña "Recordatorios" (`LeadDrawer.tsx:213-218`, usa `reminderDate` para decidir la pestaña inicial).

## Reglas de negocio y validaciones

- El campo `body` (descripción) es obligatorio en ambos formularios; el `title` es opcional y si se omite se deriva de los primeros ~50 caracteres del cuerpo (`LeadDrawer.tsx:564-566`).
- La fecha es obligatoria (`required` en los inputs `date`/`time`); si no se completa, se bloquea el submit con `toast.error` (`LeadDrawer.tsx:543-546`).
- No hay validación de que la fecha/hora sea futura — se puede crear un recordatorio con fecha ya vencida (dispara notificación casi inmediatamente en el siguiente ciclo de 10s).
- `reminderPriority` (`LOW`/`MEDIUM`/`HIGH`) existe en el modelo y se sincroniza 1:1 con `hs_task_priority` de HubSpot, pero **no tiene selector en la UI todavía** — siempre se graba `MEDIUM` (comentario explícito en `Activity.ts:49-51` y `db.ts:68`).
- Usuarios en modo "solo lectura" sobre un lead ajeno (`isForeign`, cuando el lead pertenece a otro vendedor) no pueden crear ni completar recordatorios — los formularios se ocultan y se muestra un aviso (`LeadDrawer.tsx:1268, 1346-1349`, y los handlers `handleAddReminder`/`handleMarkReminderAsRead`/`handleCompleteReminder` retornan temprano si `isForeign`).
- Confirmación antes de perder cambios sin guardar: si hay texto tipeado en cualquiera de los tres formularios del drawer (Actividad, Recordatorio, Préstamo) y el usuario intenta cambiar de pestaña o cerrar el drawer, se pide confirmación (`hasUnsavedChanges` / `confirmDiscardIfDirty`, `LeadDrawer.tsx:132-168`).
- Confirmación explícita antes de marcar un recordatorio como "Realizado" (`handleCompleteReminder`, diálogo de confirmación).

## Datos que toca

- **`Activity` / `IActivitySchema`** (MongoDB, `src/models/Activity.ts`) — mismo modelo que actividades comunes. Campos propios de recordatorio: `reminderDate` (Date), `reminderRead` (boolean, deprecado), `reminderStatus` (`'active' | 'waiting' | 'completed'`), `reminderPriority` (`'LOW' | 'MEDIUM' | 'HIGH'`). `title`/`body` cifrados con `SERVER_ENCRYPTION_SECRET` (AES-256-CBC, getters/setters Mongoose).
- **`LocalActivity`** (Dexie, `src/lib/db.ts:56-73`) — espejo local cifrado con AES-256-GCM (client-crypto), mismos campos de recordatorio.
- **`LocalNotification`** (Dexie, `src/lib/db.ts:75-86`) — tabla derivada, generada y mantenida enteramente por `useNotifications.ts` a partir de las actividades con `reminderDate`; no viaja al servidor, es puramente de UI/cliente (campanita).
- **HubSpot Task nativa** — vía `ICRMProvider.createActivity`/`fetchActivitiesByLead` (`src/lib/crm/hubspot.ts`), mapeo `reminderStatus → hs_task_status`, `reminderPriority → hs_task_priority`, `reminderDate → hs_timestamp`, `title → hs_task_subject`, `body → hs_task_body`.
- **`sync.ts`** (`pushClientChanges`/`pullServerUpdates`) trata los campos de recordatorio como parte del payload genérico de actividad (líneas ~266-311, ~689-701, ~850-857 de `src/app/actions/sync.ts`) — no hay ruta de sincronización separada para recordatorios.

## Comportamiento offline

Crear un recordatorio es una operación **de solo-alta** (create-only) igual que crear una actividad común: se escribe directo en Dexie (`localDb.activities.put(...)`) con `tempId: crypto.randomUUID()` y `synced: false`, sin depender de red. Al reconectar, `useSync.ts` empuja las actividades no sincronizadas (`unsyncedActivities`, línea 58) a `pushClientChanges`, que en el servidor deduplica por `tempId`:
- `Activity.tempId` tiene índice `unique, sparse` en MongoDB (`src/models/Activity.ts:26`).
- `pushClientChanges` busca primero por `tempId` (`sync.ts:278`) y si ya existe actualiza en vez de insertar duplicado — esto es lo que garantiza "sincronización posterior sin duplicación" (RF-23) para reintentos de push tras cortes de red.

No hay cola de comandos ni mecanismo de conflicto explícito: al ser alta pura (nunca hay edición concurrente de un recordatorio por dos usuarios, dado que pertenece a un vendedor y su lead), el modelo actual ya cumple el patrón "sin conflictos de edición concurrente" que la nueva arquitectura exige para las 3 operaciones permitidas offline.

Las transiciones de estado del recordatorio (`active → waiting → completed`) **si** son ediciones sobre un registro existente (`localDb.activities...modify(...)`, `synced: false`), pero no están en el alcance de "las 3 operaciones offline" descritas — conviene aclarar en la nueva arquitectura si estas transiciones de estado deben permitirse offline o requieren conexión.

## Edge cases y comportamientos conocidos

- **Task acompañante duplica contenido:** al programar un recordatorio desde una actividad que no es `TASK` (p. ej. una nota), se crean **dos** registros de `Activity` con el mismo `title`/`body` — uno como la nota (sin `reminderDate`) y otro como Task (con `reminderDate`). Es intencional (para sincronizar tipos nativos correctos a HubSpot) pero implica que "una actividad con recordatorio" son en realidad dos filas en la base.
- **Mapeo de estados a HubSpot es de 3→2:** `reminderStatus` tiene 3 valores (`active`/`waiting`/`completed`) pero `statusMap` en `hubspot.ts:903-907` mapea tanto `active` como `waiting` a `NOT_STARTED` — es decir, HubSpot no distingue "activo" de "leído/en espera"; esa distinción es exclusiva del modelo interno/UI del dashboard.
- **"Realizado" borra la notificación, no solo la marca leída:** a diferencia del resto de notificaciones, cuando `reminderStatus === 'completed'` la notificación correspondiente se elimina por completo de la tabla local `notifications` (`useNotifications.ts:55-65`), en vez de quedar en la lista marcada como leída.
- **Purga de caché local puede hacer "desaparecer" recordatorios ya sincronizados:** `purgeLocalCache()` en `useSync.ts:569-628` borra en cascada `activities` (incluyendo recordatorios) de leads con más de 7 días sin actualizar y sin préstamos activos, cuando el total de leads locales supera 100. El recordatorio sigue existiendo en MongoDB/HubSpot, pero desaparece de Dexie y, por la limpieza de huérfanos de `useNotifications.ts:102-108`, también desaparece de la campanita local — sin que el vendedor lo haya completado. Esto es un candidato a comportamiento a revisar/documentar explícitamente en el nuevo diseño (¿la Agenda debe tener su propia política de retención, independiente de la ventana deslizante de leads?).
- **Sin validación de fecha futura:** se puede crear (o dejar) un recordatorio con fecha pasada; dispara notificación casi de inmediato.
- **`reminderPriority` sin UI:** el campo existe end-to-end (Dexie → Mongo → HubSpot) pero siempre vale `MEDIUM` porque no hay selector en el formulario — es "funcionalidad fantasma" ya cableada, lista para exponer.
- **Falta de atajos (RF-09):** confirmado por inspección de ambos formularios de recordatorio (`LeadDrawer.tsx:1277-1329` y `997-1090`) — son inputs `<input type="date">` / `<input type="time">` sin ningún botón de atajo ("mañana", "en 3 días", "próxima semana", etc.). El único valor precargado es la fecha por defecto "mañana 08:00" al abrir el formulario (`getTomorrowString()`, línea 30-38, usado como valor inicial de `newReminderDateOnly`). No existe today ningún componente de "atajos frecuentes" en todo `src/` (búsqueda de "atajo"/"shortcut"/"quick" sin resultados relevantes).

## Disposición en la migración

- El **estado del recordatorio** (`active`/`waiting`/`completed`), su **prioridad** (`LOW`/`MEDIUM`/`HIGH`, ya modelada pero sin UI) y su **fecha/hora libre** son trasladables tal cual al nuevo servicio Agenda.
- La separación de secciones (RF-08) ya está validada como patrón de UX en producción — sirve de referencia directa para las dos secciones que pedirá el nuevo frontend BFF ("Actividades realizadas" vs. "Recordatorios pendientes").
- **RF-09 (atajos frecuentes) es funcionalidad nueva a construir**, no una migración de algo existente — no hay componente, endpoint, ni siquiera un array de opciones predefinidas ("mañana", "en 3 días", etc.) hoy en el código.
- Conviene decidir explícitamente si el nuevo servicio Agenda modela el recordatorio como entidad propia (`Reminder`) desacoplada de "Actividad realizada", en vez de heredar el patrón actual de "Activity con `dueDate` opcional + tipo TASK", dado que la arquitectura nueva es de microservicios por dominio (Agenda vs. Actividad serían bounded contexts distintos, comunicados por bus de eventos en vez de compartir tabla).
- El patrón de dedup por `tempId` (alta idempotente, sin conflictos) es directamente reutilizable para "crear recordatorio" como una de las 3 operaciones offline permitidas — es exactamente el mecanismo que ya usa hoy.
- El mapeo a Task nativa de HubSpot (estados, prioridad, fecha) es una referencia útil si el nuevo servicio Agenda mantiene la sincronización saliente a HubSpot como Tasks.

## Brechas / preguntas abiertas detectadas

1. **RF-09 no existe hoy** — hay que definir desde cero el catálogo de "atajos frecuentes" (¿"mañana", "en 3 días", "en 1 semana"? ¿configurable por rol/financiera?) y su UX (¿botones sobre el date-picker? ¿reemplaza el date-picker libre o convive con él, como pide el requerimiento "atajos... y con especificación libre de fecha y hora"?).
2. **¿Recordatorio como entidad propia o como "actividad con fecha"?** Definir el modelo de datos del nuevo servicio Agenda: entidad `Reminder` independiente (más alineado a microservicios) vs. mantener el acoplamiento actual a `Activity`/`TASK`.
3. **`reminderPriority` sin UI**: ¿se expone en la nueva Agenda (selector Baja/Media/Alta) o se descarta el campo?
4. **Política de retención de recordatorios en cliente**: hoy la ventana deslizante de 100 leads/7 días puede purgar recordatorios activos no vencidos junto con su lead — ¿la nueva Agenda necesita su propia política de retención local, independiente de la de leads (p.ej. nunca purgar recordatorios `active` aunque el lead se purgue)?
5. **Transiciones de estado (`marcar leído` / `marcar realizado`) offline**: el enunciado de la arquitectura nueva limita las operaciones offline a "crear recordatorio" (alta); no queda claro si cambiar el estado de un recordatorio ya existente debe permitirse sin conexión (hoy sí se permite, vía el mismo mecanismo de `synced: false`).
6. **Mapeo 3→2 de estados a HubSpot** (`active`/`waiting` colapsan a `NOT_STARTED`): si la nueva arquitectura sigue sincronizando a HubSpot, decidir si se mantiene esta pérdida de granularidad o se busca un campo custom para preservar los 3 estados en CRM.
7. **Sin validación de fecha pasada**: definir si la nueva Agenda debe bloquear/advertir al crear un recordatorio con fecha ya vencida.
