# Modelo de datos actual — insumo para diseño de esquemas PostgreSQL por servicio

> Fuente: código de `dashboard-crm` (rama `feature/feedback-13-fix-credit-history-button`) a fecha 2026-08-21.
> Objetivo: servir de insumo al diseño de esquemas PostgreSQL independientes por microservicio (una base por servicio, sin acceso cruzado), en el marco de la migración a arquitectura BFF + NestJS/PostgreSQL + bus de eventos definida por Negofin.

---

## Entidades (Mongoose / MongoDB)

Todas las colecciones usan `{ timestamps: true }` (Mongoose agrega `createdAt`/`updatedAt` automáticamente como `Date`). Todas las entidades de negocio (`Lead`, `Company`, `Deal`, `Activity`) comparten el mismo patrón de campos de control de sincronización con el CRM externo (ver sección dedicada más abajo).

### User
Archivo: `src/models/User.ts`

| Campo | Tipo | Notas |
|---|---|---|
| `_id` | ObjectId | PK Mongo |
| `name` | String | opcional |
| `email` | String | único, indexado — **no está cifrado** (sin getter/setter `encrypt`/`decrypt`) |
| `passwordHash` | String | requerido |
| `crmOwnerId` | String | ID del "owner" en el CRM externo (HubSpot) |
| `twoFactorEnabled` | Boolean | MFA obligatorio en la app |
| `twoFactorSecret` | String | secreto TOTP (otplib) — **no está cifrado en este modelo** |
| `twoFactorBackupCodes` | String[] | códigos de respaldo MFA |
| `roles` | String[] enum `admin`\|`supervisor`\|`user` | multi-rol |
| `supervisorId` | String, indexado | referencia informal (no `ref` de Mongoose, es un string) al `_id` del supervisor — modela la jerarquía vendedor→supervisor |
| `disbursementGoal` | Number | meta de desembolso del vendedor, default 100000 |
| `dbEncryptionKey` | String | clave de cifrado de cliente (Dexie/AES-GCM) del usuario; se inyecta en el JWT de NextAuth, nunca se persiste en disco del cliente |
| `createdAt` / `updatedAt` | Date | timestamps Mongoose |

**PII:** `email`, `twoFactorSecret` no están cifrados a nivel de campo (a diferencia de `Lead`/`Activity`). Es una inconsistencia respecto al resto del modelo — ver brechas.
**Relaciones:** `supervisorId` → `User._id` (jerarquía, sin `ref` real de Mongoose, es texto libre).
**Sin campos de control de sync CRM** (no tiene `crmId`/`crmSynced`/`deleted`/`tempId`) — los usuarios no se sincronizan como entidad CRM, solo `crmOwnerId` los asocia a un owner de HubSpot.

### Lead
Archivo: `src/models/Lead.ts`

| Campo | Tipo | Notas |
|---|---|---|
| `_id` | ObjectId | PK |
| `firstName`, `lastName`, `email`, `phone`, `documentId` | String | **PII cifrada en servidor** (AES-256-CBC vía getters/setters `encrypt`/`decrypt` de `src/lib/crypto.ts`) |
| `emailHash` | String, indexado | SHA-256 de `email` normalizado (trim + lowercase), poblado automáticamente en middleware `pre('validate')` y `pre('findOneAndUpdate')` |
| `documentIdHash` | String | SHA-256 de `documentId`, mismo mecanismo; permite búsqueda por DNI sin descifrar (`searchGlobalLeadByDocumentId`) |
| `companyId` | ObjectId, `ref: 'Company'` | nullable |
| `userId` | String, indexado | vendedor propietario (referencia informal a `User`, no `ObjectId`) |
| `deleted` | Boolean, indexado | soft delete |
| `scoring` | String | **campo calculado** (ver "Brechas") — clasificación crediticia (`A - Excelente`, `B - Bueno`, `D - Deudor`) derivada de las facturas (`Invoice`) del lead, recalculada en `syncInvoicesForLead` (`src/app/actions/sync.ts`) cada vez que se sincronizan facturas del CRM |
| `crmId`, `crmSynced`, `crmSyncError`, `crmLastSyncAt` | control de sync CRM | ver sección dedicada |
| `createdAt` / `updatedAt` | Date | |

**Índices únicos:** `{ emailHash: 1, userId: 1 }` único (un mismo vendedor no puede tener dos leads con el mismo email); `{ documentIdHash: 1 }` único disperso (DNI único a nivel global, ignorando documentos vacíos).
**Relaciones:** `companyId` → `Company` (a retirar, ver abajo); `userId` → `User` (dueño/vendedor asignado).
**Nota de migración:** `scoring` se descarta como campo persistido — la nueva arquitectura consulta el score por API al core crediticio en tiempo real, no se almacena ni se recalcula localmente en el servicio Leads.

### Company (A RETIRAR — no se traslada)
Archivo: `src/models/Company.ts`

| Campo | Tipo | Notas |
|---|---|---|
| `_id` | ObjectId | PK |
| `name` | String, requerido | **no cifrado** (no es PII de persona física) |
| `domain` | String | opcional |
| `userId` | String, indexado | vendedor propietario |
| `deleted` | Boolean, indexado | soft delete |
| `crmId`, `crmSynced`, `crmSyncError`, `crmLastSyncAt` | control de sync CRM | idéntico patrón a Lead/Deal/Activity |
| `createdAt` / `updatedAt` | Date | |

**Relaciones:** referenciada por `Lead.companyId`.
**Decisión de migración:** esta entidad **se retira completamente** en la nueva arquitectura. No se traslada a ningún microservicio ni se migran sus datos. Se documenta aquí solo por completitud histórica del modelo actual. Su retiro implica que `Lead.companyId` tampoco debe trasladarse (o debe reemplazarse por un campo de texto libre "empresa" si el negocio aún necesita ese dato, a decidir en el diseño del servicio Leads).

### Deal
Archivo: `src/models/Deal.ts`

| Campo | Tipo | Notas |
|---|---|---|
| `_id` | ObjectId | PK |
| `crmId` | String, único disperso | id en HubSpot |
| `tempId` | String, único disperso | UUID local para deduplicar creaciones offline |
| `leadId` | ObjectId, `ref: 'Lead'`, requerido | contacto asociado a la solicitud |
| `userId` | String, requerido | vendedor propietario |
| `name` | String, requerido | ej. "Crédito Juan Pérez" |
| `amount` | Number, requerido | monto solicitado |
| `termMonths` | Number, requerido | plazo en meses |
| `interestRate` | Number, default 0 | tasa sugerida (%) |
| `stage` | enum `draft`\|`under_evaluation`\|`approved`\|`disbursed`\|`completed`\|`refused`\|`overdue`, default `draft` | estado del pipeline de la solicitud de préstamo |
| `notes` | String | opcional |
| `deleted` | Boolean | soft delete (sin índice explícito, a diferencia de Lead/Company) |
| `crmSynced`, `crmSyncError`, `crmLastSyncAt` | control de sync CRM | |
| `createdAt` / `updatedAt` | Date | |

**No hay campo de scoring en Deal** — el scoring vive únicamente en `Lead`.
**Relaciones:** `leadId` → `Lead` (requerida).

### Activity
Archivo: `src/models/Activity.ts`

| Campo | Tipo | Notas |
|---|---|---|
| `_id` | ObjectId | PK |
| `crmId` | String, único disperso | id en HubSpot (Note/Call/Meeting/Email/Task) |
| `tempId` | String, único disperso | UUID local |
| `leadId` | ObjectId, `ref: 'Lead'`, requerido | |
| `userId` | String, requerido | |
| `type` | enum `NOTE`\|`CALL`\|`MEETING`\|`EMAIL`\|`TASK`\|`WHATSAPP`, default `NOTE` | |
| `title`, `body` | String, requeridos | **PII cifrada en servidor** (AES-256-CBC, mismo mecanismo que Lead) |
| `timestamp` | Date, default `Date.now` | fecha del evento/registro |
| `reminderDate` | Date | opcional — **el recordatorio/tarea vive dentro de Activity, no es una entidad separada** (normalmente con `type: 'TASK'`) |
| `reminderRead` | Boolean, default `false` | deprecado, se conserva solo por compatibilidad con datos existentes |
| `reminderStatus` | enum `active`\|`waiting`\|`completed`, default `active` | fuente de verdad actual del estado del recordatorio (reemplaza a `reminderRead`) |
| `reminderPriority` | enum `LOW`\|`MEDIUM`\|`HIGH`, default `MEDIUM` | mapea 1:1 con `hs_task_priority` de HubSpot; sin selector en la UI todavía |
| `deleted` | Boolean, default `false` | soft delete (sin índice) |
| `crmSynced` | Boolean, default `false` | (sin `crmSyncError`/`crmLastSyncAt`, a diferencia de Lead/Company/Deal) |
| `createdAt` / `updatedAt` | Date | |

**Relaciones:** `leadId` → `Lead` (requerida).
**Nota:** el tipo `WHATSAPP` se renderiza como burbuja de chat en `LeadDrawer.tsx`; la ventana de 24h de mensajería se calcula a partir del último mensaje entrante, no es un campo persistido en `Activity`.

### Invoice
Archivo: `src/models/Invoice.ts`

| Campo | Tipo | Notas |
|---|---|---|
| `_id` | ObjectId | PK |
| `crmId` | String, indexado | id en el CRM/core externo (objeto `Invoice__c` en Salesforce, o custom object equivalente en HubSpot) |
| `leadId` | ObjectId, `ref: 'Lead'`, requerido, indexado | |
| `userId` | String, requerido, indexado | |
| `amount` | Number, requerido | monto de la factura/cuota |
| `balanceDue` | Number, default 0 | saldo pendiente |
| `status` | enum `PAID`\|`PENDING`\|`OVERDUE`, requerido, indexado | |
| `invoiceDate` | Date, requerido | |
| `dueDate` | Date, requerido | |
| `paymentDate` | Date | opcional |
| `createdAt` / `updatedAt` | Date | |

**No tiene campos de control de sync CRM estándar** (`crmSynced`, `deleted`, `tempId`) — es una entidad de solo lectura/espejo: se trae desde el CRM/core externo (HubSpot custom object o Salesforce `Invoice__c`, ver `src/lib/crm/salesforce.ts`) y se persiste en Mongo únicamente para servir de historial crediticio en la UI (pestaña "Finanzas" del `LeadDrawer`), no se edita ni se crea desde la app.
**Uso real actual:** además de mostrarse como historial de pagos, es el insumo que calcula el `scoring` de `Lead` (`syncInvoicesForLead`). No representa "documentos rechazados"; es historial de facturación/pagos del crédito.
**Relaciones:** `leadId` → `Lead` (requerida).

---

## Esquema local (Dexie / IndexedDB)

Archivo: `src/lib/db.ts`. Base `PWAResilientDB`, versión actual **7** (histórico de versiones 4 a 7 documentado en el propio código para referencia de migraciones incrementales de IndexedDB).

| Tabla | Índices (v7) | Interfaz TS | Corresponde a |
|---|---|---|---|
| `leads` | `tempId, id, userId, synced, deleted, companyId, email, documentId` | `LocalLead` | `Lead` (Mongo) |
| `companies` | `tempId, id, userId, synced, deleted, name` | `LocalCompany` | `Company` (Mongo) — a retirar |
| `users` | `id, email` | `LocalUser` | subconjunto de `User` (solo perfil local: `id`, `email`, `name`, `image`, `crmOwnerId`, `createdAt`) |
| `invoices` | `id, crmId, leadId, userId, status` | `LocalInvoice` | `Invoice` (Mongo) |
| `activities` | `tempId, id, leadId, userId, type, synced, deleted` | `LocalActivity` | `Activity` (Mongo) |
| `notifications` | `id, userId, read, notified, scheduledAt, activityId, leadId` | `LocalNotification` | **sin equivalente en el servidor** — es una tabla puramente local/efímera para el orquestador de recordatorios (`useNotifications.ts`, alertas Web cada 10s), no se sincroniza a MongoDB |
| `deals` | `tempId, id, leadId, userId, stage, synced, deleted` | `LocalDeal` | `Deal` (Mongo) |

**Relación con los modelos Mongoose:** mismos campos de negocio que su contraparte del servidor, pero:
- Fechas son `number` (timestamp epoch) en Dexie vs. `Date` en Mongoose.
- Los mismos campos PII (`firstName`, `lastName`, `email`, `phone`, `documentId` en `LocalLead`; `title`, `body` en `LocalActivity`) están cifrados también en el cliente, pero con **AES-256-GCM (Web Crypto API)** en vez de AES-256-CBC (Node `crypto`) del servidor — ver sección de cifrado.
- `synced: boolean` reemplaza a `crmSynced` como bandera de "pendiente de subir al servidor" (no es lo mismo que "sincronizado con el CRM"; el nombre es ambiguo entre las dos capas — ver brechas).
- `tempId` es la clave que el cliente genera offline (UUID) antes de tener un `id` real de MongoDB; convive con `id` en la misma tabla hasta que el push-ack de `pushClientChanges` resuelve el mapeo `tempId → id` (ver `useSync.ts`).
- `LocalLead.scoring` persiste el valor calculado en servidor (se lee, no se recalcula en cliente).

---

## Cifrado de datos

### Servidor (AES-256-CBC)
Archivo: `src/lib/crypto.ts`.
- Clave: SHA-256 del secreto `SERVER_ENCRYPTION_SECRET` (32 bytes derivados), sin rotación de clave implementada.
- `encrypt(text)`: IV aleatorio de 16 bytes, formato de salida `"<iv_hex>:<ciphertext_hex>"`. Detecta si el texto ya viene cifrado (heurística: contiene `:` y la primera parte mide 32 caracteres hex) para evitar doble cifrado.
- `decrypt(ciphertext)`: valida formato `iv:ciphertext`, si falla o no matchea el patrón devuelve el valor tal cual (fallback silencioso — no lanza error hacia arriba, solo loguea).
- `hash(text)`: SHA-256 de `text.trim().toLowerCase()`, usado para `emailHash` y `documentIdHash` (búsqueda sin descifrar).
- Se aplica vía getters/setters de campo en Mongoose (`get: decrypt, set: encrypt`) en `Lead` (`firstName`, `lastName`, `email`, `phone`, `documentId`) y `Activity` (`title`, `body`). Requiere `toJSON: { getters: true }` / `toObject: { getters: true }` en el schema para que el getter se aplique al serializar.
- **No se aplica** a `User.email`, `User.twoFactorSecret`, `Company.name` ni a ningún campo de `Deal` o `Invoice`.

### Cliente (AES-256-GCM)
Archivo: `src/lib/client-crypto.ts`.
- Usa Web Crypto API (`window.crypto.subtle`), algoritmo `AES-GCM` con clave de 256 bits importada desde `dbEncryptionKey` (hex) que llega en la sesión de NextAuth.
- `encryptLocal`/`decryptLocal`: IV aleatorio de 12 bytes (formato GCM estándar, distinto a los 16 bytes de CBC en servidor), formato de salida `"<iv_hex>:<ciphertext_hex>"`. Detecta cifrado previo por longitud de la primera parte (24 hex chars = 12 bytes) para evitar doble cifrado.
- Helpers de alto nivel `encryptLead`/`decryptLead` (campos `firstName`, `lastName`, `email`, `phone`, `documentId`) y `encryptActivity`/`decryptActivity` (campos `title`, `body`), usados por `useSync.ts` al bajar/subir datos de Dexie.
- La clave nunca se persiste en disco del cliente; vive en memoria de la sesión y se descarta al logout (`SessionPurgeObserver` borra todo IndexedDB).
- **Importante para el diseño nuevo:** el cliente y el servidor cifran el mismo dato con algoritmos distintos (GCM vs. CBC) y claves distintas (`dbEncryptionKey` por usuario vs. `SERVER_ENCRYPTION_SECRET` global) — el dato viaja descifrado en tránsito entre ambas capas (se descifra en cliente antes de mandar al servidor, y el servidor vuelve a cifrar con su propio esquema). Esto es relevante si la nueva arquitectura BFF + microservicios decide centralizar el cifrado en un único punto.

---

## Campos de control de sincronización

Presentes en `Lead`, `Company`, `Deal`, `Activity` (con variaciones menores entre entidades, ver tablas arriba):

| Campo | Rol |
|---|---|
| `crmId` | ID del registro equivalente en el CRM externo (HubSpot/Salesforce). Ausente mientras el registro no fue enviado/confirmado en el CRM. |
| `crmSynced` | Booleano: indica si el registro ya se sincronizó exitosamente hacia el CRM externo (motor `sync-engine.ts`, proceso outbound en background). No debe confundirse con el `synced` de Dexie, que indica sincronización local→MongoDB (una capa distinta). |
| `crmSyncError` | Mensaje de error de la última sincronización fallida hacia el CRM (ausente en `Activity`, que no tiene este campo). |
| `deleted` | Soft delete: marca lógica de borrado, nunca se hace `DELETE` físico en Mongo (permite propagar el borrado al CRM y a otros clientes antes de purgar). |
| `tempId` | UUID generado en el cliente al crear un registro offline, antes de tener `_id` de MongoDB. Se usa para deduplicar creaciones si el mismo registro se reintenta enviar (índice único disperso en `Deal`/`Activity`), y para que `useSync.ts` resuelva el mapeo `tempId → id real` en la respuesta de `pushClientChanges` sin duplicar el registro local. `Company` y `Lead` no tienen `tempId` como campo del schema Mongoose (el mapeo tempId↔id para esas entidades se resuelve solo del lado cliente/Dexie, comparando por `id` presente/ausente). |

`Invoice` y `User` no participan de este patrón (`Invoice` es un espejo de solo lectura desde el CRM/core; `User` no es una entidad sincronizada al CRM, solo referenciada vía `crmOwnerId`).

---

## Gestión de caché local (sliding window)

Función `purgeLocalCache(userId)` en `src/hooks/useSync.ts`, invocada al final de cada ciclo de sincronización (polling cada 15s vía `useSync`).

**Regla:** si el usuario tiene más de **100 leads** en Dexie, se purgan los más antiguos hasta volver a estar por debajo de 100, con estas condiciones de exclusión (un lead **no** es candidato a purga si):
- No está `synced` (tiene cambios locales pendientes de subir), o
- Está `deleted`, o
- Tiene un `Deal` activo asociado (`stage` distinto de `completed`/`refused` y no `deleted`) — se cruza contra la tabla `deals` local, o
- Fue actualizado (`updatedAt`) en los últimos **7 días**.

Los candidatos restantes se ordenan por `updatedAt` ascendente (más antiguos primero) y se eliminan solo los necesarios para volver a 100. Al purgar un lead se hace **borrado en cascada local** de sus `invoices`, `activities` y `deals` asociados en Dexie (no afecta al servidor, es puramente higiene de caché del cliente).

Esta lógica es un comportamiento no trivial a preservar (o rediseñar conscientemente) en la nueva arquitectura si se mantiene un patrón offline-first en el cliente: el límite (100), la ventana de gracia (7 días) y la exclusión por préstamo activo son reglas de negocio, no accidentes de implementación.

---

## Propuesta de distribución por futuro servicio (a validar)

Según la sección 3.5 ("Propiedad del dato") del documento de arquitectura Negofin (una base PostgreSQL por servicio, sin acceso cruzado):

| Entidad actual | Futuro servicio propietario (propuesta) | Notas |
|---|---|---|
| `Lead` | **Leads** | Owner directo declarado en el documento de arquitectura. `scoring` se descarta (se consulta al core crediticio por API, no se persiste). `companyId` debe resolverse sin `Company` (ver fila siguiente). |
| `Company` | — (retirada) | No se traslada a ningún servicio; no migrar datos. |
| `Activity` (tipos `NOTE`, `CALL`, `MEETING`, `EMAIL`, `WHATSAPP`) | **Workflow** | Interacciones/timeline del lead. |
| Recordatorio/tarea (`Activity` con `type: 'TASK'`, campos `reminderDate`/`reminderStatus`/`reminderPriority`) | **Agenda** (a validar) | Hoy **no es una entidad aparte**: vive embebido dentro de `Activity` como un subtipo (`type: 'TASK'`) con campos opcionales de recordatorio. Si "Agenda" es un servicio propio en la nueva arquitectura, esto implica separar ese subtipo de `Activity` en una entidad `Reminder`/`Task` independiente — no es un split trivial, hay que decidir si el resto de tipos de `Activity` (notas, llamadas, WhatsApp) se quedan en Workflow y solo `TASK` migra a Agenda. |
| `Deal` | **Workflow** | Estado autoritativo de la solicitud de préstamo pasa a vivir en el core (documento de arquitectura); Workflow orquesta el pipeline pero no es necesariamente la fuente de verdad final del `stage` en el nuevo diseño — a confirmar con el documento de Negofin. |
| `Invoice` (historial de facturación/pagos) | **A confirmar** — candidato: servicio de Core Crediticio/Scoring (fuera de la lista de 6 servicios de negocio) o Workflow si se define como parte del ciclo de vida del crédito | Hoy es un espejo de solo lectura desde el CRM/core externo (Salesforce `Invoice__c` u objeto custom de HubSpot), usado para mostrar historial de pagos y para calcular `scoring`. No es "documentos rechazados" — es historial de cuotas/facturas (`PAID`/`PENDING`/`OVERDUE`). Al descartarse el cálculo local de `scoring`, su único uso remanente sería el historial visual — evaluar si eso debe vivir en Workflow (contexto del préstamo) o ser expuesto directamente por el core crediticio sin pasar por un microservicio CRM-side. |
| `User` (vendedor/supervisor/jerarquía, roles, MFA) | **Portal/Identidad** (cross-cutting) | No es un servicio de negocio de la lista de 6; es transversal. `supervisorId` (jerarquía) y `roles` deberían vivir en el servicio de identidad/portal, consumido por el resto vía API/tokens, no replicado. |
| `LocalNotification` (Dexie, sin equivalente server-side) | **Agenda** o capa de presentación pura | Es efímera y solo local hoy; si Agenda pasa a ser servicio propio con recordatorios persistidos server-side, esta tabla debería dejar de ser la fuente de verdad y convertirse en una proyección/caché de lo que devuelva Agenda. |

---

## Brechas / preguntas abiertas detectadas

1. **`User.email` y `User.twoFactorSecret` no están cifrados** a nivel de campo en Mongo, a diferencia de los datos PII de `Lead`/`Activity`. Definir si el servicio de Identidad en la nueva arquitectura debe cifrarlos (razonable dado que `twoFactorSecret` es un secreto TOTP).
2. **`scoring` es un campo calculado y persistido hoy** (`syncInvoicesForLead` en `src/app/actions/sync.ts`), recalculado cada vez que llegan facturas nuevas del CRM. La decisión de migración ya tomada es descartarlo (consulta a API del core), pero hay que verificar que ningún flujo actual (dashboard, `useDashboard.ts`, filtros de contactos) dependa de poder filtrar/ordenar por `scoring` sin round-trip a un servicio externo — hoy se usa para filtrar/mostrar en la lista de contactos y en `LeadDrawer`.
3. **`Deal` no tiene índice en `deleted`** (a diferencia de `Lead`/`Company`), y `Activity` tampoco indexa `deleted` — posible gap de performance a resolver al diseñar los índices PostgreSQL, no necesariamente algo a replicar.
4. **Ambigüedad de nombres entre capas:** `synced` (Dexie, local→servidor) vs. `crmSynced` (Mongo, servidor→CRM externo) son conceptos distintos con nombres parecidos. Al diseñar el bus de eventos de la nueva arquitectura, conviene un vocabulario más explícito (p. ej. `localSyncStatus` vs. `crmSyncStatus`) para evitar confusión entre equipos de distintos microservicios.
5. **`core/entities/Activity.ts` (entidad de dominio Clean Architecture) está desactualizada** respecto al modelo Mongoose real: no incluye `reminderStatus` ni `reminderPriority` (que sí existen en `src/models/Activity.ts` y en `LocalActivity` de Dexie desde hace tiempo). Si se usa esa entidad de dominio como referencia para el nuevo esquema, hay que completarla primero con los campos reales.
6. **`Invoice` no tiene campos de control de sync CRM ni `deleted`** — no está claro cómo se maneja el borrado o corrección de una factura ya sincronizada desde el CRM/core (¿se reemplaza el registro completo en cada `syncInvoicesForLead`? Ver que el código borra todas las facturas del lead y reinserta en cada pull — comportamiento tipo "replace completo", no upsert incremental). Confirmar si el futuro servicio propietario debe preservar historial o solo el estado actual.
7. **`Company.userId` y "empresa" del lead**: al retirarse `Company`, hay que decidir con el negocio si `Lead` pierde por completo el concepto de "empresa asociada" o si se reemplaza por un campo de texto libre no relacional dentro del propio servicio Leads.
8. **Falta confirmar si "recordatorio/tarea" debe ser servicio Agenda separado o sub-tipo dentro de Workflow** — hoy técnicamente es un subtipo de `Activity` (`type: 'TASK'`), no una entidad aparte; el split propuesto en este documento es una hipótesis a validar contra el documento de arquitectura de Negofin.
9. **`LocalNotification` (Dexie) no tiene contraparte en MongoDB** — es puramente cliente y no sobrevive a un logout/limpieza de caché ni se comparte entre dispositivos del mismo vendedor. Si Agenda pasa a ser un servicio server-side, este es el punto de partida a reemplazar, no a migrar tal cual.
