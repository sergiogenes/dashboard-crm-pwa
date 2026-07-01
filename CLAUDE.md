# Dashboard CRM PWA — HPN (Proyecto 307)

## Propósito
PWA de gestión comercial para una financiera de microcréditos. Permite a vendedores gestionar contactos (leads), empresas, solicitudes de préstamo (deals) y actividades (notas, llamadas, WhatsApp) de forma offline-first, sincronizando con MongoDB Atlas como base intermedia y HubSpot como CRM externo.

## Stack Tecnológico
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Base local (offline):** Dexie.js sobre IndexedDB — cifrado con AES-256-GCM (Web Crypto API)
- **Base intermedia (servidor):** MongoDB Atlas con Mongoose — cifrado con AES-256-CBC en campos PII
- **CRM externo:** HubSpot API v3 (adaptador intercambiable vía `ICRMProvider`)
- **Mensajería:** Infobip WhatsApp (adaptador intercambiable vía `IMessagingProvider`)
- **Auth:** NextAuth.js con MFA obligatorio (TOTP via otplib)
- **Deploy:** Vercel + MongoDB Atlas

## Roles de Usuario
- `admin` — Consola de gestión de usuarios y roles
- `supervisor` — Dashboard de equipo, importación CSV, reasignación de leads
- `user` (vendedor) — Gestión de sus propios contactos y préstamos

## Arquitectura de Capas

```
UI (React) ↔ Dexie.js (IndexedDB cifrado)
                    ↕ useSync.ts (cada 15s)
           Server Actions (Next.js) ↔ MongoDB Atlas
                    ↕ Outbound Sync Engine
                       HubSpot CRM API
```

**Flujo clave:** La UI solo lee/escribe Dexie. El hook `useSync` sube cambios locales (`synced: false`) al servidor y baja actualizaciones del servidor a Dexie. El motor de sincronización de salida (`sync-engine.ts`) sincroniza MongoDB con HubSpot en background.

**Campos de control de sincronización en MongoDB:** `crmId`, `crmSynced`, `crmSyncError`, `deleted`, `tempId` (UUID local para deduplicar creaciones).

## Estructura de Archivos Clave

```
src/
  app/
    (dashboard)/          # Páginas protegidas (layout con Sidebar)
      page.tsx            # Dashboard home (KPIs + embudo)
      contacts/page.tsx   # Lista de contactos (orquestador mínimo ~192 líneas)
      companies/page.tsx  # Lista de empresas (~85 líneas)
      deals/page.tsx      # Panel de préstamos (~155 líneas)
      admin/page.tsx      # Consola de administración
      settings/page.tsx   # Configuración de usuario
    actions/
      sync.ts             # pushClientChanges + pullServerUpdates (CORE)
      supervisor.ts       # Acciones de supervisor (métricas, CSV, reasignación)
      admin.ts            # Gestión de usuarios y roles
      mfa.ts              # Setup y verificación MFA
      whatsapp.ts         # Envío de mensajes WhatsApp
    api/
      webhooks/crm/       # Webhook HubSpot (firma V3/V2/V1, genérico via ICRMProvider)
      webhooks/whatsapp/  # Webhook Infobip (genérico via IMessagingProvider)
  components/
    contacts/
      LeadDrawer.tsx      # Drawer lateral de detalles (timeline + pestañas)
      LeadCard.tsx        # Tarjetas móviles
    deals/
      DealTable.tsx / DealCard.tsx
    Sidebar.tsx / Header.tsx
    LeadFormModal.tsx     # Modal de creación/edición de contacto
  core/                   # Clean Architecture — dominio puro
    entities/             # Lead, Company, Activity, Deal, Invoice (sin Mongoose)
    repositories/         # Interfaces ILeadRepository, etc.
  infrastructure/
    repositories/mongodb/ # Implementaciones Mongoose de los repositorios
  hooks/
    useSync.ts            # Motor de sincronización cliente (polling 15s + purga caché)
    useContacts.ts        # Estado + datos de contactos (descifrado en caliente)
    useDeals.ts           # Estado + filtros de préstamos
    useDashboard.ts       # KPIs y embudo de ventas
    useNotifications.ts   # Orquestador de recordatorios (alertas Web cada 10s)
  lib/
    crm/
      interface.ts        # ICRMProvider (contrato genérico)
      hubspot.ts          # Implementación HubSpot
      mock.ts             # Mock en memoria para tests
      factory.ts          # CRMProviderFactory (globalThis para HMR)
      sync-engine.ts      # Motor de sincronización outbound
    messaging/
      interface.ts        # IMessagingProvider
      providers/infobip.ts / mock.ts
    crypto.ts             # Cifrado AES-256-CBC Node.js (servidor)
    client-crypto.ts      # Cifrado AES-256-GCM Web Crypto API (cliente)
    db.ts                 # Dexie.js — versión 7 (leads, companies, activities, deals, notifications)
    auth.ts               # NextAuth config — inyecta dbEncryptionKey en JWT
  models/                 # Esquemas Mongoose: User, Lead, Company, Deal, Activity, Invoice
```

## Cómo Correr el Proyecto

```bash
# Desarrollo
npm run dev              # Puerto 3000

# Tests E2E (Playwright) — requiere .env.development.local configurado
npm run test             # Puerto 3001 aislado, usa dashboard-pwa-test

# Build producción
npm run build

# Migración de cifrado (si es necesario)
node scripts/migrate-encryption.js
```

**Variables de entorno críticas:**
- `MONGODB_URI` — URI de conexión a Atlas
- `SERVER_ENCRYPTION_SECRET` — Clave AES maestra del servidor (32 bytes hex)
- `NEXTAUTH_SECRET` / `NEXTAUTH_URL`
- `HUBSPOT_API_KEY`
- `INFOBIP_API_KEY` / `INFOBIP_BASE_URL` / `INFOBIP_SENDER_NUMBER`
- `NEXT_PUBLIC_MESSAGING_PROVIDER` — `'infobip'` | `'mock'`
- `HUBSPOT_WEBHOOK_SECRET` — Para validación de firma V3

## Patrones de Desarrollo Importantes

### Agregar una nueva entidad sincronizable
Seguir el checklist en el orden exacto:
1. `src/lib/db.ts` — agregar interfaz local + incrementar versión Dexie
2. `src/models/NuevaEntidad.ts` — modelo Mongoose con campos `crmId`, `crmSynced`, `deleted`, `tempId`
3. `src/lib/crm/interface.ts` — agregar métodos al contrato ICRMProvider
4. `src/lib/crm/mock.ts` — implementar mock en memoria
5. `src/lib/crm/hubspot.ts` — implementar adaptador real
6. `src/app/actions/sync.ts` — procesar en `pushClientChanges` y `pullServerUpdates`
7. `src/lib/crm/sync-engine.ts` — agregar a la cola de sincronización outbound
8. `src/app/api/webhooks/crm/route.ts` — manejar eventos webhook entrantes

### Seguridad y cifrado
- Los campos PII (`firstName`, `lastName`, `phone`, `email`, `documentId`) están cifrados en MongoDB mediante getters/setters Mongoose con `SERVER_ENCRYPTION_SECRET`.
- Los mismos campos se cifran en Dexie con AES-256-GCM usando la `dbEncryptionKey` del usuario (obtenida de la sesión NextAuth, nunca guardada en disco).
- Al hacer logout, `SessionPurgeObserver` en `providers.tsx` borra toda IndexedDB.
- La caché de Dexie tiene un límite de 100 leads: `purgeLocalCache()` en `useSync.ts` elimina los más antiguos/sincronizados en cada ciclo.

### Búsqueda por DNI
- Los leads tienen `documentIdHash` (SHA-256) en MongoDB para búsquedas eficientes sin descifrar.
- La Server Action `searchGlobalLeadByDocumentId` hace fallback a HubSpot si no encuentra localmente.

### WhatsApp
- La ventana de 24 horas se calcula a partir del último mensaje entrante del lead.
- Actividades tipo `'WHATSAPP'` se renderizan como burbujas de chat en `LeadDrawer.tsx`.
- El endpoint `/api/webhooks/whatsapp` es genérico (delega al `IMessagingProvider` activo).

## Estado Actual

**Rama activa:** `feature/encryption-and-sliding-cache`

**Implementado (completo):**
- Clean Architecture (entidades, repositorios, infraestructura)
- Cifrado AES-256 en cliente (Dexie) y servidor (MongoDB)
- Purga de IndexedDB en logout + caché deslizante (sliding window 100 leads / 7 días)
- MFA obligatorio con lockout de 3 intentos
- Sistema de roles múltiples (admin, supervisor, vendedor)
- Webhooks desacoplados (CRM y WhatsApp)
- Integración WhatsApp (Infobip) con UI de chat
- Scoring crediticio en tiempo real

**Pendiente de implementar (próxima feature):**
- **Modelo de Franquicias/Royalties** — ver diseño en memoria del proyecto (`project_franchise_pending`)
  - Campos `franchiseId`, `originalCaptadorId`, `commercialRole` en User/Lead/Deal
  - Regla Simply (bloqueo de prospección cruzada entre aliados)
  - Programa de royalties captador ↔ renovador
  - Semáforo de franquicias en dashboard de supervisor
