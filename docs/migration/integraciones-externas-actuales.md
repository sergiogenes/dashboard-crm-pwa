# Integraciones externas actuales — insumo para la capa anticorrupción (arquitectura nueva)

> Alcance: este documento describe el estado real del código en `dashboard-crm` (rama `feature/feedback-13-fix-credit-history-button`, base `main`/`develop`) al 2026-08-21, como insumo para diseñar los adaptadores de la ACL (Anti-Corruption Layer) sobre HubSpot, Infobip y — a futuro — SGC/Solucred/proveedor de inferencia. No describe el diseño nuevo; señala explícitamente dónde ese diseño nuevo diverge de lo que hay hoy.

---

## HubSpot (CRM)

### Contrato `ICRMProvider`

Definido en `src/lib/crm/interface.ts`. Es la interfaz que hoy desacopla la capa de dominio (Server Actions, `sync-engine.ts`, webhook entrante) del proveedor de CRM concreto. Cualquier implementación (`HubSpotProvider`, `MockCRMProvider`, el descartado `SalesforceProvider`) debe cumplirla completa.

Tipos de datos transportados (DTOs neutrales, sin nada específico de HubSpot):
- `CRMLead` — `crmId?`, `firstName`, `lastName`, `email`, `phone?`, `ownerId?`, `scoring?`, `documentId?`
- `CRMCompany` — `crmId?`, `name`, `domain?`
- `CRMInvoice` — `crmId?`, `amount`, `balanceDue?`, `status: 'PAID'|'PENDING'|'OVERDUE'`, `invoiceDate`, `dueDate`, `paymentDate?` (fechas en ISO string)
- `CRMActivity` — `crmId?`, `type: 'NOTE'|'CALL'|'MEETING'|'EMAIL'|'TASK'|'WHATSAPP'`, `title`, `body`, `timestamp`, `reminderDate?`, `reminderRead?` (deprecado), `reminderStatus?: 'active'|'waiting'|'completed'`, `reminderPriority?: 'LOW'|'MEDIUM'|'HIGH'`
- `CRMDeal` — `crmId?`, `name`, `amount`, `stage` (string ya mapeado al vocabulario del CRM), `description?`, `closedDate?`, `ownerId?`

Métodos del contrato, agrupados por función:

**Escritura (upsert / delete)**
- `upsertLead(lead)` → `Promise<string>` — crea o actualiza un contacto; si no trae `crmId`, la implementación debe buscar duplicados (hoy por email) antes de crear.
- `upsertCompany(company)` → `Promise<string>` — igual, pero busca duplicados por dominio.
- `upsertDeal(deal)` → `Promise<string>`.
- `createActivity(leadCrmId, activity)` → `Promise<string>` — crea o actualiza (si `activity.crmId` está presente) una actividad asociada a un contacto.
- `deleteLead(crmId)`, `deleteCompany(crmId)`, `deleteDeal(crmId)`, `deleteActivity(crmId, type?)` → `Promise<void>` — borrado/archivado real en el CRM. `type` es necesario porque el objeto físico en HubSpot difiere según el tipo lógico de actividad (nota, tarea, comunicación).
- `associateLeadWithCompany(leadCrmId, companyCrmId)`, `associateDealWithLead(dealCrmId, leadCrmId)` → `Promise<void>`.

**Lectura**
- `fetchLeadsByOwner(ownerId)` → `Promise<CRMLead[]>`
- `fetchAllCompanies()` → `Promise<CRMCompany[]>`
- `fetchOwnerIdByEmail(email)` → `Promise<string | undefined>`
- `searchLeads(query)` → `Promise<CRMLead[]>`
- `fetchInvoicesByLead(leadCrmId)` → `Promise<CRMInvoice[]>`
- `fetchInvoiceById(invoiceCrmId)` → `Promise<CRMInvoice | null>`
- `fetchActivitiesByLead(leadCrmId)` → `Promise<CRMActivity[]>`
- `fetchDealsByLead(leadCrmId)` → `Promise<CRMDeal[]>`
- `fetchLeadIdAssociatedWithInvoice(invoiceCrmId)` → `Promise<string | null>`
- `fetchLeadIdAssociatedWithDeal(dealCrmId)` → `Promise<string | null>`

**Salud / webhook**
- `checkHealth()` → `Promise<boolean>`
- `verifyAndParseWebhook(req, rawBody)` → `Promise<ParsedCRMWebhookEvent[] | null>` — valida firma y normaliza el payload del proveedor a un vocabulario propio (`ParsedCRMWebhookEvent`, con `subscriptionType` genérico: `lead.upsert`, `lead.deletion`, `company.upsert`, `company.deletion`, `invoice.upsert`, `invoice.deletion`, `deal.upsert`, `deal.deletion`, `association.creation`, `association.deletion`).

**Observación de diseño relevante para la ACL:** el contrato ya fuerza que toda lectura de "¿a qué contacto pertenece este objeto?" pase por un método explícito (`fetchLeadIdAssociatedWith*`) en vez de que el llamador arme la consulta contra el proveedor. Esto es exactamente el patrón de "resolver contra tabla de mapeo/adaptador, nunca contra el buscador del CRM directamente desde el caso de uso" que pide la arquitectura nueva — aunque hoy el propio adaptador SÍ llama al buscador nativo de HubSpot puertas adentro (ver más abajo), el contrato no obliga a los consumidores a saberlo.

### Implementación real (`hubspot.ts`)

**Autenticación:** Bearer token estático (`HUBSPOT_ACCESS_TOKEN`, inyectado en el constructor por `CRMProviderFactory`). No hay OAuth con refresh de token ni rotación — es un Private App Token de larga duración. Header fijo: `Authorization: Bearer <token>`, `Content-Type: application/json`.

**Cliente HTTP:** un único método privado `request<T>(endpoint, options)` centraliza todas las llamadas. Resuelve la URL base según el prefijo del endpoint (`/crm/v4/...` va contra la raíz de la API v4; `/owners` contra `crm/v3`; el resto contra `crm/v3/objects`). Trata 204 como éxito con cuerpo vacío; cualquier `!response.ok` lanza `Error` con el status y el texto crudo de la respuesta embebidos en el mensaje (no hay un tipo de error estructurado — el resto del código hace parsing de mensajes con regex/`includes('404')`, ver más abajo).

**Límites de cuota / rate-limit: no hay manejo explícito.** No hay lectura de headers `X-HubSpot-RateLimit-*`, no hay backoff, no hay cola ni límite de llamadas por segundo del lado del adaptador. El único tratamiento de cuota ocurre un nivel arriba, en `sync-engine.ts`, que clasifica un HTTP 429 recibido como "error transitorio" y aborta el resto del lote para reintentar en el próximo ciclo (ver sección siguiente) — pero eso es reactivo (después de pegarle a la cuota), no un control proactivo que reserve capacidad. **Esto es exactamente el hueco que la arquitectura nueva cierra con el contador distribuido compartido por réplicas.**

**Batching: no existe.** Todas las escrituras son llamada por objeto (`POST`/`PATCH` individual por contacto, empresa, deal, actividad). Los métodos que traen colecciones (`fetchDealsByLead`, `fetchActivitiesByLead`, `fetchInvoicesByLead`) también resuelven cada asociación con una llamada N+1: primero piden los IDs asociados y después piden el detalle de cada uno en un loop secuencial (`for...of` con `await` dentro). No se usa el endpoint de batch de HubSpot (`/crm/v3/objects/{type}/batch/*`, hasta 100 objetos por lote) en ningún punto. **Esto es una brecha directa contra el requisito de "lotes de hasta 100 objetos" de la arquitectura nueva.**

**Resolución de duplicados:** `upsertLead` y `upsertCompany`, cuando no reciben `crmId`, llaman al buscador nativo de HubSpot (`/contacts/search`, `/companies/search`) por email o dominio antes de crear. Si la creación falla porque el email ya existe (carrera con el índice de búsqueda de HubSpot, que tiene delay), `upsertLead` parsea el mensaje de error con una regex (`/(\d+)\s+already has that value/`) para extraer el ID existente y reintenta como update. Esto es justamente el patrón que la arquitectura nueva prohíbe ("resolución de identificadores contra tabla de mapeo local, nunca contra el buscador del CRM") — hoy se resuelve contra el buscador de HubSpot, con un parche manual (regex sobre texto de error) para el caso límite de índice desactualizado.

**Mapeo de etapas de Deal:** `mapStageToHubSpot` traduce el vocabulario local (`draft`, `under_evaluation`, `approved`, `disbursed`, `completed`, `refused`, `overdue`) a las etapas nativas de un pipeline HubSpot (`appointmentscheduled`, `decisionmakerbought-in`, `contractsent`, `closedwon`, `closedlost`). Es un mapeo con pérdida: `disbursed` y `completed` colapsan a `closedwon`; `refused` y `overdue` colapsan a `closedlost`. Para no perder la sub-etapa local, el motor de sincronización empaqueta el estado exacto (`termMonths`, `interestRate`, `localStage`) en un comentario HTML embebido en la propiedad `description` del deal (`<!-- loan_metadata:{...} -->`), que se vuelve a parsear al leer el deal de vuelta desde HubSpot.

**Facturas (Custom Object):** si `HUBSPOT_INVOICE_OBJECT_TYPE_ID` no está configurado, `fetchInvoicesByLead`/`fetchInvoiceById` devuelven datos **sintéticos deterministas** (hash del `leadCrmId`) en vez de fallar — pensado para demo/desarrollo sin el Custom Object provisionado, pero es un modo silencioso: nada distingue en runtime "estoy mostrando datos reales" de "estoy mostrando datos inventados" salvo mirar si la env var existe. Cuando el object type sí está configurado, el código prueba una lista larga de nombres de propiedad alternativos por campo (`hs_amount_billed`, `amount_billed`, `hs_total_amount_billed`, ...) porque el nombre real depende de cómo se haya definido el Custom Object en el portal de HubSpot — no hay un esquema fijo.

**Actividades:** `createActivity`/`fetchActivitiesByLead`/`deleteActivity` distinguen tres objetos físicos de HubSpot detrás de un único concepto lógico ("actividad"): `TASK` (tareas nativas, con mapeo de estado 3 valores propio ↔ 4 valores de HubSpot: `NOT_STARTED`/`WAITING`/`IN_PROGRESS`/`DEFERRED`/`COMPLETED`), `NOTE` (notas, con un `type` codificado dentro del HTML del cuerpo vía un prefijo `[📞 Llamada]`/`[🤝 Reunión]`/etc. parseado con regex al leer), y `WHATSAPP` (Communications, `hs_communication_channel_type = WHATS_APP`). El borrado sin `type` conocido hace fallback probando los tres endpoints en cascada.

**Errores no tipados:** en toda la clase, los errores de red/API se propagan como `Error` genérico con el mensaje crudo de HubSpot embebido en el string. El código que los consume (sync-engine, webhook) distingue "transitorio" de "permanente" mirando `error.status` (que en la práctica nunca se setea explícitamente en el `Error` lanzado por `request()` — es un campo que otros catch más arriba esperan pero `request()` no asigna) o haciendo `error.message?.includes('404')` / `.includes('fetch')` / `.includes('ENOTFOUND')`. **Esto es frágil: la clasificación de errores hoy depende de substrings de mensaje, no de un tipo de error estructurado con código HTTP y clase (transitorio/permanente) explícitos.** La ACL nueva debería normalizar esto a una jerarquía de errores propia en el adaptador.

### Motor de sincronización outbound (`sync-engine.ts`)

Función única `syncMongoDBToCRM()`, invocada de forma "fire-and-forget" (sin await del resultado) desde dos puntos de `sync.ts`: al final de `pushClientChanges` (cada vez que el cliente sube cambios) y al final de `pullServerUpdates` (como "autosanación" en cada polling, incluso si no hubo cambios entrantes).

**Cómo decide qué sincronizar:** consulta MongoDB por `crmSynced: false` en cada colección (`Company`, `Lead`, `Activity`, `Deal`), sin límite de tamaño de lote ni orden de prioridad explícito salvo el orden fijo de fases: **A. Empresas → B. Leads → C. Actividades → D. Deals** (documentado en el propio código como necesario para consistencia relacional: un lead necesita el `crmId` de su empresa para asociarse, una actividad/deal necesita el `crmId` de su lead). Dentro de cada fase, itera los documentos pendientes con un `for...of` secuencial — un objeto a la vez, sin paralelismo ni batch.

**Guarda de consistencia previa:** antes de tocar el CRM, compara si el nombre de la base Mongo conectada contiene `"test"` contra si `IS_PLAYWRIGHT_TEST` está activo, y aborta toda la sincronización si no coinciden — para no operar contra HubSpot real con un entorno de test mal configurado (o viceversa). Es una salvaguarda puntual nacida de un incidente (comentario in-code lo referencia), no un mecanismo general de entorno/tenant.

**Semáforo anti-concurrencia:** variable de módulo `isSyncing` (booleano en memoria del proceso Node) evita que dos invocaciones se pisen dentro de la misma instancia. **No hay lock distribuido** — en un despliegue con más de una réplica (o serverless con múltiples instancias frías), dos procesos pueden correr `syncMongoDBToCRM()` en paralelo sin coordinación entre sí. Esto es relevante para el "contador de cuota compartido por todas las réplicas" que exige la arquitectura nueva: hoy ni siquiera hay coordinación de *ejecución* entre réplicas, y mucho menos de cuota.

**Verificación de salud previa:** llama a `crm.checkHealth()` antes de procesar cualquier cosa; si el CRM no responde, loguea y postpone todo el ciclo (no marca nada como error, simplemente no hace nada y confía en el próximo trigger).

**Manejo de errores y reintentos:** por cada documento, un `try/catch` clasifica el error:
- **Transitorio** (status `429`, cualquier `5xx`, o el mensaje incluye `'fetch'`/`'ENOTFOUND'`): se hace `return` inmediato — **corta todo el resto de la fase y las fases siguientes**, dejando la sincronización de ese ciclo incompleta. No hay backoff exponencial, no hay reintento inmediato ni contador de reintentos: el "reintento" es, en la práctica, el próximo trigger natural (polling de 15s del cliente, o el próximo push). No hay límite de reintentos ni cola de dead-letter — un objeto que siempre falla de forma transitoria queda reintentándose indefinidamente en cada ciclo.
- **Permanente** (cualquier otro error, ej. validación de HubSpot): se marca `crmSynced: true` igual (para no bloquear la cola) pero se persiste el mensaje crudo en `crmSyncError` — queda "sincronizado" a efectos de la cola aunque en rigor nunca llegó al CRM. No hay alerta ni proceso que revise `crmSyncError` salvo inspección manual de la base.

**Resiliencia puntual documentada en comentarios (hallazgos de incidentes reales, no diseño):**
- Si la asociación lead↔empresa falla con 404 (la empresa fue borrada en HubSpot), se limpia el `crmId` local de la empresa y se la marca `crmSynced: false` para que se recree en el próximo ciclo.
- Para deals: si un deal local sincronizado ya no aparece en las asociaciones del contacto en HubSpot, el motor de **lectura** (`syncDealsForLead`, en `sync.ts`, invocado también desde el webhook) intenta re-asociarlo antes de asumir que fue borrado, y solo lo marca `deleted` si HubSpot confirma 404 explícito. Esto nació de un bug real (deals reales borrados por una falsa detección de "huérfano" — ver memoria `project_deal_webhook_sync`).

**Trigger:** no hay cron ni cola de mensajes — es puramente reactivo a la actividad del cliente (cada `pushClientChanges` y cada `pullServerUpdates`, es decir, cada ciclo de polling de 15s de `useSync.ts` mientras haya al menos un usuario activo con la PWA abierta). Si no hay ningún cliente sincronizando, el motor simplemente no corre, sin importar cuántos documentos con `crmSynced: false` haya acumulados.

### Webhook entrante (`route.ts`) — REFERENCIA, se descontinúa en la nueva versión

`src/app/api/webhooks/crm/route.ts`, `POST` único. Bajo la decisión de migración de sincronización **estrictamente unidireccional** (portal → HubSpot), este componente completo queda excluido de la nueva versión. Se documenta igual porque la validación de firma es reutilizable como referencia técnica si en el futuro se necesitara validar webhooks de otro proveedor.

**Validación de firma:** delegada a `crm.verifyAndParseWebhook(req, rawBody)` (parte del contrato `ICRMProvider`, implementada en `hubspot.ts`). Soporta las tres versiones de firma de HubSpot, evaluadas en orden de preferencia pero aceptando cualquiera que valide:
- **V3** (`x-hubspot-signature-v3` + `x-hubspot-request-timestamp`): HMAC-SHA256 en base64 sobre `method + uri + rawBody + timestamp`, usando `HUBSPOT_CLIENT_SECRET`.
- **V2** (`x-hubspot-signature`): SHA-256 hex sobre `secret + method + uri + rawBody`.
- **V1** (mismo header): MD5 hex sobre `secret + rawBody` (fallback legado).
- Si `HUBSPOT_CLIENT_SECRET` no está seteado, **no se valida nada** (modo inseguro, presumiblemente solo para desarrollo local con tunneling).
- Si ninguna de las tres válida, el endpoint responde `401` sin procesar nada.

**Eventos que procesa** (`ParsedCRMWebhookEvent.subscriptionType`, normalizados desde el `subscriptionType` nativo de HubSpot `contact.*`/`company.*`/`deal.*`/`invoice.*`/`custom_object.*`/`association.*`):
- `lead.upsert` / `lead.deletion` — crea o actualiza el `Lead` local por `crmId` (o por email si no hay match de `crmId` y la propiedad cambiada fue `email`); aplica el cambio de una sola propiedad (`propertyName`/`propertyValue`) recibido en el evento, no el objeto completo. Ignora el evento si el lead ya está marcado `deleted` localmente.
- `company.upsert` / `company.deletion` — análogo para `Company`.
- `invoice.upsert` / `invoice.deletion` — para upsert, en vez de aplicar solo la propiedad notificada, **vuelve a pedir el objeto completo** con `fetchInvoiceById` (comentario in-code: así el webhook solo necesita avisar qué ID cambió, sin arriesgarse a perder información si un evento intermedio no llegó) y recalcula el `scoring` del lead asociado (`A/B/D` según haya facturas `OVERDUE`/`PENDING`/ninguna).
- `deal.upsert` / `deal.deletion` — para upsert, resuelve el lead dueño (por relación local o preguntándole al CRM `fetchLeadIdAssociatedWithDeal`) y reutiliza `syncDealsForLead` (la misma rutina que usa el polling normal) con `bypassRecencyGuard: true` para forzar la reescritura aunque haya habido un cambio local reciente — el webhook, al venir de una acción real en el CRM, se trata como fuente de verdad inmediata.
- `association.creation` / `association.deletion` — vincula/desvincula `lead.companyId` en Mongo cuando HubSpot notifica una asociación contact↔company creada o borrada.

No hay verificación de idempotencia explícita a nivel de evento (ej. un `eventId` deduplicado) — los upserts son naturalmente idempotentes por `findOneAndUpdate`, pero los `deleteOne` en `lead.deletion`/`company.deletion`/`deal.deletion` son borrados **físicos** (no soft-delete) del documento local, disparados directamente por la notificación del CRM externo sin trazabilidad de auditoría (contrasta con `pushClientChanges`, que sí deja un log `[AUDIT]` de todo soft-delete iniciado desde el cliente).

### Reconciliación — ¿existe hoy? (brecha confirmada)

**No existe ningún proceso de reconciliación periódica/nocturna.** Se revisó `sync-engine.ts`, `sync.ts` y el webhook completos: no hay job programado (no hay cron, no hay `node-cron`, no hay Vercel Cron Job configurado en el repo para este propósito), no hay comparación de conteos ni checksums entre MongoDB y HubSpot, y no hay reporte de desvíos.

Lo más parecido que existe es:
1. La reimportación completa en `pullServerUpdates` cuando `lastSyncTime === 0` o las colecciones locales están vacías (carga inicial / "primera sincronización"), que trae todo de HubSpot a Mongo pero no compara ni reporta diferencias — solo llena lo que falta.
2. Las funciones `syncInvoicesForLead`/`syncActivitiesForLead`/`syncDealsForLead`, invocadas por cada lead activo en cada `pullServerUpdates` (si tiene `updatedAt` reciente) y también desde `getGlobalLeadDetails` — que sí comparan el conjunto de IDs traídos de HubSpot contra lo que hay en Mongo para ese lead puntual (marcando `deleted: true` lo que ya no está en HubSpot), pero es **por lead, bajo demanda**, no un barrido completo de la base ni corre en horario nocturno, y no produce ningún reporte de desvíos — solo corrige silenciosamente el estado local de ese lead.

Esta ausencia coincide con lo que el prompt de la nueva arquitectura ya anticipaba como "brecha probable": el trabajo nocturno de reconciliación con checksums/conteos por ventana temporal es un requisito nuevo, no una evolución de algo existente.

---

## Infobip (WhatsApp)

### Contrato `IMessagingProvider`

Definido en `src/lib/messaging/interface.ts`, deliberadamente más chico que `ICRMProvider`:
- `sendMessage(to, body, options?)` → `Promise<SendMessageResult>` — `options` opcional (`templateName`, `language`, `placeholders`) para envío por plantilla homologada vs. texto libre. `SendMessageResult` es `{ success, messageId?, error? }` (nunca lanza excepción, siempre resuelve con éxito/fracaso explícito).
- `getTemplates?()` → método **opcional** del contrato (marcado con `?`), devuelve la lista de plantillas homologadas disponibles con sus placeholders detectados.
- `parseWebhook(req, rawBody)` → `Promise<ParsedWebhookMessage[]>` — normaliza el payload entrante del proveedor a `{ messageId, fromPhone, body, timestamp }`.

No expone `verifyAndParseWebhook` con validación de firma como el de CRM — ver más abajo, el webhook de Infobip **no valida firma ni secreto** en absoluto.

### Implementación real (`infobip.ts`)

**Autenticación:** header `Authorization: App <INFOBIP_API_KEY>` (API Key estática de Infobip, no OAuth). Base URL configurable por env var (`INFOBIP_BASE_URL`), con normalización defensiva (agrega `https://` si falta, quita `/` finales).

**Envío de mensajes:** dos modos sobre el mismo método `sendMessage`, resueltos por la presencia de `options.templateName`:
- Sin plantilla → `POST /whatsapp/1/message/text` (mensaje de texto libre, solo válido dentro de la ventana de 24h con mensaje entrante previo — ver más abajo).
- Con plantilla → `POST /whatsapp/1/message/template`, con `templateData.body.placeholders` como array posicional.
- El número destino se sanea con una regex que quita `+`, espacios y guiones (Infobip espera formato internacional puro sin símbolos).

**Plantillas:** `getTemplates()` llama a `GET /whatsapp/2/senders/{senderNumber}/templates`, filtra a `status === 'APPROVED'` y `structure.type === 'TEXT'` (evita enviar tipos de plantilla no soportados por este flujo, ej. plantillas con botones/medios, que producirían el error 7009 de Infobip), y extrae los placeholders `{{1}}`, `{{2}}`... vía regex sobre el texto para inferir cuántas variables completar.

**Límites de cuota:** no hay ningún manejo de rate-limit en este adaptador (ni lectura de headers, ni cola, ni backoff) — igual que en HubSpot.

### Webhook entrante — ventana de 24hs, tipos de mensaje

`src/app/api/webhooks/whatsapp/route.ts`. Recibe notificaciones de mensajes entrantes de Infobip, delegando el parseo a `provider.parseWebhook()` (implementación genérica vía `IMessagingProvider`, no hay lógica de Infobip hardcodeada en la ruta).

**Sin validación de firma:** a diferencia del webhook de HubSpot, este endpoint no valida ningún secreto compartido ni firma HMAC — cualquiera que conozca la URL puede publicar mensajes falsos como si vinieran de un lead real. No hay `INFOBIP_WEBHOOK_SECRET` ni verificación equivalente en el código.

**Resolución del contacto:** busca el `Lead` cuyo teléfono (limpio de no-dígitos) coincida por sufijo con el remitente del mensaje (`endsWith` en ambas direcciones), para tolerar diferencias de código de país entre lo guardado localmente y lo que reporta Infobip. Si no hay match, descarta el mensaje con un warning (no hay cola de "mensajes huérfanos" para revisar manualmente).

**Idempotencia:** usa `tempId = whatsapp_${messageId}` y comprueba existencia antes de insertar, para tolerar reintentos de entrega del proveedor.

**Persistencia:** cada mensaje entrante se guarda como `Activity` tipo `WHATSAPP`, título fijo `"WhatsApp Recibido"`, con `crmSynced: false` — es decir, se sube a HubSpot como Communication en el próximo ciclo del motor outbound, igual que cualquier otra actividad.

**Ventana de 24 horas:** no se calcula en el backend/webhook, sino en el cliente, en `src/components/contacts/LeadDrawer.tsx`. Se toma la última actividad `WHATSAPP` con título `"WhatsApp Recibido"` (ordenada por `timestamp` descendente) y se compara `Date.now() - timestamp` contra `24 * 60 * 60 * 1000`. Si está dentro de la ventana, la UI habilita el envío de texto libre; si no, obliga a usar una plantilla homologada. Este cálculo es puramente de presentación — el backend (`whatsapp.ts` / `infobip.ts`) no impide enviar texto libre fuera de ventana; si se intentara, sería el propio Infobip/Meta quien lo rechazaría del lado del proveedor.

**Tipos de mensaje soportados:** el parser de Infobip (`parseWebhook`) solo procesa `message.type === 'TEXT'` — mensajes con imágenes, audio, documentos u otros tipos de contenido de WhatsApp se ignoran silenciosamente (no hay rama de manejo ni de error para ellos).

### Estado: documentado, fuera de alcance de la primera versión de la migración

Por decisión de migración, esta integración (chat WhatsApp vía Infobip) queda completa y funcionando en la versión actual, pero **fuera del alcance de la primera versión de la migración** a BFF + microservicios — se retoma en un incremento posterior. La ACL para el BSP de WhatsApp debería, en ese incremento, resolver como mínimo lo que hoy falta: validación de firma del webhook (hoy inexistente) y manejo de tipos de mensaje distintos de texto.

---

## Salesforce (descartado)

Existe hoy un adaptador alternativo (`src/lib/crm/salesforce.ts`) implementando `ICRMProvider`, y `CRMProviderFactory` lo instancia bajo `CRM_PROVIDER=salesforce`. Fue una integración en desarrollo, nunca puesta en producción, y **se descarta**: HubSpot es el CRM confirmado para la migración. Ya está documentada en detalle en la memoria del proyecto (`project_salesforce_integration.md` — auth y esquema resueltos, faltaba trigger Apex + prueba end-to-end de webhooks de facturas). Este código (`salesforce.ts` y la rama `case 'salesforce'` de `factory.ts`) queda marcado como candidato a retiro; no se invierte más tiempo documentándolo acá.

---

## Patrón de diseño a preservar

El código actual ya implementa, para ambas integraciones (CRM y mensajería), el patrón **adaptador + fábrica intercambiable**:

- Una interfaz de dominio neutral (`ICRMProvider`, `IMessagingProvider`) que no expone ningún detalle del proveedor concreto — ni nombres de propiedades de HubSpot, ni formato de payload de Infobip.
- Implementaciones concretas intercambiables (`HubSpotProvider`/`MockCRMProvider`/`SalesforceProvider`; `InfobipMessagingProvider`/`MockMessagingProvider`) que traducen entre el vocabulario propio y el del proveedor externo.
- Una fábrica (`CRMProviderFactory`, `MessagingProviderFactory`) que resuelve qué implementación instanciar según configuración de entorno (`CRM_PROVIDER`, `NEXT_PUBLIC_MESSAGING_PROVIDER`, o el flag de test `IS_PLAYWRIGHT_TEST`), con una única instancia compartida en el proceso (via `globalThis` en el caso del CRM, específicamente para evitar sesiones concurrentes duplicadas entre las distintas capas de compilación de Next.js).
- Los mocks en memoria (`MockCRMProvider`, `MockMessagingProvider`) permiten correr toda la lógica de dominio y los tests E2E sin tocar servicios externos reales.

Este es conceptualmente el mismo patrón que la arquitectura nueva exige para la ACL sobre todo sistema externo (SGC, Solucred, HubSpot, BSP de WhatsApp, proveedor de inferencia del agente): interfaz de dominio propia, un único punto autorizado a hablar con el proveedor, e implementación intercambiable sin tocar los casos de uso. **Vale la pena preservar la forma del patrón al reescribir en NestJS** (module/provider inyectable detrás de una interfaz de puerto, con un `Adapter` real y uno `Mock`/`Fake` para tests), aunque el código en sí no sea reutilizable (es TypeScript de Next.js/Mongoose, no NestJS, y carece de control de cuota, batching y tipado de errores que la nueva ACL exige desde el diseño). Ningún componente hoy centraliza cuota entre réplicas — eso es diseño nuevo puro, no una evolución de algo existente.

---

## Brechas / preguntas abiertas detectadas

1. **No existe control de cuota centralizado.** Ni HubSpot ni Infobip tienen manejo proactivo de rate-limit (lectura de headers, contador, cola). El único mecanismo es reactivo: un 429 se clasifica como error transitorio en `sync-engine.ts` y aborta el resto del lote hasta el próximo ciclo. No hay contador compartido entre réplicas (ni siquiera hay más de un proceso hoy realmente concurrente, dado el semáforo en memoria `isSyncing`).
2. **No existe reconciliación nocturna ni ningún job programado.** Confirmado tras revisar el motor completo — es la brecha más directa contra un requisito explícito de la arquitectura nueva (sección 3.7). Lo más cercano es una reimportación completa solo en el primer sync de cada usuario, y una comparación de IDs por-lead bajo demanda (sin reporte de desvíos).
3. **No hay batching de escrituras a HubSpot.** Todas las operaciones son un objeto por llamada HTTP, incluyendo llamadas N+1 al leer colecciones asociadas (deals, actividades, facturas de un lead). Migrar a lotes de hasta 100 objetos es un cambio de implementación real, no solo de infraestructura.
4. **La resolución de duplicados hoy consulta el buscador nativo del CRM** (`/contacts/search`, `/companies/search`), exactamente lo que la arquitectura nueva prohíbe; además tiene un parche por regex sobre mensajes de error para el caso de índice de búsqueda desactualizado en HubSpot. La ACL nueva necesita una tabla de mapeo local real (no la tiene hoy más allá del campo `crmId` por documento) como única fuente de verdad para idempotencia de creación.
5. **Errores no tipados:** la clasificación transitorio/permanente depende de inspeccionar substrings de `error.message` (`'404'`, `'fetch'`, `'ENOTFOUND'`) porque `HubSpotProvider` nunca asigna `error.status` en las excepciones que lanza — es un contrato implícito roto entre quien lanza y quien captura.
6. **El webhook de WhatsApp/Infobip no valida firma** (a diferencia del de HubSpot, que sí soporta V1/V2/V3) — cualquiera que conozca la URL puede inyectar mensajes falsos. Como esta integración queda fuera del alcance de la primera versión de la migración, esto se documenta pero no se resuelve en este incremento — el futuro adaptador del BSP debería cerrarlo.
7. **Borrados físicos disparados por webhook externo:** `lead.deletion`/`company.deletion`/`deal.deletion` entrantes desde HubSpot hacen `deleteOne` directo en MongoDB, sin trazabilidad de auditoría (contrasta con el soft-delete + log `[AUDIT]` que sí existe cuando el borrado se origina en el cliente vía `pushClientChanges`). Al volverse la sincronización estrictamente unidireccional, este riesgo desaparece junto con el webhook — se señala solo como antecedente a no repetir si en algún incremento futuro se reconsiderara algún camino de entrada.
