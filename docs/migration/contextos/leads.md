# Leads / Contactos — mapea a servicio Leads (arquitectura nueva)

Referencia de código: `dashboard-crm` en la rama `feature/feedback-13-fix-credit-history-button`. Fuente de arquitectura objetivo: "Arquitectura de la solución Portal de Vendedores v01" (Negofin, 2026-08-12). Ver `docs/migration/01-brechas-y-decisiones.md` para el estado de las decisiones ya tomadas (Empresas, sync HubSpot unidireccional, scoring, deals offline).

## Casos de uso y requerimientos que cubre

- **CU-03 Contactos y actividades (Vendedor)** — Cubre completamente. Alta de contacto (`LeadFormModal.tsx`), registro de actividades de contacto y seguimiento (`LeadDrawer.tsx`, pestañas "Actividades" y "Recordatorios"), historial por cliente (timeline + facturas + préstamos en el drawer).
- **RF-01 Alta de contacto con validación adaptada a Paraguay** — Cubre **parcialmente**. Teléfono ya usa `libphonenumber-js` con Paraguay (`'PY'`) como país por defecto y acepta prefijo internacional (`src/lib/validation.ts:15-21`). Documento (cédula) valida solo longitud/dígitos, sin estructura verificada oficialmente (ver sección de validaciones abajo). El requisito "teléfono obligatorio, correo opcional si hay teléfono" **no se cumple hoy**: el formulario exige correo y documento obligatorios, y el teléfono es explícitamente opcional (`LeadFormModal.tsx:83-94`, label "Teléfono (Opcional)" en línea 302) — es la relación de obligatoriedad inversa a la pedida por RF-01.
- **RF-02 Restricciones de formato en campos de entrada** — Cubre. Documento: solo dígitos vía `replace(/\D/g, '')` al tipear + `maxLength={9}` (`LeadFormModal.tsx:333-337`). Teléfono: saneo de caracteres permitidos al tipear (`sanitizePhoneInput`, `validation.ts:29-32`) + `maxLength={20}`. Email: regex tipo WHATWG (`validation.ts:41-46`).
- **RF-03 Titularidad del contacto configurable por regla, asignación por defecto al vendedor que lo registra** — Cubre **solo la mitad**. La asignación por defecto al vendedor que lo crea existe (`userId` se setea al `userId` de la sesión en `LeadFormModal.tsx:190`). La parte "configurable por regla" **no existe**: no hay ningún mecanismo de reglas de asignación/reasignación automática en este contexto (la reasignación de leads sí existe pero como acción manual de supervisor, en `src/app/actions/supervisor.ts`, fuera de este documento).
- **RF-04 Vista de contactos con columnas reducidas + selección de columnas adicionales** — Cubre completamente. `useConfigurableColumns` + `ColumnPicker` + columnas fijas (Nombre, Acciones) vs. configurables (`LeadTable.tsx:30-38`).
- **RF-05 Última fecha de contacto calculada automáticamente desde actividades** — Cubre completamente. `getLastContactedAt` en `useContacts.ts:647-661`.
- **RF-06 Registro rápido de acción de contacto directo diferenciado de seguimiento** — Cubre parcialmente / de forma indirecta. Existe la distinción entre tipos de actividad "de contacto directo" (`CALL`, `WHATSAPP`, `EMAIL`, `MEETING`) y el resto (`NOTE`, `TASK`) a efectos de cálculo de RF-05 (`useContacts.ts:646`), y el botón "Ver Historial Crediticio" vs. clic de fila ya distingue explícitamente propósito de apertura (ítem #13, `page.tsx:47-54`). Pero no hay un botón/acción de "registro rápido" de un solo paso para contacto directo — hoy todo pasa por el formulario completo de "Registrar Actividad" en el drawer, con selección manual de tipo.
- **RF-07 Carga de descripción de actividad mediante nota de voz** — **No cubre.** No se encontró ningún uso de `MediaRecorder`, Web Speech API, ni de un servicio de transcripción en el repo. El campo "Descripción" de actividad es un `<textarea>` de texto libre (`LeadDrawer.tsx:987-994`).
- **RF-14 Consulta de scoring crediticio e historial del cliente desde la ficha del contacto** — Cubre la parte de **consulta/visualización** (pestaña "Finanzas" del drawer: badge de scoring, total adeudado, cumplimiento, listado de facturas — `LeadDrawer.tsx:742-854`). El **cálculo** del scoring queda fuera de alcance por decisión ya tomada (ver `01-brechas-y-decisiones.md`, punto 5) — no se documenta el algoritmo, solo el consumo (campo `scoring: string` en `Lead`, mostrado vía `getScoringBadge`).
- **RF-23 Registro sin conexión de actividad y contacto (offline-first), sin duplicación al sincronizar** — Cubre completamente para la escritura offline (Dexie + `synced: false` + sync posterior). La deduplicación al sincronizar tiene matices y un caso real de duplicación conocido — ver "Edge cases" y "Brechas" abajo.

## Qué hace hoy (comportamiento actual)

### Alta de contacto
1. El vendedor abre "Nuevo Contacto" (`page.tsx:104-113`) → abre `LeadFormModal` sin `leadToEdit`.
2. Completa nombre, apellido, email (obligatorio), teléfono (opcional), documento (obligatorio), empresa asociada (opcional, selector de `Company` local).
3. Al enviar (`LeadFormModal.tsx:78-213`): valida campos obligatorios → valida formato de email → valida formato de teléfono (si hay contenido) → valida formato de documento → chequea duplicado de email activo en Dexie (desencriptando en memoria todos los leads del usuario) → chequea duplicado de documento activo del mismo modo → arma el registro con `tempId: crypto.randomUUID()`, `synced: false` → cifra (`encryptLead`) → `localDb.leads.add(...)`.
4. El registro queda pendiente de sincronización; `useSync` lo sube en el próximo ciclo (polling cada 15s o evento `online`).

### Búsqueda por DNI / email (búsqueda global)
1. El campo de búsqueda de la lista de contactos (`page.tsx:128-134`) acepta DNI/cédula, nombre o email.
2. `useContacts.ts:238-276`: con 500ms de debounce, si hay `navigator.onLine` y sesión, llama a la Server Action `searchGlobalLeads(query)`.
3. `searchGlobalLeads` (`src/app/actions/sync.ts:1061-1170`): primero busca en MongoDB por `documentIdHash`/`emailHash` exactos (sin filtrar por `userId` — es una búsqueda **global**, no solo de los contactos propios). Si HubSpot está online (`crm.checkHealth()`), además busca en HubSpot por el término libre, e **importa a MongoDB** cualquier lead nuevo encontrado allá, asignando `userId` según `crmOwnerId` mapeado a un `User.crmOwnerId` local, o `'system_fallback'` si no hay match.
4. Los resultados se combinan con los leads locales (`allLeadsCombined` en `useContacts.ts:515-523`), deduplicando por `id` o `documentId` coincidente.
5. Al seleccionar un contacto ajeno (`userId` distinto al de la sesión) para ver su drawer, se dispara `getGlobalLeadDetails(leadId)` (`sync.ts:1172-1248`), que además re-sincroniza facturas/actividades/deals de ese lead desde HubSpot bajo demanda.
6. Si el contacto es propio pero no está en la caché local (fue purgado), se cachea en Dexie de forma transparente (`useContacts.ts:315-409`).

### Edición
- Mismo modal (`LeadFormModal`) con `leadToEdit` precargado; usa `localDb.leads.put(...)` (reemplazo completo del registro) en vez de `add`, y fuerza `synced: false` para resincronizar.
- Un lead ajeno (`lead.userId !== userId`) no es editable: los botones de editar/eliminar aparecen deshabilitados en `LeadTable.tsx:231-244` y `LeadCard.tsx:141-154`, con tooltip "Solo Lectura (Propietario ajeno)".

### Vista de lista con columnas configurables (RF-04)
- Desktop: `LeadTable.tsx`. Columnas fijas: Nombre (+ documento como subtítulo) y Acciones. Columnas configurables vía `useConfigurableColumns('contactsTable.visibleColumns.v2', CONFIGURABLE_COLUMNS)`: Email, Teléfono (default on), Empresa (default off), Scoring, Estado, Último Contacto (default on), Origen/Sinc (default off, solo visible por default en dev).
- Mobile: `LeadCard.tsx`, formato de tarjeta sin selector de columnas (todo el detalle relevante siempre visible).
- La preferencia de columnas se persiste en `localStorage` por navegador/dispositivo, no en el servidor — no viaja entre dispositivos del mismo vendedor.

### Timeline en el drawer (`LeadDrawer.tsx`)
- 4 pestañas: **Finanzas** (scoring + facturas, RF-14), **Actividades** (formulario de alta + timeline, incluye burbujas de chat para WhatsApp), **Recordatorios** (tareas con `reminderDate`, contador de pendientes en el tab), **Préstamos** (alta y listado de `Deal`, ver nota de exclusión en decisiones ya tomadas — edición offline de deals se descarta en la migración).
- El botón "Ver Historial Crediticio" fuerza apertura directa en la pestaña Finanzas (`initialDrawerTab`, fix del ítem #13); el clic en la fila abre en la última pestaña usada.
- Confirmación de descarte si hay contenido sin guardar al cerrar el drawer o cambiar de pestaña (`hasUnsavedChanges` / `confirmDiscardIfDirty`, `LeadDrawer.tsx:132-168`).
- Modo solo lectura completo para leads ajenos (`isForeign`): no se pueden crear actividades, recordatorios ni préstamos (`LeadDrawer.tsx:280`, `489`, `541`, `604`).

## Reglas de negocio y validaciones

Archivo: `src/lib/validation.ts`.

- **Teléfono** (`isValidPhone`): usa `libphonenumber-js` con Paraguay (`'PY'`) como país por defecto; acepta formato internacional completo con `+` o formato local paraguayo sin prefijo. Cadena vacía es válida (campo opcional). **Sí está adaptado a Paraguay** en cuanto al parseo, pero el requisito de negocio de RF-01 (teléfono obligatorio) no se aplica — sigue siendo opcional en el formulario.
- **Documento** (`isValidParaguayanDocumentId`): solo verifica `/^\d{5,9}$/` — puramente dígitos, longitud 5-9. El comentario del propio código (`validation.ts:48-59`) documenta explícitamente que la cédula paraguaya **no tiene dígito verificador público** (a diferencia del RUC, que sí usa módulo 11) y que el rango 5-9 es un supuesto razonable, "no una spec oficial confirmada por Negofín todavía" (confirmado 19/8/2026 según el comentario). Es una adaptación a Paraguay, pero de rigor limitado por falta de especificación oficial, no por falta de esfuerzo de implementación.
- **Email** (`isValidEmail`): regex genérica estilo WHATWG/HTML5, sin ninguna particularidad local.
- **Duplicados** se validan en dos capas distintas con criterios distintos:
  - Cliente (`LeadFormModal.tsx`): contra los leads **locales activos del mismo usuario** en Dexie, por email exacto y por documento exacto (comparación en memoria tras desencriptar).
  - Servidor (`Lead.ts`): índice único `emailHash + userId` (duplicado de email permitido entre usuarios distintos, no dentro del mismo) e índice único disperso (`sparse`) solo por `documentIdHash`, **sin `userId`** — un mismo documento de identidad no puede repetirse en toda la colección, sin importar el vendedor. Ver brecha correspondiente abajo.
- No hay validación de prefijo de país como campo estructurado separado (RF-01 menciona "prefijo de país" como parte de la máscara) — el prefijo va embebido en el string libre de teléfono que resuelve `libphonenumber-js`, no hay un selector de país explícito en el formulario.

## Datos que toca

Entidad `Lead`, ver `src/models/Lead.ts` para el esquema completo (no se duplica aquí, solo referencia de campos relevantes a este contexto):

- **PII cifrada en MongoDB** (AES-256-CBC, getters/setters Mongoose): `firstName`, `lastName`, `email`, `documentId`, `phone`.
- **PII cifrada también en Dexie** (AES-256-GCM, cliente): los mismos cinco campos (`src/lib/client-crypto.ts:67-89`, funciones `encryptLead`/`decryptLead`).
- **`emailHash`** (SHA-256): habilita el índice único `emailHash + userId` y búsquedas sin descifrar.
- **`documentIdHash`** (SHA-256): habilita búsqueda global por DNI sin descifrar (`searchGlobalLeadByDocumentId`, en realidad implementada dentro de `searchGlobalLeads`) e índice único disperso a nivel de toda la colección.
- **`companyId`**: referencia a `Company` — este vínculo **desaparece en la migración** (ver "Disposición" abajo).
- **`scoring`**: string libre, mostrado tal cual en la UI vía `getScoringBadge`; no se recalcula en el portal (ver `01-brechas-y-decisiones.md`, punto 5).
- **Campos de control de sync**: `crmId`, `crmSynced`, `crmSyncError`, `crmLastSyncAt`, `deleted`, `tempId` (local, no persiste en Mongo).
- Localmente en Dexie (`LocalLead`, `src/lib/db.ts:24-39`) el esquema es un subconjunto simplificado, sin los campos de hash ni de sync con CRM (esos son responsabilidad exclusiva del servidor).

## Integraciones externas involucradas

- **HubSpot**, vía `ICRMProvider` (`src/lib/crm/interface.ts`, implementación real en `src/lib/crm/hubspot.ts`). En este contexto puntual (Leads/Contactos) HubSpot participa en tres puntos, **dos de ellos entrantes** (HubSpot → portal), lo cual es relevante para la decisión de sincronización unidireccional de la nueva arquitectura:
  1. **Importación inicial por dueño** (`pullServerUpdates`, `sync.ts:494-556`): al iniciar sesión/sincronizar, si el usuario tiene `crmOwnerId` mapeado, se traen todos sus leads desde HubSpot y se upsertean en MongoDB (creando o actualizando local, salvo que haya cambios locales pendientes sin sincronizar).
  2. **Búsqueda global con importación en caliente** (`searchGlobalLeads`, `sync.ts:1080-1149`): si HubSpot está online, cualquier búsqueda por DNI/nombre/email también consulta a HubSpot y **crea leads nuevos en MongoDB** a partir de resultados de HubSpot no vistos antes.
  3. **Salida** (`pushClientChanges` → motor `sync-engine.ts`, no detallado en este documento): los cambios locales (alta/edición/soft-delete) se propagan a HubSpot en segundo plano.
  - El detalle completo del contrato `ICRMProvider` y el motor de sincronización se cubre en otro documento de este mismo directorio (`integraciones-externas-actuales.md` según referencia en `01-brechas-y-decisiones.md`).

## Comportamiento offline

- **Alta y edición de contacto**: totalmente offline. Se escribe en Dexie con `tempId`/`id` y `synced: false`; no requiere red.
- **Registro de actividades** (notas, llamadas, recordatorios): offline, mismo mecanismo. La única excepción es el envío de **WhatsApp**, que requiere red porque llama a la Server Action `sendWhatsAppMessage` de forma síncrona (`LeadDrawer.tsx:311-327`) — no hay cola offline para mensajes salientes de WhatsApp.
- **Búsqueda global por DNI**: requiere estar online (`useContacts.ts:246`); offline, la búsqueda sólo filtra sobre los leads ya cacheados localmente (`filteredLeads`, coincidencia simple de substring sobre nombre/email/teléfono/documento).
- **Sincronización**: `useSync.ts`, polling cada 15s + al reconectar (`online` event) + ping de salud (`/api/health`) antes de subir, para evitar subir a un servidor inalcanzable ("Lie-Fi protection"). Sube primero (`pushClientChanges`), resuelve `tempId → id` real, luego baja (`pullServerUpdates`) con `lastSyncTime` incremental (o completo si Dexie está vacío).
- **Deduplicación al sincronizar (mecanismo real)**: cuando un lead offline (`tempId`, sin `id`) llega al servidor, `pushClientChanges` busca primero por `emailHash + userId` (`sync.ts:192-196`) — si existe, actualiza ese registro en vez de crear uno nuevo; si no, lo crea. Esta es la única barrera de deduplicación en el push; **no compara por `documentIdHash`** en esta ruta, sólo por email.
- **Riesgo de duplicación conocido**: si dos vendedores distintos (o el mismo vendedor en dos dispositivos, antes de sincronizar) dan de alta offline al mismo cliente con el **mismo documento pero distinto email** (o sin email idéntico, ej. error de tipeo), el `pushClientChanges` no detecta el choque por email y ambos leads se crean como documentos Mongo separados — hasta que el índice único disperso de `documentIdHash` (sin `userId`) haga fallar el segundo `save()` con un error de duplicado a nivel de base de datos, no manejado explícitamente en el código de `pushClientChanges` (no hay un `try/catch` específico para ese error de índice en esa ruta).

## Edge cases y comportamientos conocidos

- **Búsqueda global no filtra por propietario**: `searchGlobalLeads` busca por hash exacto en toda la colección, no solo entre los contactos del vendedor logueado — es intencional (permite detectar que un cliente ya es cliente de otro vendedor, marcado luego como "Ajeno" en la UI), pero implica que cualquier vendedor autenticado puede ubicar por DNI/email exacto a un contacto de otro vendedor.
- **Estado "Ajeno"**: un lead cuyo `userId` no coincide con el usuario en sesión se muestra con badge "Ajeno" y el drawer entra en modo estrictamente de solo lectura (ver `getLeadStatus`, `useContacts.ts:550-578`; badge en `page.tsx:62-74`).
- **Caché deslizante de 100 leads**: `purgeLocalCache` (`useSync.ts:569-629`) purga de Dexie, tras cada sync, los leads más antiguos que ya están sincronizados, sin préstamos activos y sin actualizaciones en los últimos 7 días, hasta volver a 100 o menos. Esto es puramente de caché local — no borra nada en el servidor; si luego se necesita ese lead, se vuelve a traer vía `pullServerUpdates` o búsqueda global bajo demanda.
- **Purga total al logout**: `SessionPurgeObserver` (en `providers.tsx`, no leído en detalle en esta sesión pero referenciado en `CLAUDE.md`) borra toda la IndexedDB, incluyendo todos los leads/actividades cacheados.
- **Índice único de `documentIdHash` es global, no por vendedor**: a diferencia del email (único por `emailHash + userId`), el documento de identidad es único en toda la base — refleja la realidad de negocio (una persona física real no puede tener dos cédulas), pero como se señaló arriba, el flujo offline no anticipa ese conflicto antes de intentar el `save()`.
- **Importación desde HubSpot puede asignar `'system_fallback'` como dueño**: si un lead encontrado en HubSpot durante la búsqueda global no tiene `ownerId` mapeable a ningún `User.crmOwnerId` local, se le asigna el `userId` literal `'system_fallback'` (`sync.ts:1092`) — un lead "huérfano" de dueño real hasta que alguien lo reclame o se corrija el mapeo.
- **Botón "Ver Historial Crediticio" (fix #13)**: antes de este fix, el botón abría el drawer indistintamente en la última pestaña usada (normalmente Actividades) en vez de abrir directamente en Finanzas — corregido vía `initialDrawerTab`/`setInitialDrawerTab`, que se limpia después de aplicarse una vez para no forzar la pestaña en aperturas subsiguientes del mismo drawer.
- **"Última vez contactado" (RF-05) excluye notas y tareas a propósito**: solo cuenta `CALL`, `WHATSAPP`, `EMAIL`, `MEETING` como contacto directo (`DIRECT_CONTACT_TYPES`, `useContacts.ts:646`) — una nota interna o una tarea/recordatorio no actualiza este campo, por diseño.

## Disposición en la migración

- **Traslada** (con nueva implementación técnica, dueño = servicio Leads sobre PostgreSQL):
  - Alta/edición/baja lógica de contacto con las validaciones de formato (teléfono, documento, email).
  - Registro de actividades de contacto y seguimiento, con distinción de tipos.
  - Cálculo de "última fecha de contacto" desde actividades (RF-05).
  - Vista de lista con columnas configurables (RF-04) — el mecanismo (`useConfigurableColumns` + `localStorage`) es reutilizable tal cual en el nuevo frontend si se mantiene client-side; si se quiere que la preferencia viaje entre dispositivos, requiere backend nuevo (no existe hoy).
  - `documentIdHash` como mecanismo de búsqueda/deduplicación sin exponer el documento en claro — el patrón se traslada, la implementación cambia (PostgreSQL, no Mongoose getters/setters).
  - Consulta y visualización de scoring/historial crediticio en la ficha (RF-14) — pero como llamada a una API del core financiero, no como lectura de un campo `scoring` propio ya calculado.
- **Cambia de mecanismo:**
  - Sincronización con HubSpot pasa a ser **estrictamente portal → HubSpot**. Los dos flujos entrantes descritos arriba (importación inicial por `crmOwnerId` y creación de leads nuevos durante la búsqueda global) **tal como existen hoy no son compatibles con esa regla** — HubSpot deja de ser fuente de alta de leads nuevos hacia el portal; ver brecha abajo.
  - Propiedad del dato: el contacto/prospecto pasa a tener como propietario único al servicio Leads (sección 3.5 del documento de arquitectura); HubSpot es proyección de solo lectura con "alta por lotes con clave propia" — el mecanismo actual de creación ad-hoc de leads a partir de resultados de búsqueda en HubSpot no encaja con ese modelo y debe rediseñarse (¿lote batch programado en vez de creación síncrona durante la búsqueda del vendedor?).
  - Registro offline de actividad y contacto (RF-23): se traslada el principio, pero la deduplicación real hoy es débil (dedup por email en el push, sin chequeo proactivo de `documentIdHash`) — al mudar a PostgreSQL con push/pull por servicio, conviene definir explícitamente la clave de deduplicación (¿documento? ¿email? ¿ambos con prioridad?) en vez de heredar el criterio actual.
- **Excluye:**
  - El vínculo `Lead.companyId` → `Company` desaparece: el empleador pasa a ser atributo de solo lectura desde el core (decisión ya tomada, ver punto 1 de `01-brechas-y-decisiones.md`). El selector "Empresa Asociada" del `LeadFormModal` y la columna "Empresa" de `LeadTable`/filtro por empresa de `page.tsx` no tienen equivalente en el nuevo modelo tal como está hoy.
  - El cálculo de scoring (no la consulta) — ver RF-14 arriba y punto 5 de `01-brechas-y-decisiones.md`.

## Brechas / preguntas abiertas detectadas

1. **RF-01 invierte la obligatoriedad hoy**: el requisito nuevo pide teléfono obligatorio y correo opcional si hay teléfono; la app actual exige correo y documento obligatorios y deja el teléfono opcional. Es un cambio de reglas de formulario a implementar desde cero, no una migración de lo existente.
2. **RF-03 "titularidad configurable por regla" no existe hoy**: solo está resuelta la asignación por defecto al vendedor creador. La parte de "regla configurable" es un requisito nuevo a diseñar — no hay nada que migrar, hay que definir qué reglas aplican (¿por sucursal? ¿por producto? ¿round-robin?) antes de construir el servicio Leads.
3. **RF-07 (nota de voz) no tiene ningún equivalente en el código actual** — no hay grabación de audio ni transcripción en ningún punto de la captura de actividades. Se construye enteramente nuevo.
4. **Sincronización con HubSpot hoy es genuinamente bidireccional para altas de leads** (importación inicial por owner + creación en caliente durante búsqueda global), lo cual contradice directamente la regla de "HubSpot como proyección de solo lectura" de la sección 3.5 del documento de arquitectura. Esto no está señalado como excluido en `01-brechas-y-decisiones.md` (que solo cubre el webhook entrante de *deals*, un caso distinto) — conviene una decisión explícita: ¿el flujo de "importar lead nuevo desde HubSpot al buscarlo" se descarta también, o se rediseña como el "alta por lotes con clave propia" que menciona la sección 3.5?
5. **Deduplicación débil en el flujo offline→push**: `pushClientChanges` deduplica leads nuevos solo por `emailHash + userId`, nunca por `documentIdHash`, mientras que el único índice de unicidad realmente estricto en Mongo es el de `documentIdHash` (global, sin `userId`). Esto puede producir errores de guardado no controlados explícitamente (excepción de índice duplicado sin manejo específico) cuando dos altas offline coinciden en documento pero no en email. Al diseñar el servicio Leads sobre PostgreSQL conviene decidir la clave de deduplicación canónica (probablemente documento de identidad) y manejar el conflicto explícitamente en vez de dejarlo como excepción de base de datos.
6. **Validación de documento paraguayo sin checksum oficial**: confirmado en el propio código que no existe un dígito verificador público para la cédula paraguaya (a diferencia del RUC). El rango 5-9 dígitos es un supuesto razonable pero no una especificación confirmada por Negofín — si el core financiero (SGC/Solucred) tiene una regla de validación más estricta o distinta, hay que alinear antes de portar esta validación al nuevo servicio.
7. **Preferencia de columnas configurables es local al navegador** (`localStorage`), no vinculada al usuario en el servidor — un vendedor que cambia de dispositivo no conserva su selección. No es necesariamente un defecto a resolver, pero vale confirmarlo como decisión consciente para el nuevo frontend.
8. **Falta de cola offline para WhatsApp saliente**: no es parte de RF-23 explícitamente, pero como el envío de actividad tipo `WHATSAPP` requiere red de forma síncrona, un vendedor sin conexión no puede "registrar" ese tipo de contacto directo sin conectividad — contraste a tener en cuenta si RF-23 se interpreta de forma amplia (cualquier actividad) vs. estricta (actividad como nota interna, no como envío real a un canal externo).
