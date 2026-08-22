# Registro de Progreso - Portal de Vendedores

## Progreso por Fases

### [x] Fase 1: Inicialización y Estructura Base del Proyecto

- Inicialización de Next.js 14 con App Router y Tailwind CSS.
- Configuración base del Service Worker con `next-pwa`.
- Creación de plantillas de configuración y variables de entorno (`.env.local`, `.env.template`, `.env.test`).
- Configuración de TypeScript y Prettier.

### [x] Fase 2: Capa de Datos Local (Dexie.js) y Servidor (MongoDB)

- Configuración de conexión singleton a MongoDB ([src/lib/mongodb.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/mongodb.ts)).
- Modelos Mongoose para `User`, `Company` y `Lead` con metadatos de sincronización de CRM y soporte para soft delete.
- Configuración del cliente IndexedDB con Dexie.js ([src/lib/db.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/db.ts)).

### [x] Fase 3: Capa de Abstracción del CRM y Adaptador para HubSpot

- Contrato del proveedor CRM ([src/lib/crm/interface.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/interface.ts)).
- Proveedor Mock en memoria ([src/lib/crm/mock.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/mock.ts)) para pruebas automatizadas (CI/CD).
- Adaptador real para HubSpot ([src/lib/crm/hubspot.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/hubspot.ts)) consumiendo la API v3 usando `fetch` nativo con detección y prevención de duplicados por email/dominio.
- Factoría de inyección dinámica ([src/lib/crm/factory.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/factory.ts)).

### [x] Fase 4: Motor de Sincronización Servidor-CRM (Outbound) y Webhooks (Inbound)

- Creación del motor de sincronización de salida (Outbound Sync Engine) para enviar cambios de MongoDB al CRM.
- Endpoint de Webhooks en Next.js para recibir actualizaciones directas desde HubSpot y plasmarlas en la base de datos intermedia.
- Manejo de rate limiting, reintentos y clasificación de errores (temporales vs permanentes).

### [x] Fase 6: Vistas del Dashboard, Componentes Visuales Reactivos y Formularios de CRUD

- Integración de proveedores globales (`QueryClient` de TanStack Query y `SessionProvider` de NextAuth).
- Configuración de PWA mediante `manifest.json` y metadatos de layout adaptados.
- Configuración e integración de iconos e favicon premium PWA (192x192, 512x512, apple-touch-icon).
- Página de fallback offline (/~offline) y corrección de compilación de Workbox (exclusión de manifiestos 404).
- Componente `SyncStatusBadge` con visualización en tiempo real del estado de red, sincronización y cambios locales pendientes en Dexie.
- Resiliencia de Sincronización en `useSync.ts`: Monitoreo periódico de salud (`/api/health`) que se dispara si la app está en estado de error, logrando la recuperación y reconexión automática tan pronto el servidor vuelve a estar online sin necesidad de refrescar la página.
- Resiliencia en la Pantalla de Login: Prevención de llamadas a NextAuth `signIn` si el navegador está sin internet o el servidor está caído (health check de 3s). Adicionalmente, se configuró la página de error de NextAuth para redirigir a `/auth/signin` manejando de forma amigable parámetros de error en la URL para evitar bloqueos del usuario. También se corrigió el bloqueo ("Cargando base de datos local y sesión...") reemplazando `router.push('/')` por `window.location.replace('/')` tras iniciar sesión con éxito, lo que obliga al navegador a recargar y obtener el estado actualizado del `SessionProvider` de forma inmediata.
- Corrección de Errores de Consola PWA: Exclusión de iconos PWA y archivos JS de fallback de Service Worker en el Middleware para evitar redirecciones rotas (que marcaban el SW como redundante y daban error de descarga de imagen). Se añadió la etiqueta `mobile-web-app-capable` en `layout.tsx` para resolver la advertencia de deprecación.
- Componentes modales CRUD offline (`LeadFormModal` y `CompanyFormModal`) persistiendo en Dexie.
- Vista principal en `/` con estadísticas reactivas, filtros y tablas interactivas.
- Página `/auth/signin` para inicio de sesión y registro rápido de usuarios.
- Middleware de NextAuth implementado para protección automática de rutas privadas.
- Corrección en la validación de contraseñas de NextAuth (`user.password` -> `user.passwordHash`).

### [x] Fase 7: Pruebas de Integración con Playwright

- Creación de la configuración central de Playwright (`playwright.config.ts`) con soporte de entorno de desarrollo aislado (.env.test).
- Implementación de la suite de pruebas `tests/sync.spec.ts` que simula la transición Offline/Online y verifica la persistencia e IndexedDB de manera integral.
- Limpieza y purga automática de IndexedDB en navegador y de colecciones en MongoDB.

---

## Hito de Despliegue (26 de mayo de 2026)

- **Configuración en Producción:** Creación y despliegue del proyecto en **Vercel** vinculado a la cuenta existente de **MongoDB Atlas**.
- **Soporte de Variables:** Soporte para las variables de entorno `prod_MONGODB_URI` y `prod_MONGODB_URI_URL` en la conexión de producción ([src/lib/mongodb.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/mongodb.ts)).
- **Validación de PWA:** Despliegue completado con éxito; PWA plenamente probada e instalable en dispositivos móviles (Android/Chrome) en modo standalone con resolución de variables de entorno.

## Fases del 27 de mayo de 2026 (Privacidad, Asignación de Propietario en CRM y Sincronización)

- **Forzar Base de Datos Dinámicamente:** Extracción automática de la base de datos de la URI de conexión. En producción sin base de datos en la URI, se conecta por defecto a `dashboard-pwa`. En desarrollo local y testing, respeta las bases de datos `dashboard-pwa` y `dashboard-pwa-test` / `testdb` respectivamente, evitando borrar datos de desarrollo en las pruebas.
- **Visibilidad de Datos:** Re-arquitectura del flujo de sincronización y de la UI para que las Empresas sean compartidas globalmente por todos los usuarios y los Contactos (Leads) permanezcan privados para su creador.
- **Asignación de HubSpot Owner:** Inyección condicional de la propiedad `hubspot_owner_id` en el adaptador de HubSpot, mapeada dinámicamente desde el `crmOwnerId` del usuario creador del contacto en MongoDB.
- **Autodetectación de HubSpot Owner:** Mapeo automático del `crmOwnerId` consultando la API de HubSpot por el email del usuario en su primera sincronización. Se corrigió el enrutamiento de la petición al endpoint `/owners` de HubSpot redireccionándola fuera del prefijo `/objects`.
- **Caché de Sesión Optimizado:** Configuración del Service Worker de la PWA (`next.config.mjs`) para usar la estrategia `NetworkFirst` para `/api/auth/session`, eliminando el bloqueo ("loading") infinito tras iniciar sesión en producción.
- **Sincronización Inbound Robusta:** Incorporación de un fallback que fuerza la importación desde HubSpot si la base de datos de MongoDB está vacía, y propagación explícita de errores al cliente para asegurar reintentos en fallos de conexión o autenticación.
- **Autosanación de Sincronización Outbound:** Integración de la llamada a `syncMongoDBToCRM` en `pullServerUpdates` para actuar como mecanismo de autosanación, resolviendo de forma transparente problemas con registros huérfanos (como el caso de "Jua per") en los ciclos de polling periódico tras una caída o interrupción.
- **Alineación de Bases de Datos en Tests:** Introducción de `IS_PLAYWRIGHT_TEST=true` para forzar a Mongoose a conectarse a `dashboard-pwa-test` durante la ejecución de los tests, garantizando que el servidor de desarrollo y el test runner compartan el mismo almacenamiento.
- **Resiliencia ante Duplicados en HubSpot:** Captura robusta de errores 400 de conflicto por email duplicado debido a latencias de indexación en la búsqueda de HubSpot, extrayendo el ID del contacto en conflicto para realizar una actualización (`PATCH`) transparente.
- **Optimización de Tiempos de Conexión en Redes Lentas:** Incrementado el timeout de Mongoose a 15s (`serverSelectionTimeoutMS`), el abort timeout del frontend en login a 20s y el tiempo límite global de Playwright a 60s para prevenir falsos fallos y timeouts debido a latencia DNS o TCP en la conexión a MongoDB Atlas.
- **Estabilización del Estado Online en Tests:** Añadida una espera de 1 segundo tras restaurar la conexión a Internet en Playwright (`setOffline(false)`) para que la pila de red virtual se inicialice completamente antes de disparar peticiones, evitando fallos inmediatos por desconexión temporal.

## Fases del 28 de mayo de 2026 (Configuración de Webhooks y Resiliencia en Borrados)

- **Suscripciones de Webhooks Activas:** Configurada la aplicación en HubSpot para gatillar eventos de creación (`company.creation`) y modificaciones de nombre y dominio (`company.propertyChange`) de empresas apuntando a la URL de producción.
- **Verificación Híbrida de Firmas (V3/V2/V1):** Rediseñado el validador del webhook en [src/app/api/webhooks/crm/route.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/api/webhooks/crm/route.ts) para soportar la firma criptográfica V3 (HMAC-SHA256 con timestamp) y mantener la compatibilidad con firmas V2 (SHA-256) y V1 (MD5), solucionando el error `401 Unauthorized`.
- **Persistencia de Soft Delete en Base Intermedia:** Modificado el motor de sincronización en [src/lib/crm/sync-engine.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/sync-engine.ts) para que las empresas y contactos eliminados no se borren físicamente de MongoDB. Se actualizan a `crmSynced: true` manteniendo de forma persistente su estado `deleted: true`.
- **Protección contra Recreaciones en Webhook:** Ajustada la lógica en el endpoint del webhook ([src/app/api/webhooks/crm/route.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/api/webhooks/crm/route.ts)) para ignorar cualquier evento de cambio de propiedad si el registro en MongoDB ya está marcado como `deleted: true`. Esto evita que eventos atrasados del CRM recreen elementos eliminados.
- **Prevención de Re-importaciones Cíclicas:** Modificada la función `pullServerUpdates` en [src/app/actions/sync.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/actions/sync.ts) para contar tanto registros activos como borrados al verificar si MongoDB está vacía, previniendo que se gatille la re-importación masiva desde HubSpot si el usuario borra todas sus entidades locales.
- **Sincronización Continua Inbound:** Modificada la función `checkServerAndSync` en [src/hooks/useSync.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/hooks/useSync.ts) para disparar la sincronización de forma incondicional en cada ciclo de 15 segundos si el dispositivo está online y el servidor responde. Esto garantiza que las creaciones o modificaciones realizadas en HubSpot (e ingresadas vía Webhooks) se descarguen de inmediato y se reflejen en la UI sin necesidad de refrescar manualmente la página.

- Tareas Completadas:
  - Despliegue de los cambios en producción a través de Vercel.
  - Pruebas exhaustivas de creación, edición y borrado completadas con éxito, confirmando el correcto funcionamiento del soft delete y del webhook de HubSpot sin bucles de sincronización ni retrasos en la UI.

---

## Fases del 29 de mayo de 2026 (Seguridad y Recuperación de Contraseña)

- **Modelo de Tokens de Recuperación:** Creado el modelo `PasswordResetToken` en MongoDB con índice TTL para autodestrucción (expiración automática de 30 minutos).
- **Servicio de Correo con SendGrid:** Configurado `src/lib/mail.ts` utilizando `@sendgrid/mail` con simulación en consola para entornos locales de desarrollo.
- **Server Actions de Seguridad:** Creadas las acciones `requestPasswordReset` y `resetPassword` en `src/app/actions/password-reset.ts` con tokens seguros y hashing SHA-256.
- **Interfaces de UI de Recuperación:** Creadas las vistas `/auth/forgot-password` y `/auth/reset-password` integradas con el formulario principal `/auth/signin`.
- **Robustecimiento de Autenticación:** Unificados los mensajes de error en NextAuth (`src/lib/auth.ts`) a un único mensaje genérico en español para evitar la enumeración de usuarios (User Enumeration).

## Fases del 1 de junio de 2026 (Actividades de Contactos y Sincronización)

- **Fase 1: Capa de Persistencia (Local y Servidor):**
  - Creado el modelo Mongoose `Activity` en MongoDB ([src/models/Activity.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/models/Activity.ts)).
  - Actualizado el esquema de la base local Dexie ([src/lib/db.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/db.ts)) a la versión 4, incorporando la tabla `activities` tipada con `LocalActivity` para soporte offline.
- **Fase 2: Capa CRM (Adaptador):**
  - Añadidas las firmas y definiciones para `CRMActivity` en el contrato de CRM ([src/lib/crm/interface.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/interface.ts)).
  - Implementada la emulación en memoria de actividades en el proveedor simulado ([src/lib/crm/mock.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/mock.ts)).
  - Creados los métodos `createActivity` y `fetchActivitiesByLead` en el adaptador real de HubSpot ([src/lib/crm/hubspot.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/hubspot.ts)), utilizando la creación nativa de notas con asociación `202` (Nota a Contacto) y un motor resiliente de análisis basado en expresiones regulares para descifrar tipos, títulos y cuerpos.
- **Fase 3: Integración en el Hook de Sincronización (useSync) y Badge:**
  - Modificado el hook de sincronización cliente-servidor `useSync.ts` para capturar actividades offline en Dexie, subirlas usando la Server Action `pushClientChanges`, y aplicar los mappings de IDs resultantes.
  - Implementada la descarga del servidor (Inbound Sync) de actividades, con resolución automática de referencias cruzadas (`leadId` local tempId/realId) y borrado en cascada local de actividades si se elimina un contacto.
  - Modificado `SyncStatusBadge.tsx` para incluir las actividades no sincronizadas en el conteo total de cambios locales pendientes.
- **Fase 4: Interfaz de Usuario Reactiva y Cronología (Timeline) de Actividades:**
  - Re-diseñado el Slide-Over Drawer de detalles del lead en `contacts/page.tsx` para implementar una vista por pestañas: "Finanzas" e "Actividades".
  - Diseñado un formulario offline para registrar nuevas actividades con selección de tipo (`NOTE`, `CALL`, `MEETING`, `EMAIL`, `TASK`), título y descripción, persistidas reactivamente en Dexie.
  - Implementada la cronología (timeline) de actividades en el Drawer con iconos distintivos de `lucide-react` y colores vibrantes según el tipo de actividad, mostrando indicadores de estado de sincronización (`Cloud` vs `Database`) y opción de eliminación local resiliente.
- **Fase 5: Sistema de Recordatorios y Notificaciones (Campanita):**
  - **Dexie v5 e IndexedDB**: Actualizado el esquema de IndexedDB incorporando la tabla `notifications` y el campo opcional `reminderDate` en actividades locales.
  - **Capa Servidor**: Añadido el campo `reminderDate` al modelo MongoDB `Activity` y su propagación transparente en Server Actions (`sync.ts`).
  - **Mapeo en HubSpot (Retrocompatible)**: Añadida inyección y extracción automática de recordatorios de HubSpot codificados de forma invisible como comentarios HTML (`<!-- reminder:ISO_DATE -->`) dentro del cuerpo de la nota.
  - **Orquestador Global (`useNotifications.ts`)**: Creado un hook en segundo plano que sincroniza actividades con la tabla de alertas y gatilla alertas Web del sistema (`Notification`) cada 10s cuando un recordatorio vence.
  - **Selector e Historial en UI**: Mejorado el selector de recordatorios dividiendo el input de tipo `datetime-local` en dos controles independientes (Fecha y Hora) que predeterminan la fecha para el día de mañana a las 08:00 AM para mejorar la UX. Se integraron iconos visuales premium de `Calendar` y `Clock` vinculados mediante React `refs` y el método nativo `.showPicker()`, de modo que al hacer clic en los iconos o en cualquier parte del cuerpo del input se despliega inmediatamente el calendario o el selector de hora nativo del navegador, manteniendo la etiqueta descriptiva del recordatorio en el timeline del drawer.
  - **Campanita Interactiva en Header**: Rediseñada la campanita estática por un dropdown dinámico con contador y animación de ping para notificaciones no leídas, permitiendo marcarlas como leídas y abriendo el drawer del contacto automáticamente.
  - **Deduplicación de Actividades con tempId**: Integración del campo `tempId` (único y disperso) en el esquema Mongoose [Activity.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/models/Activity.ts) y verificación de duplicados por este ID en [pushClientChanges](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/actions/sync.ts#L23) antes de insertar registros, protegiendo las notas contra desconexiones temporales de red en el cliente.
  - **Manual de Arquitectura**: Redactada la guía [crm_sync_architecture_guide.md](file:///C:/Users/sergi/.gemini/antigravity-cli/brain/4c173d1e-7c69-4d63-a436-53c0e21c63fd/crm_sync_architecture_guide.md) que describe con diagramas Mermaid y listas de control detalladas la sincronización de dos capas (IndexedDB ↔ MongoDB ↔ HubSpot) para agilizar la incorporación de futuras entidades.
  - **Módulo de Deals (Microcréditos y Contratos)**:
    - **Dexie v6 e IndexedDB**: Modificado [src/lib/db.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/db.ts) a la versión 6 incorporando la tabla `deals` y la interfaz `LocalDeal`.
    - **MongoDB Schema**: Creado el modelo Mongoose [src/models/Deal.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/models/Deal.ts) con soporte de `tempId` y metadatos de sincronización de HubSpot.
    - **CRM HubSpot Adaptor**: Actualizado [src/lib/crm/hubspot.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/hubspot.ts) y [src/lib/crm/interface.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/interface.ts) con las operaciones de Deal, el mapeo de etapas a HubSpot y el almacenamiento invisible de metadatos (`termMonths` e `interestRate`) usando comentarios HTML.
    - **Sincronización Cliente-Servidor (Server Actions y Worker)**: Modificados [src/app/actions/sync.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/actions/sync.ts) y [src/lib/crm/sync-engine.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/sync-engine.ts) para procesar arrays de Deals, resolver `leadId` temporales, deduplicar creaciones y procesar subidas.
    - **Drawer de Contacto con Pestaña Préstamos**: Modificado [src/app/(dashboard)/contacts/page.tsx](<file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/(dashboard)/contacts/page.tsx>) añadiendo la pestaña "Préstamos" con un formulario de solicitud (Monto, Plazo, Interés, Notas) y un listado de préstamos activos representados con un Stepper horizontal del flujo de aprobación (`draft` -> `under_evaluation` -> `approved` -> `disbursed`), controlando también estados de alerta (`refused`, `overdue`, `completed`).
    - **Panel de Monitoreo General**: Rediseñado [src/app/(dashboard)/deals/page.tsx](<file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/(dashboard)/deals/page.tsx>) como un Dashboard de solo lectura con filtros por etapa, búsqueda interactiva y métricas rápidas de los créditos activos, aprobados y en mora.
    - **Mapeo del Propietario del Deal (HubSpot Owner)**: Configurada la inyección de `hubspot_owner_id` en `upsertDeal` y `fetchDealsByLead` en [src/lib/crm/hubspot.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/hubspot.ts) recuperando el `crmOwnerId` del asesor desde MongoDB en [src/lib/crm/sync-engine.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/sync-engine.ts), garantizando que las solicitudes se carguen a nombre del vendedor creador.
    - **Sincronización Bidireccional de Etapas desde HubSpot**: Corregido el resolvedor de estados de deals en [src/app/actions/sync.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/actions/sync.ts) para procesar los cambios de columnas realizados directamente en la interfaz de HubSpot con prioridad, preservando las sub-etapas específicas del negocio local.

## Fases del 2 de junio de 2026 (Recordatorios Persistentes y Control de Alarmas)

- **Persistencia de Lectura de Alertas (`reminderRead`)**:
  - **Esquemas local y servidor**: Agregada la propiedad `reminderRead` a la base local Dexie (`LocalActivity` en `db.ts`) y al modelo MongoDB (`Activity.ts`).
  - **Mapeo HubSpot**: Codificación automática del estado de lectura del recordatorio en el cuerpo del HTML de HubSpot (`<!-- reminder:TIMESTAMP,read:1 -->`) y descifrado correspondiente al descargar notas.
  - **Actualizaciones (PATCH) en HubSpot**: Modificada la API del adaptador en `hubspot.ts` para que al sincronizar cambios en notas existentes (`createActivity` con `activity.crmId` presente) realice una petición `PATCH` en lugar de duplicar la nota. Corregido también el mapeo de la fecha de vencimiento al crear la tarea nativa en HubSpot, asignando el vencimiento del recordatorio a la propiedad `hs_timestamp` de la tarea para cumplir con las especificaciones de HubSpot y evitar errores 400. Adicionalmente, se implementó el ciclo de vida completo de la tarea en HubSpot: al actualizar el recordatorio como leído se marca la tarea como `COMPLETED` en HubSpot, y al eliminar la alarma del dashboard se borra la tarea nativa (`DELETE /tasks/{id}`) de HubSpot buscando las tareas del contacto por su título.
  - **Sincronización de Estado de Lectura**: Modificadas las Server Actions (`sync.ts`) y el worker (`sync-engine.ts`) para transferir `reminderRead` en ambas direcciones.
  - **Orquestador de Alertas**: Modificado `useNotifications.ts` para inicializar y actualizar alertas locales como ya leídas/notificadas si la actividad asociada tiene `reminderRead: true`, previniendo repeticiones infinitas tras logouts.
  - **Persistencia en Cabecera**: Al hacer clic en un recordatorio o pulsar "Marcar todo leído" en `Header.tsx`, se marca `reminderRead: true` y `synced: false` en la actividad local usando su llave primaria (`tempId`), subiéndose automáticamente a la nube.
  - **Resolución de Condiciones de Carrera (SSOT)**: Modificado el resolvedor descendente (`syncActivitiesForLead` en `sync.ts`) para usar `$setOnInsert` en los campos `reminderDate` y `reminderRead`. Al no sobreescribir estos campos si el documento de actividad ya existe en MongoDB, garantizamos que las acciones locales (como marcar leído o borrar la alarma) tengan prioridad absoluta y no se vean alteradas por retrasos o consistencia eventual de la API de HubSpot.
- **Gestión y Eliminación de Alertas**:
  - **Control en Cronología (UI)**: Se re-diseñó la visualización de recordatorios en el timeline de `contacts/page.tsx`, incorporando una tarjeta informativa premium con dos opciones de acción directa: **"Marcar Leído"** (para silenciar el recordatorio manteniendo su fecha) y **"Quitar Alarma"** (para remover la fecha de recordatorio permanentemente de la nota).
  - **Función de Purgado (`handleRemoveReminder` y `handleMarkReminderAsRead`)**: Implementadas funciones que actualizan la IndexedDB local usando de forma segura su llave primaria `tempId` y persisten de forma explícita valores `null` en MongoDB para permitir la eliminación real de propiedades e impedir la reaparición de alarmas.

## Roadmap de Seguridad (Tareas Pendientes)

- [x] **Autenticación Multifactor Obligatoria (MFA) - Fase 2:**
  - Modificado el modelo `User` en `User.ts` agregando los flags de MFA, Backup Codes y roles.
  - Creadas las Server Actions en `src/app/actions/mfa.ts` adaptadas a la API modular asíncrona de `otplib` v13.
  - Creadas las pantallas reactivas de `/auth/mfa-setup` y `/auth/mfa` con descarga de códigos de recuperación (.txt) y copiado.
  - Configurado el Middleware en `src/middleware.ts` para obligar al usuario a completar o validar su MFA antes de acceder al Dashboard.
  - Añadida la Server Action `adminResetMFA` para restablecer accesos desde soporte de administradores.
  - Reforzados los formularios con `method="POST"` para evitar la exposición de contraseñas por GET ante fallos de hidratación.
  - Corregidas las advertencias (warnings) de Mongoose v9 reemplazando `new: true` por `returnDocument: 'after'` en `src/app/actions/sync.ts`.
  - Reubicados los botones de creación en el Dashboard para ser contextuales de acuerdo al tab activo (`+ Contacto` / `+ Empresa`).
  - **Limitación de 3 Intentos (Lockout MFA)**: Implementado el límite estricto de 3 intentos fallidos de código TOTP en `/auth/mfa`. En el tercer error se borran los intentos locales y se redirige con `signOut` a la pantalla de login `/auth/signin?error=MfaAttemptsExceeded`.
  - **Persistencia Anti-F5**: Almacenado el contador de intentos fallidos en `sessionStorage` para evitar el bypass al recargar la página.
  - **Errores Personalizados**: Mapeado el error de bloqueo `MfaAttemptsExceeded` a un mensaje descriptivo en español en `/auth/signin`.
  - **Auto-Enfoque (UX)**: Incorporado el foco automático (`autoFocus`) en los inputs del código MFA tanto en la pantalla de verificación como en la de configuración inicial (`/auth/mfa-setup`).
- [x] **Rediseño del Layout (Sidebar Lateral y Páginas Independientes) - Fase 8:**
  - Creados los componentes estructurales [Sidebar.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/components/Sidebar.tsx) (sticky y colapsable) y [Header.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/components/Header.tsx) (buscador y avatar de usuario, con `SyncStatusBadge` integrado).
  - Configurado el Layout Maestro [src/app/(dashboard)/layout.tsx](<file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/(dashboard)/layout.tsx>) para el route group `(dashboard)`.
  - Creadas las páginas independientes para [Contacts](<file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/(dashboard)/contacts/page.tsx>), [Companies](<file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/(dashboard)/companies/page.tsx>), [Dashboard Home](<file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/(dashboard)/page.tsx>) y [Settings](<file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/(dashboard)/settings/page.tsx>) dentro del route group.
  - Se dejó lista la indicación para eliminar el archivo raíz obsoleto `src/app/page.tsx`.
  - **Corrección de Solapamiento y Scroll**: Corregido el solapamiento estético del botón de expandir/colapsar en el sidebar colapsado mediante un botón circular flotante posicionado de forma absoluta sobre el borde derecho y centrando dinámicamente el logotipo. Asimismo, se incorporó `overflow-x-hidden` en el layout general y un comportamiento de desbordamiento dinámico (`overflow-visible` al colapsar y `overflow-y-auto` al expandir) en el menú de navegación para eliminar definitivamente scrollbars horizontales espurios en el navegador y el sidebar. Adicionalmente, se añadió la clase `truncate` al botón de cerrar sesión para evitar saltos de línea molestos durante la animación de transición.
  - **Limpieza de Interfaz**: Se removió el buscador global de cabecera sin funcionalidad del [Header.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/components/Header.tsx) y se re-alineó el menú de usuario hacia la derecha.
- [x] **Cifrado y Purga de Datos Locales (IndexedDB) - Fase 3:**
  - [x] Cifrado transparente en la capa local de Dexie.js derivando claves efímeras en RAM en el inicio de sesión.
  - [x] Implementar purga total de Dexie.js en el evento de cierre de sesión (logout) y limpieza de `localStorage`/`sessionStorage`.
- [x] **Cifrado en MongoDB (Capa de Base Intermedia) - Fase 4:**
  - [x] Implementar Field-Level Encryption (CSFLE) o cifrado simétrico en el servidor de campos confidenciales de contactos.
- [ ] **Sincronización en Producción via Webhooks (Fase 4):**
  - Configurar suscripción de Webhook en el portal de desarrolladores de HubSpot para cambios en el estado de facturas (`invoices` o Custom Object de facturas) y procesar los eventos entrantes en el endpoint del webhook para actualizar en tiempo real el estado en MongoDB Atlas al pasar a producción.

---

_Última actualización: 2026-06-02_

## Fases del 2 de junio de 2026 (Sincronización Bidireccional Desacoplada y Navegación Reactiva)

- **Nueva Arquitectura Desacoplada (Notes & Tasks)**:
  - **Alineación con el Modelo de HubSpot**: Se refactorizaron los adaptadores en [hubspot.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/hubspot.ts) y la creación local en [contacts/page.tsx](<file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/(dashboard)/contacts/page.tsx>) para desacoplar por completo las notas y recordatorios. Ahora se registran como dos entidades independientes (`NOTE` y `TASK`) asociadas únicamente al contacto.
  - **Sincronización Nativa**: Las notas se guardan en `/notes` y las tareas en `/tasks` de HubSpot de manera independiente, eliminando asociaciones v4 inválidas (error 400) y parsing de texto.
  - **Gestión del Ciclo de Vida y Borrado Determinista**: Se adaptó el método `deleteActivity` de `ICRMProvider` a `deleteActivity(crmId, type)` en [mock.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/mock.ts), [hubspot.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/hubspot.ts) y [sync-engine.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/sync-engine.ts). Esto asegura que al presionar "Quitar Alarma" en una tarea, la petición HTTP apunte con precisión al endpoint `/tasks/{crmId}` en lugar del endpoint `/notes/{crmId}` (el cual responde falsamente con `204` sin procesar el borrado de tareas).
- **Navegación Reactiva de Alertas en Header**:
  - **Optimización de Lectura y Comportamiento**: Modificada la acción de marcar como leído en [Header.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/components/Header.tsx) para evitar mutaciones y sincronizaciones inútiles con HubSpot si la notificación ya estaba leída. Asimismo, se quitó la marca automática de lectura cuando el usuario hace clic sobre el cuerpo/título de la tarjeta de la notificación, limitándolo solo a redireccionar al contacto, y permitiendo marcar como leída la notificación de manera explícita (usando el checkbox individual o la opción global).
  - **Cierre Natural por Clic Fuera (Click Outside)**: Se agregaron referencias `useRef` y un listener global `mousedown` en [Header.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/components/Header.tsx) para cerrar los dropdowns de notificaciones y de usuario automáticamente al hacer clic en cualquier otra parte de la pantalla, eliminando los divs invisibles de superposición que bloqueaban la interacción.
  - **Comunicación por Eventos**: Se implementó una comunicación reactiva mediante el evento DOM `open-lead-reminder`. Al hacer click en una notificación del Header, el Dashboard abre el Drawer y posiciona el timeline en la actividad correspondiente, incluso si el usuario ya se encuentra visualizando la página de contactos.
- **Resolución de Condición de Carrera**:
  - **Ventana de Propagación de 20 segundos**: Mantenimiento de la ventana de protección de 20 segundos en [sync.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/actions/sync.ts) para evitar sobreescrituras por indexación lenta de HubSpot. Durante los primeros 20 segundos posteriores a un cambio local en MongoDB, las descargas entrantes (`syncActivitiesForLead` y `syncDealsForLead`) no sobrescribirán el estado local, previniendo rebotes visuales (estados que se desmarcan y se vuelven a marcar tras unos segundos).

- **Depuración de Pruebas de Integración (Playwright) e Hidratación**:
  - **Resolución de Redirecciones Stale**: Identificado un problema en el que Playwright reutilizaba una instancia previa del servidor Next.js que ejecutaba con variables de entorno obsoletas de `.env.local` (`NEXTAUTH_URL=http://localhost:3000` en lugar de `http://127.0.0.1:3000`). Esto causaba redirecciones cruzadas y timeouts.
  - **Marcador de Hidratación en E2E**: Agregado un marcador global `window.__hydrated = true` en [src/app/providers.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/providers.tsx) al montarse el componente de cliente principal.
  - **Esperas Dinámicas de Pruebas**: Modificadas las navegaciones a `/auth/signin` en [tests/sync.spec.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/tests/sync.spec.ts) para aguardar dinámicamente al marcador `__hydrated === true`, previniendo que Playwright interactúe (como hacer clic en la pestaña de registro) antes de que React vincule los event listeners `onClick` en entornos de desarrollo lentos.

---

_Última actualización: 2026-06-03_

## Fases del 3 de junio de 2026 (Optimización de Tiempos de Pruebas y Cobertura de Notas)

- **Optimización del Arranque en E2E**:
  - **Eliminación de la limpieza de `.next`**: Se removió el borrado físico de la carpeta `.next` en [global-setup.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/tests/global-setup.ts). Al compilar de manera incremental usando la caché de Webpack, Next.js compila el bundle de login instantáneamente durante la primera carga de Playwright, evitando el timeout de 30 y 60 segundos del setup en frío en entornos Windows y eliminando la condición de carrera que corrompía la caché (`ENOENT`).
  - **Aislamiento de Puerto en Servidor de Pruebas**: Se cambió la configuración del servidor de pruebas en [playwright.config.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/playwright.config.ts), [.env.test](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/.env.test) y [global-setup.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/tests/global-setup.ts) para usar el puerto **`3001`** bajo el host `localhost`. Esto evita conflictos de redirección de NextAuth entre `127.0.0.1` y `localhost` al reutilizar instancias de servidor o resolver redirecciones del middleware en el navegador de pruebas, garantizando la persistencia de las cookies de sesión.
  - **Desactivación de Reutilización de Servidor**: Configurado `reuseExistingServer: false` en [playwright.config.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/playwright.config.ts) para impedir que Playwright reutilice de forma silenciosa procesos huérfanos del servidor de desarrollo anterior que retengan variables de entorno desactualizadas.
  - **Secuencia de Preparación de Archivos (.env.local)**: Creado el script [pre-test-env.js](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/tests/pre-test-env.js) y enlazado en la directiva de inicio de `webServer` de Playwright. Esto garantiza que la sustitución de variables de desarrollo por las de pruebas ocurra **antes** de que Next.js levante su servidor de desarrollo, eliminando redirecciones residuales a `localhost:3001` de sesiones previas y solucionando la condición de carrera del cargador de dotenv.
  - **Actualización de Aserciones Obsoletas**: Se modificaron las aserciones de espera en [sync.spec.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/tests/sync.spec.ts) para validar el encabezado de bienvenida `¡Hola, ...` en el Dashboard Principal en lugar del título estático obsoleto `Panel de Control` que fue removido de la interfaz.
  - **Corrección de Selectores de Navegación**: Se actualizaron todos los selectores obsoletos de navegación de tests en [sync.spec.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/tests/sync.spec.ts) para pulsar los links de `Contactos` y `Empresas` del nuevo Sidebar y utilizar sus correspondientes botones internos de creación (`Nuevo Contacto` y `Nueva Empresa`).
- **Ampliación de Cobertura de Pruebas (Actividades de Leads)**:
  - **Casos de Notas Específicas**: Añadidos tres nuevos tests automatizados en [sync.spec.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/tests/sync.spec.ts) que verifican de forma aislada la creación de diferentes tipos de notas desde el portal del contacto:
    1. **Nota general**: Registra y confirma en la interfaz una nota normal (`NOTE`).
    2. **Nota de llamada**: Registra y confirma en el timeline una nota de tipo llamada (`CALL`).
    3. **Nota de email**: Registra y confirma en el timeline una nota de tipo correo (`EMAIL`).
  - **Protección del Entorno de Desarrollo (.env.development.local)**: Migrada la configuración de desarrollo local de `.env.local` a `.env.development.local`. Esto evita que las pruebas automatizadas de Playwright (que manipulan y sobrescriben temporalmente `.env.local` durante el setup) borren o corrompan las variables y claves privadas del desarrollador en caso de fallos del runner. Se actualizó el archivo [.gitignore](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/.gitignore) para ignorar de forma explícita este nuevo archivo.
  - **Soporte de Diálogos Nativos en Pruebas (Quitar Alarma)**: Se configuró un manejador de eventos `page.once('dialog', ...)` en el test de ciclo de vida del recordatorio en [sync.spec.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/tests/sync.spec.ts). Esto asegura que el cuadro de diálogo `confirm()` nativo sea aceptado automáticamente por Playwright en lugar de ser cancelado por defecto, permitiendo que la eliminación de la alarma avance en la UI y en la base de datos local.
  - **Robustecimiento de Selectores de Contacto**: Se reemplazaron selectores genéricos de texto `page.getByText('Jane Doe')` por selectores con mayor especificidad semántica `page.getByRole('cell', { name: 'Jane Doe' })` en los tests de notas y actividades de [sync.spec.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/tests/sync.spec.ts). Esto previene errores de "strict mode violation" si existiesen múltiples elementos de texto idénticos en la UI.
  - **Corrección de Aserciones en Solicitud de Préstamos**: Se ajustaron las aserciones de resultado del test de préstamos en [sync.spec.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/tests/sync.spec.ts) para que correspondan exactamente a los textos y formatos renderizados en el dashboard del cliente (e.g. `$15,000 USD` y `Plazo: 24 meses | Tasa: 12.5%` en lugar de etiquetas obsoletas), eliminando el fallo de timeout por elementos no encontrados.
  - **Persistencia de Instancia de Mock CRM (globalThis)**: Se modificó la factoría [factory.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/factory.ts) para almacenar la instancia del `MockCRMProvider` en el objeto global `globalThis`. Esto previene la pérdida de datos del CRM simulado en memoria durante las recargas en caliente (HMR) de Next.js en entornos de prueba y desarrollo, solucionando inconsistencias de asociación de leads/empresas.
  - **Corrección de Tipado TypeScript en Compilación**: Se corrigió un error de tipado estricto en el retorno de [factory.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/factory.ts) que impedía la compilación del build optimizado de Next.js (`npm run build`). Se devolvieron referencias seguras tipadas sin nulos y se aplicó la aserción de no-nulidad (`!`) al retorno final.

## Fases del 4 de junio de 2026 (Webhooks de Facturas para Producción)

- **Webhooks de Facturas (Invoices) en HubSpot**:
  - **Capa CRM (Contratos y Adaptadores)**: Modificado [src/lib/crm/interface.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/interface.ts) para incorporar `fetchInvoiceById` y `fetchLeadIdAssociatedWithInvoice`.
  - **Adaptador de HubSpot**: Implementada en [src/lib/crm/hubspot.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/hubspot.ts) la lógica para recuperar una factura por ID con mapeo resiliente de campos (monto, saldo pendiente, estados) y consultar la asociación de contactos v3 de HubSpot.
  - **Soporte Mock en Tests**: Añadidas las implementaciones de simulación en [src/lib/crm/mock.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/mock.ts) para mantener estables las pruebas automatizadas (Playwright) y la compilación.
  - **Flujo de Webhooks y Recálculo de Scoring**: Modificado [src/app/api/webhooks/crm/route.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/api/webhooks/crm/route.ts) para procesar eventos `invoice.*` y `custom_object.*`. Al crearse o modificarse una factura, se busca al contacto asociado, se guardan los datos en la colección `Invoice` de MongoDB y se recalcula en tiempo real el `scoring` crediticio del contacto. Si la factura se elimina en HubSpot, se borra de MongoDB y se actualiza el scoring del lead.

## Fases del 11 de junio de 2026 (Campo Cédula / DNI en Contactos)

- **Actualización del esquema local Dexie.js (versión 7)**: Agregado el campo `documentId` a la interfaz `LocalLead` e indexado para búsquedas rápidas offline.
- **Actualización del esquema de MongoDB (Mongoose)**: Agregado el campo `documentId` a `LeadSchema` con un índice único disperso (`sparse`) para garantizar unicidad global sin conflictos en registros vacíos.
- **Mapeo en la capa del CRM (HubSpot)**: Vinculado el campo `documentId` a la propiedad personalizada de HubSpot `national_id_number` en el método `upsertLead` y en la sincronización de entrada `fetchLeadsByOwner`.
- **Sincronización Bidireccional**: Configurado el traspaso del nuevo campo en `pushClientChanges`, `pullServerUpdates`, `syncMongoDBToCRM`, y en el hook del cliente `useSync.ts`.
- **Suscripción a Webhooks**: Agregada la propiedad `national_id_number` en el webhook receptor para procesar actualizaciones externas de DNI en caliente.
- **Formulario CRUD de UI**: Agregado el campo de entrada obligatorio "Cédula / DNI \*" en `LeadFormModal` con validaciones robustas antes del guardado y verificación local de unicidad en IndexedDB.
- **Dashboard y Drawer de detalles**: Mejorada la visualización del DNI en la tabla de contactos (debajo del nombre), en las tarjetas móviles y en la cabecera del Drawer de detalles, y habilitada la búsqueda de contactos por su DNI. Se añadió un indicador visual de carga (icono de lupa animada `Loader2` girando) en el campo de entrada del buscador para retroalimentar la búsqueda global activa en tiempo real.
- **Búsqueda Global Dinámica (HubSpot Fallback)**: Añadida la función `fetchLeadByDocumentId` a `ICRMProvider`, `MockCRMProvider` y `HubSpotCRMProvider`. Modificada la Server Action `searchGlobalLeadByDocumentId` para buscar el contacto directamente en HubSpot si no se encuentra localmente en MongoDB. Si existe, se importa en caliente asignándolo al dueño local correspondiente, o a `'system_fallback'` (lo que lo marca como de solo lectura), logrando consistencia incluso para contactos sin dueño o de otros asesores.
- **Sincronización On-Demand de Detalles**: Modificada la Server Action `getGlobalLeadDetails` para descargar y sincronizar en caliente facturas, actividades y préstamos (deals) del contacto desde HubSpot hacia MongoDB antes de responder al cliente, garantizando que el timeline y la pestaña de préstamos de cualquier contacto importado dinámicamente se carguen en tiempo real.
- **Corrección de Errores de Tipado**: Corregido error en `contacts/page.tsx` agregando la propiedad `synced: true` obligatoria para el mapeo local de actividades y préstamos (deals) ajenos traídos de MongoDB.
- **Robustecimiento del Importador de HubSpot**: Modificada la función `pullServerUpdates` en `sync.ts` para que actualice la información del contacto en MongoDB (incluyendo el `documentId`) si ya existe y no tiene cambios locales pendientes de sincronizar (`crmSynced !== false`), garantizando la consistencia de datos tras actualizaciones manuales directas en el CRM.
- **Suite de Pruebas**: Actualizados los tests E2E de Playwright (`tests/sync.spec.ts`) para incluir el ingreso automático de DNI durante las pruebas de creación de contactos offline/online.

## Fases del 11 de junio de 2026 (Nuevo Rol de Supervisor, Dashboard e Importación)

- **Actualización del esquema de Usuario (MongoDB)**: Modificado `User.ts` para soportar el nuevo rol `'supervisor'`, el puntero `supervisorId` para vincular vendedores a cargo y el campo dinámico `disbursementGoal` para el objetivo de desembolsos.
- **Tipado de NextAuth y Sesión**: Actualizado `next-auth.d.ts` y `auth.ts` para mapear el campo `role` del usuario y propagarlo reactivamente en la sesión del cliente.
- **Server Actions de Supervisión**: Creado el archivo `supervisor.ts` con acciones de backend para:
  - Consolidar métricas del equipo (suma de montos de desembolsos de deals, cantidad de operaciones y operaciones en aprobación).
  - Gestionar objetivos dinámicos y consultar listado de vendedores a cargo.
  - Importar prospectos (leads) de forma masiva desde archivos CSV, deduplicando por DNI/Email.
  - Derivar/Asignar prospectos a vendedores a cargo, marcando `crmSynced: false` para que el Outbound Engine actualice automáticamente el dueño en HubSpot.
- **Componente Visual SupervisorDashboard**: Creado el componente premium de React `SupervisorDashboard.tsx` con barras de progreso de metas, uploader inteligente de CSV con detección automática de separadores y nombres de columna, y una consola para reasignación de prospectos. Se integró un mecanismo de **polling silencioso periódico cada 15 segundos** para mantener las estadísticas del equipo y los préstamos del dashboard actualizados en tiempo real en segundo plano sin interrupciones.
- **Enrutamiento Condicional en Dashboard**: Modificado `page.tsx` para detectar el rol del usuario autenticado y alternar de forma transparente entre el panel estándar de vendedor y el nuevo dashboard del supervisor.

## Fases del 12 de junio de 2026 (Nuevo Rol de Administrador, Panel de Control y Soporte Multi-Roles)

- **Server Actions de Administración**: Creado el archivo `admin.ts` conteniendo acciones para:
  - Recuperar la lista completa de usuarios, discriminando supervisores y vendedores.
  - Actualizar roles de usuario, desvinculando automáticamente a su equipo si el rol deja de ser supervisor.
  - Asignar o reasignar de forma masiva a múltiples vendedores a cargo de un supervisor, desvinculándolos de su supervisor anterior automáticamente.
- **Consola de Administración de Usuarios**: Creada la página de cliente `admin/page.tsx` con una tabla de usuarios para filtrados por búsqueda, dropdowns para cambio inmediato de rol y un módulo lateral interactivo para la asignación masiva de vendedores.
- **Acceso Dinámico en Sidebar**: Modificado `Sidebar.tsx` para importar `ShieldAlert` y renderizar condicionalmente el link al panel `/admin` solo si el usuario autenticado posee el rol de `'admin'`.
- **Soporte de Roles Múltiples (Multi-roles)**:
  - **Base de Datos y Modelos**: Migrado el esquema `User.ts` de Mongoose para cambiar la propiedad singular `role` (string) a un array `roles` (de strings) con retrocompatibilidad transparente para registros antiguos.
  - **Soporte JWT y Sesión**: Actualizado `next-auth.d.ts` y `src/lib/auth.ts` para mapear el array `roles` y propagarlo de forma segura a través de tokens JWT y sesiones.
  - **Refactorización de Acciones**: Actualizadas las Server Actions en `admin.ts` y `supervisor.ts` para evaluar pertenencia a roles usando `.includes(...)` y queries `$or` sobre la base de datos para mantener compatibilidad.
  - **Panel de Administración de Roles en UI**: Refactorizado `admin/page.tsx` reemplazando el desplegable `<select>` de rol único por checkboxes interactivos estilizados como chips premium para permitir a los administradores asignar múltiples privilegios por usuario (p. ej. un usuario que es Admin y Supervisor a la vez). Se implementaron validaciones de frontend para evitar que un usuario sea despojado de todos sus roles.
  - **Visualización Condicional del Dashboard y Sidebar**: Actualizados `page.tsx` y `Sidebar.tsx` para verificar privilegios usando `.includes('supervisor')` e `.includes('admin')` respectivamente, resolviendo problemas de pérdida de visualización del dashboard de supervisor al ser promovido a administrador.
  - **Sincronización del Equipo para Supervisores (Offline y Negocios)**: Modificados `sync.ts` y `deals/page.tsx` para que, si el usuario autenticado tiene el rol de supervisor, se descarguen en su IndexedDB local los leads, deals, facturas y actividades de todos los vendedores de su equipo. Se ajustó el cruce de prestatarios en `DealsPage` eliminando el filtro restrictivo de propietario para evitar el bloqueo indefinido en "Cargando contacto...".
  - **Identificación de Asesor en Negocios (UI)**: Implementado el mapeo de nombres de asesores en `DealsPage` consultando `getSalespeople`. Se añadió dinámicamente la columna **Asesor / Vendedor** en la interfaz desktop y un campo descriptivo en las tarjetas móviles para dar visibilidad total al supervisor sobre qué asesor está gestionando cada negocio.
  - **Corrección de Advertencias de React Hooks (Linter)**: Envolviendo la función `loadData` de `admin/page.tsx` en `useCallback` y reestructurando la asignación del primer supervisor usando un actualizador de estado funcional para remover dependencias y solucionar el warning `react-hooks/exhaustive-deps` en el linter de compilación.
  - **Optimización de Consumo de Tokens (Ignored Files)**: Creados los archivos `.agentignore` y `.geminiignore` en la raíz del proyecto para evitar la lectura innecesaria de directorios de compilación (`.next/`), dependencias (`node_modules/`), credenciales del sistema, cachés y reportes temporales por parte de los asistentes agenticos de Inteligencia Artificial.
  - **Resiliencia y Auto-Sanación de Inconsistencias (Sync Engine)**: Incorporada una captura de error `404` específica al intentar asociar leads con empresas en `sync-engine.ts`. Si una empresa ha sido eliminada externamente en HubSpot pero su ID permanece huérfano en MongoDB, se limpia automáticamente su `crmId` y se marca como no sincronizada en MongoDB. Esto permite completar la sincronización del contacto sin bloqueos y programa la recreación automática de la empresa en HubSpot en el siguiente ciclo.
  - **Corrección de Bucle Infinito en Sincronización Local**: Reestructurados los condicionales de actualización en `useSync.ts` para priorizar la verificación de `id` sobre `tempId`. Esto soluciona la condición de carrera donde entidades con ambos campos definidos omitían la marca de sincronización completa en IndexedDB al no requerir mapeo del servidor, eliminando de raíz las peticiones redundantes en bucle cada 15 segundos.
  - **Validación de Dominio en el Frontend (Empresas)**: Agregada una expresión regular de validación en `CompanyFormModal.tsx` para comprobar el formato de dominio web (ej. `empresa.com`) al crear/editar una empresa. Esto impide guardar registros con formatos inválidos (como nombres de empresas o textos planos con espacios) en la base de datos, evitando que se generen errores HTTP 400 de validación de propiedades al intentar sincronizar con HubSpot.
  - **Rediseño del Dashboard del Vendedor (UI/UX)**: Reestructurada la página principal `page.tsx` para alinearse al diseño e información de la imagen de referencia. Se compactaron los badges de red, PWA y MFA en una barra superior discreta, y se implementó una grilla de 6 KPIs con datos reales del vendedor (Total Leads, Nuevos, En Proceso, Aprobados, Rechazados y Conversion Rate) calculados dinámicamente desde IndexedDB al cruzar leads y deals. Asimismo, se diseñó un embudo (funnel) trapezoidal en CSS puro con anchos decrecientes y degradados luminosos de alta fidelidad.

## Fases del 12 de junio de 2026 (Campo de Estado en Tabla de Contactos y Reglas de Transición)

- **Consulta reactiva de Deals y Actividades**: Agregadas las consultas globales `allDeals` y `allActivities` en `contacts/page.tsx`, y `activities` en `page.tsx` (Dashboard) de IndexedDB.
- **Resolución determinista de Estado**: Implementada la lógica de resolución en `getLeadStatus` (para el listado) y en los KPIs/Gráfico del Dashboard general. Ahora, un lead con una solicitud de préstamo en borrador (`draft`) o que ya posee al menos una actividad registrada es catalogado de manera consistente como **"En Proceso"** en lugar de "Nuevo" (Sin contactar), alineándose con el cambio de estado automático a "Opportunity" en HubSpot.
- **Visualización en UI Desktop y Móvil**:
  - **Tabla Desktop**: Incorporada una columna nueva **Estado** con chips coloreados estilizados siguiendo la paleta premium (Nuevo en azul, En Proceso en amarillo, Aprobado en verde, Rechazado en rojo).
  - **Vista Móvil**: Agregado el badge de estado directamente al lado del nombre de la empresa asociada en el pie de cada tarjeta de contacto móvil.

## Fases del 17 de junio de 2026 (Integración de WhatsApp con Infobip y HubSpot)

- **Capa de Persistencia y Modelos**:
  - Modificado el esquema Mongoose `Activity.ts` y la interfaz de IndexedDB local `LocalActivity` en `src/lib/db.ts` para soportar el nuevo tipo de actividad `'WHATSAPP'`.
  - Actualizada la interfaz de comunicación `CRMActivity` en `src/lib/crm/interface.ts` con soporte para `'WHATSAPP'`.
- **Capa de Mensajería Desacoplada (Messaging Layer)**:
  - Creado el contrato unificado `IMessagingProvider` en `src/lib/messaging/interface.ts` que permite el envío abstracto de mensajes y plantillas de WhatsApp.
  - Creada la factoría `MessagingProviderFactory` en `src/lib/messaging/factory.ts` para inyectar dinámicamente el proveedor activo basado en la variable de entorno `NEXT_PUBLIC_MESSAGING_PROVIDER`.
  - Creado el proveedor simulado `MockMessagingProvider` en `src/lib/messaging/providers/mock.ts` para pruebas y desarrollo ágil offline.
  - Creado el proveedor real `InfobipMessagingProvider` en `src/lib/messaging/providers/infobip.ts` consumiendo los endpoints `/whatsapp/1/message/text` y `/whatsapp/1/message/template` de la API de Infobip.
- **Mapeo y Sincronización con HubSpot**:
  - Modificado `src/lib/crm/hubspot.ts` para que `fetchActivitiesByLead` descargue los objetos de tipo `communication` de HubSpot con tipo de canal WhatsApp e incorpore estos mensajes al timeline local.
  - Modificada la creación de actividades `createActivity` en `hubspot.ts` para que, cuando el tipo de actividad sea `'WHATSAPP'`, cree y registre el objeto de comunicación correspondiente en la nube de HubSpot asociándolo mediante la relación por defecto `81` (Communication to Contact).
- **Webhook de Respuestas de WhatsApp en Tiempo Real**:
  - Creado el endpoint receptor de webhooks `src/app/api/webhooks/whatsapp/route.ts` que recibe notificaciones de mensajes entrantes de Infobip.
  - Implementado un algoritmo de comparación de teléfonos flexible (por sufijo `endsWith` con números limpios de caracteres especiales) para enlazar de forma resiliente el remitente con los Leads de la base de datos local y guardar el mensaje en MongoDB.
- **Interfaz de Usuario y Envío desde el Dashboard**:
  - Creada la Server Action `sendWhatsAppMessage` en `src/app/actions/whatsapp.ts` para despachar mensajes a través del proveedor configurado e insertarlos reactivamente en IndexedDB.
  - Modificado `contacts/page.tsx` para incorporar el soporte visual de WhatsApp (icono `MessageCircle` con color esmeralda) en el timeline del contacto.
  - Refactorizado el formulario de actividades en el Drawer de contactos para habilitar la opción de tipo "WhatsApp". Si se selecciona, el formulario oculta condicionalmente los campos innecesarios (Título y Recordatorios), habilita el botón contextual "Enviar WhatsApp" (con el icono `Send`), y despacha el mensaje llamando a la Server Action de forma instantánea.
  - **Selector Dinámico de Plantillas y Corriente de Chat**:
    - Implementado un selector de plantillas homologadas (`WHATSAPP_TEMPLATES`) que se activa condicionalmente cuando la ventana de 24 horas está cerrada (`wsActive === false`).
    - Diseñado un cargador de variables de plantilla que pre-llena la primera variable (`{{1}}`) con el nombre del lead de forma automática y muestra una vista previa del mensaje en tiempo real.
    - Movido el estado y cálculo de la ventana de 24 horas (`wsActive` y `wsText`) al cuerpo del componente principal para que sea compartido y evaluado correctamente tanto al enviar el mensaje como en el formulario.
    - Eliminados los bloques duplicados de sintaxis obsoleta en `contacts/page.tsx` para resolver errores de compilación JSX.

## Fases del 17 de junio de 2026 (Corrección de Sincronización de WhatsApp, Ventana de 24 hs e Indicador Reactivo)

- **Preservación del Sentido del Mensaje en HubSpot y MongoDB (Inbound/Outbound)**:
  - Modificado [src/lib/crm/hubspot.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/hubspot.ts) para enviar `hs_communication_logged_from: 'CRM'` de manera obligatoria en todas las comunicaciones de WhatsApp, cumpliendo con las reglas estrictas de validación HTTP 400 del CRM.
  - Modificado [src/app/actions/sync.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/actions/sync.ts) en `syncActivitiesForLead` para que, al sincronizar desde HubSpot, si la actividad de WhatsApp ya existe localmente en MongoDB, se preserve su título original (`existingAct.title`) en lugar de sobrescribirse por el mapeo genérico del CRM. Esto blinda permanentemente el estado de ventana activa.
- **Reloj Reactivo y Contadores en Tiempo Real**:
  - Incorporado el estado `nowTime` y un timer `setInterval` de 10 segundos en [contacts/page.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/(dashboard)/contacts/page.tsx). Esto actualiza todos los contadores de la ventana de chat libre de WhatsApp en tiempo real sin requerir interacción o recargas manuales.
- **Indicador Visual de Ventana Activa en Lista de Contactos**:
  - Implementada la función `getWhatsAppWindowStatus(lead)` en [contacts/page.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/(dashboard)/contacts/page.tsx) para evaluar reactivamente si la ventana de 24 horas está activa a partir del último mensaje entrante del contacto (incluyendo soporte resiliente para leads ajenos buscando en `foreignDetails`).
  - Añadido un badge visual interactivo debajo del número de teléfono en el listado de contactos (un círculo verde parpadeante con el tiempo restante, o un círculo gris con la etiqueta "Expirada" si finalizó) tanto en la vista de escritorio (tabla) como en la móvil (tarjetas).
- **Inicio de Clean Architecture (Fase 1 y Fase 2)**:
  - Creadas las entidades puras de dominio (`Company`, `Lead`, `Activity`, `Deal`, `Invoice`) en `src/core/entities/` para desacoplar el modelo del framework y de Mongoose.
  - Creadas las interfaces de repositorio (`ICompanyRepository`, `ILeadRepository`, `IActivityRepository`, `IDealRepository`, `IInvoiceRepository`) en `src/core/repositories/`.
  - Implementados los repositorios concretos para MongoDB usando Mongoose (`MongoDBCompanyRepository`, `MongoDBLeadRepository`, `MongoDBActivityRepository`, `MongoDBDealRepository`, `MongoDBInvoiceRepository`) en `src/infrastructure/repositories/mongodb/`.
  - Diseñada la factoría centralizada `RepositoryFactory` en `src/infrastructure/repositories/RepositoryFactory.ts` para resolver dinámicamente las instancias concretas, aislando la lógica de base de datos de la UI y de las Server Actions.

## Fases del 17 de junio de 2026 (Modularización y Reemplazo de UI en Contactos y Deals)

- **Modularización del UI de Contactos (Fase 2 del Blueprint)**:
  - Completado el reemplazo de la interfaz inline del Drawer lateral en [contacts/page.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/(dashboard)/contacts/page.tsx) por el componente modularizado [LeadDrawer.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/components/contacts/LeadDrawer.tsx).
  - Actualizado [LeadDrawer.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/components/contacts/LeadDrawer.tsx) para aceptar y gestionar reactivamente las props de resaltado de notificaciones (`highlightedActivityId`, `setHighlightedActivityId`) y el spinner de carga al consultar datos externos (`isLoadingForeign`).
  - Removidos estados obsoletos y handlers redundantes en [contacts/page.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/(dashboard)/contacts/page.tsx), reduciendo su tamaño de más de 2000 líneas a solo 1134 líneas.
- **Modularización de la UI de Deals (Fase 3 del Blueprint)**:
  - Creados los componentes modulares [DealTable.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/components/deals/DealTable.tsx) (para escritorio, hidden md:block) y [DealCard.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/components/deals/DealCard.tsx) (para móviles, md:hidden).
  - Extraído el helper de estilos y estados de préstamos `getStageConfig` para hacerlo autocontenido dentro de los componentes.
  - Refactorizado [deals/page.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/(dashboard)/deals/page.tsx) para importar y utilizar ambos subcomponentes, reduciendo su tamaño original de 544 líneas a solo 306 líneas y logrando una separación de responsabilidades limpia en el listado de préstamos.
  - **Modularización Extrema y Clean Architecture en todo el Dashboard (Hito de Consistencia)**:
    - **Sección Contactos**: 
      - Creado el componente [LeadCard.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/components/contacts/LeadCard.tsx) (tarjetas móviles).
      - Creado el custom hook [useContacts.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/hooks/useContacts.ts) conteniendo todo el estado, base de datos y efectos.
      - Reducido [contacts/page.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/(dashboard)/contacts/page.tsx) a solo **192 líneas** (código 100% declarativo y visual).
    - **Sección Empresas**:
      - Creados los componentes modularizados [CompanyTable.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/components/companies/CompanyTable.tsx) (desktop) y [CompanyCard.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/components/companies/CompanyCard.tsx) (móvil).
      - Creado el custom hook [useCompanies.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/hooks/useCompanies.ts) para la lógica de IndexedDB y soft delete de empresas.
      - Reducido [companies/page.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/(dashboard)/companies/page.tsx) a solo **85 líneas**.
    - **Sección Préstamos (Deals)**:
      - Creado el custom hook [useDeals.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/hooks/useDeals.ts) encapsulando los filtros y las métricas de créditos.
      - Reducido [deals/page.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/(dashboard)/deals/page.tsx) a solo **155 líneas** delegando a `DealTable` y `DealCard`.
    - **Dashboard Home**:
      - Creado el custom hook [useDashboard.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/hooks/useDashboard.ts) para el agrupamiento de estados y cálculo del embudo de ventas.
      - Reducido [page.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/(dashboard)/page.tsx) a un markup declarativo y limpio.
    - **Sección Configuración**:
      - Creado el custom hook [useSettings.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/hooks/useSettings.ts) y simplificado [settings/page.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/(dashboard)/settings/page.tsx).
    - **Sección Admin**:
      - Creado el custom hook [useAdmin.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/hooks/useAdmin.ts) y refactorizado [admin/page.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/(dashboard)/admin/page.tsx) a **229 líneas** de puros componentes visuales.

## Fases del 17 de junio de 2026 (Rediseño de la UI del Chat de WhatsApp en Timeline)

- **Rediseño Visual de Mensajes en [LeadDrawer.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/components/contacts/LeadDrawer.tsx)**:
  - Implementado renderizado condicional si la actividad es de tipo `'WHATSAPP'`.
  - Diseñadas burbujas estilo chat de WhatsApp asimétricas (`rounded-tr-none` para enviados y `rounded-tl-none` para recibidos).
  - Alineado binario según remitente: enviados a la derecha (`justify-end` en verde translúcido esmeralda) y recibidos a la izquierda (`justify-start` en gris oscuro).
  - Ocultados títulos repetitivos redundantes ("WhatsApp Enviado" / "WhatsApp Recibido") para mejorar el flujo de lectura.
  - Implementado formateo de fechas inteligente: solo muestra la hora para mensajes de hoy y añade fecha abreviada para días previos.
  - Ocultados en hover los controles de sincronización de base de datos/nube y el botón de borrado (`Trash2`) para mantener la interfaz despejada.
  - Actualizados los colores de los iconos Cloud de sincronización a verde esmeralda (`text-emerald-400` / `text-emerald-500`) en WhatsApp, actividades estándar y préstamos (deals) cuando están en estado sincronizado.
- **Corrección de Borrado de WhatsApp en HubSpot ([hubspot.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/hubspot.ts))**:
  - Corregida la función `deleteActivity` para direccionar adecuadamente el borrado de actividades de tipo `'WHATSAPP'` hacia el endpoint `/communications/{crmId}` en HubSpot en lugar del endpoint genérico `/notes/{crmId}`.
  - Actualizado el fallback de borrado sin tipo de `deleteActivity` para que intente eliminar de manera secuencial en `/notes`, `/tasks` y finalmente en `/communications`, evitando que los mensajes eliminados localmente "resuciten" al volver a sincronizar desde el CRM.
- **Desacoplamiento de Webhooks (CRM y WhatsApp)**:
  - Definida la interfaz `ParsedCRMWebhookEvent` y la firma `verifyAndParseWebhook` en [interface.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/interface.ts).
  - Implementado el método `verifyAndParseWebhook` en [hubspot.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/hubspot.ts) para realizar la validación de firmas (V3/V2/V1) y mapear propiedades específicas de HubSpot a nomenclatura genérica.
  - Implementado el mock de verificación de webhook en [mock.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/mock.ts).
  - Re-diseñado el endpoint [route.ts de CRM](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/api/webhooks/crm/route.ts) para que sea 100% genérico delegando firma y parseo al CRM Provider configurado.
  - Definida la interfaz `ParsedWebhookMessage` y la firma `parseWebhook` en [interface.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/messaging/interface.ts) de mensajería.
  - Implementado `parseWebhook` en [infobip.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/messaging/providers/infobip.ts) para traducir las notificaciones entrantes de Infobip.
  - Implementado `parseWebhook` en el mock de mensajería [mock.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/messaging/providers/mock.ts).
  - Re-diseñado el endpoint [route.ts de WhatsApp](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/api/webhooks/whatsapp/route.ts) para que sea 100% genérico delegando el procesamiento al Messaging Provider configurado.

## Fases del 18 de junio de 2026 (Análisis de Proceso Comercial y Modelado de Franquicias/Royalties)

- **Diagnóstico y Diseño del Modelo Comercial de Franquicias**:
  - Analizado el documento de consultoría [Proceso comercial.txt](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/feedback-images/Proceso%20comercial.txt) detallando la estructura de Aliados, Franquicias, Fuerza de Ventas (Captadores y Renovadores) y comisiones.
  - Creada la propuesta arquitectónica de modelo de datos en el archivo [franchise_architecture_design.md](file:///C:/Users/sergi/.gemini/antigravity-cli/brain/a8635076-1473-4864-891a-0b0fa76b8752/franchise_architecture_design.md).
  - Diseñado el mapeo a entidades estándar de HubSpot CRM utilizando asociaciones jerárquicas parent-child para Aliados/Franquicias y Owners con roles comerciales.
  - Diseñadas las modificaciones de los esquemas Mongoose de la aplicación (`Company`, `User`, `Lead`, `Deal`) para incorporar la estructura comercial y las validaciones de exclusividad (Regla Simply) y regalías (Royalties).

## Fases del 19 de junio de 2026 (Cifrado Extremo a Extremo en Reposo y Ventana Deslizable de Caché)

- **Cifrado Simétrico en el Servidor (MongoDB)**:
  - Creada una utilidad criptográfica central en `src/lib/crypto.ts` para cifrar y descifrar PII usando AES-256-CBC de Node.js con la clave del servidor `SERVER_ENCRYPTION_SECRET`.
  - Modificados los esquemas Mongoose `User.ts` (almacena la clave Dexie de cada usuario cifrada), `Lead.ts` y `Activity.ts` con getters y setters automáticos en Mongoose.
  - Creados campos de hash irreversibles SHA-256 para `emailHash` y `documentIdHash` en el modelo `Lead.ts` para indexación y queries eficientes y seguras.
  - Actualizado el script de migración `scripts/migrate-encryption.js` para cifrar registros antiguos en MongoDB.
- **Cifrado Simétrico en el Cliente (Dexie.js)**:
  - Propagada la clave de encriptación descifrada `dbEncryptionKey` a través del token JWT y la sesión de NextAuth en `src/lib/auth.ts` y `src/types/next-auth.d.ts`.
  - Creado el módulo `src/lib/client-crypto.ts` que utiliza el Web Crypto API nativo (`crypto.subtle`) del navegador para cifrar y descifrar con AES-256-GCM las tablas de IndexedDB (`leads` y `activities`).
  - Desarrollada la desencriptación en caliente asíncrona dentro de los custom hooks `useContacts`, `useDashboard`, `useDeals` y `useNotifications` mediante estados locales y efectos vinculados a `useLiveQuery`.
  - Modificados los formularios `LeadFormModal` y `LeadDrawer` para encriptar datos PII y actividades en caliente antes de escribirlos en Dexie.
- **Purga de IndexedDB en Logout**:
  - Implementado el observador global `SessionPurgeObserver` en `src/app/providers.tsx` que detecta de manera reactiva la pérdida de autenticación del usuario (logout, expiración) y ejecuta `localDb.delete()` para borrar toda IndexedDB del disco, reforzando la seguridad.
- **Caché Acotada y Ventana Deslizable (Sliding Window)**:
  - Implementado el algoritmo `purgeLocalCache(userId)` en el worker `useSync.ts` que se ejecuta al final de cada ciclo exitoso de sincronización. Si la cantidad de leads en Dexie supera los 100, selecciona los leads candidatos (aquellos completamente sincronizados, sin deals/préstamos activos y no modificados en los últimos 7 días) y los purga en cascada (leads, actividades, deals, facturas) de la base local.
  - Desarrollado el mecanismo de descarga perezosa ("on-demand") y auto-caché en `useContacts.ts`: si se selecciona un lead que pertenece al usuario pero no está local (purgado de Dexie), descarga sus detalles completos desde MongoDB y los escribe en IndexedDB de forma encriptada, integrándolo reactivamente en la caché del navegador.
- **Optimización de Polling de Sincronización**:
  - Modificada la Server Action `pullServerUpdates` en `src/app/actions/sync.ts` para que el polling periódico en segundo plano sólo descargue detalles (facturas, actividades, deals) de aquellos leads modificados desde la última sincronización (`updatedAt > sinceDate`), previniendo consultas innecesarias en la base intermedia.
- **Corrección de Test E2E de Playwright (Sistema de Recordatorios)**:
  - Corregida la condición visual del título de las actividades en el timeline de [LeadDrawer.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/components/contacts/LeadDrawer.tsx) para prepender dinámicamente `"Recordatorio: "` únicamente si la nota cuenta con un recordatorio activo (`reminderDate` presente), logrando la alineación perfecta con las expectativas y aserciones de la suite de pruebas automatizadas y permitiendo que todos los tests de Playwright pasen exitosamente.
- **Cabeceras de Seguridad y Content Security Policy (CSP)**:
  - Implementado un conjunto de cabeceras HTTP de seguridad robustas en [next.config.mjs](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/next.config.mjs), incluyendo directivas estrictas de `Content-Security-Policy` (CSP) para mitigar ataques de tipo Cross-Site Scripting (XSS), además de cabeceras de prevención para Clickjacking (`X-Frame-Options: DENY`, `frame-ancestors 'none'`), MIME sniffing (`X-Content-Type-Options: nosniff`) y limitación de APIs del navegador (`Permissions-Policy`).
- **Estabilización de Autenticación MFA en Pruebas**:
  - Corregida condición de carrera en [mfa-setup/page.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/auth/mfa-setup/page.tsx) mediante la implementación de una referencia mutable síncrona `useRef` (`initiatedRef`) que bloquea ejecuciones concurrentes de la promesa `generateMfaSetup()` durante los re-renderizados causados por actualizaciones de la sesión en NextAuth, garantizando la consistencia del secreto MFA entre el cliente y el servidor y estabilizando al 100% las pruebas de integración de Playwright.
- **Limpieza de Esquema de MongoDB**:
  - Eliminado índice redundante en el campo `documentIdHash` en [Lead.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/models/Lead.ts) para resolver la advertencia de duplicación de Mongoose en la consola del servidor durante las pruebas de integración.

_Última actualización: 2026-07-01_

## Fases del 1 de julio de 2026 (Integración Multi-CRM y Adaptador para Salesforce)

- **Instalación de Dependencias:** Instalación de la librería `jsforce` y sus tipos `@types/jsforce` para habilitar la comunicación estructurada con Salesforce.
- **Creación del Adaptador Salesforce:** Creado el archivo `src/lib/crm/salesforce.ts` que implementa la interfaz `ICRMProvider` utilizando llamadas API REST y consultas SOQL.
- **Mapeo de Datos de Salesforce:**
  - Leads ➔ Objeto estándar `Contact` (con campos personalizados `National_ID_Number__c` para DNI y `Scoring__c`).
  - Companies ➔ Objeto estándar `Account` (con el campo personalizado `Domain__c`).
  - Deals ➔ Objeto estándar `Opportunity` (con el rol `OpportunityContactRole` para asociación de leads).
  - Invoices ➔ Objeto personalizado `Invoice__c` con campos de importes y fechas, vinculado por Lookup a `Contact`.
  - Activities ➔ Objeto estándar `Task` codificando los tipos locales de actividad en el `Subject`.
- **Registro en la Factoría:** Modificado `src/lib/crm/factory.ts` para instanciar dinámicamente el proveedor de Salesforce cuando se configure `CRM_PROVIDER="salesforce"`.
- **Variables de Entorno:** Actualizado `.env.template` con los parámetros de Salesforce OAuth y credenciales.

## Fases del 2 de julio de 2026 (Resolución de Autenticación Salesforce — Client Credentials Flow)

- **Migración del Flujo de Autenticación:** Reemplazado el flujo Username-Password + Security Token (bloqueado por defecto en Salesforce desde Summer '23) por **OAuth 2.0 Client Credentials Flow** en `src/lib/crm/salesforce.ts`. El método `getConnection()` ahora realiza un `POST` directo al endpoint `/services/oauth2/token` usando `grant_type=client_credentials` e inicializa la conexión `jsforce` con el `access_token` e `instance_url` devueltos, eliminando la dependencia de `conn.login()`.
- **Configuración en Salesforce Developer Edition:**
  - Habilitado el **"Activar flujo de credenciales de cliente"** en la Connected App `Dashboard CRM PWA` (ruta: Compilar → Crear → Aplicaciones → Modificar).
  - Asignado el **usuario de ejecución "Sergio Genes"** en la sección "Flujo de credenciales de cliente" de las políticas de la app (ruta: Gestionar → Modificar políticas).
- **Corrección de URL de Autenticación:** Identificado que el flujo Client Credentials **no funciona con `login.salesforce.com`** — requiere el dominio específico de la org (My Domain). Actualizada la variable `SALESFORCE_LOGIN_URL` a `https://orgfarm-2325759fb2-dev-ed.develop.my.salesforce.com`. La URL de la UI (`*.lightning.force.com`) se convierte a API (`*.my.salesforce.com`) reemplazando el subdominio.
- **Autenticación verificada:** El servidor ya no arroja `invalid_grant`. La conexión con Salesforce queda establecida correctamente.

### Pendiente para continuar (Corrección de Esquema en Salesforce)

El campo de dominio en el objeto `Account` fue creado con nombre en español ("Dominio"), generando el API name `Dominio__c` en lugar del esperado `Domain__c`. El código usa `Domain__c` (consistente con HubSpot), por lo que la corrección se realizará en Salesforce:

1. Setup → Gestor de objetos → Cuenta → Campos y relaciones → eliminar `Dominio__c`
2. Crear nuevo campo Texto(255) con etiqueta en inglés `Domain` → API name resultante: `Domain__c`
3. Verificar que el resto del esquema personalizado (`National_ID_Number__c`, `Scoring__c`, `Invoice__c` y sus campos) tenga los API names correctos antes de probar la sincronización de un contacto.

## Fases del 6 de julio de 2026 (Estabilización de Salesforce y Webhooks de Facturas)

- **Corrección de esquema pendiente resuelta:** creado el campo `Balance_Due__c` (Moneda 16,2) en `Invoice__c`, faltante desde la configuración inicial. Confirmado que el resto de los campos (`Amount__c`, `Status__c`, `Invoice_Date__c`, `Due_Date__c`, `Payment_Date__c`, `Contact__c`) ya coincidían.
- **Fix de sesión inválida (`INVALID_SESSION_ID`):** Next.js App Router compila el código en capas de módulos aisladas (`rsc`, `action-browser`, `edge`), cada una con su propia copia de `factory.ts`. Como `CRMProviderFactory` usaba un campo estático de clase (salvo para el mock), Salesforce terminaba con múltiples instancias del provider logueándose de forma independiente y compitiendo por la misma sesión del usuario de ejecución. Se migró `factory.ts` para cachear **todos** los proveedores (no solo el mock) en `globalThis`, garantizando una única instancia y una única sesión por proceso. Además, se agregó en `salesforce.ts` un wrapper `withConnection()` que detecta `INVALID_SESSION_ID` y reintenta una vez con login nuevo, en vez de confiar en el timer fijo de 1 hora (`tokenExpiryMs`).
- **Fix de fecha de recordatorio en Salesforce:** en `createActivity`, el campo `ActivityDate` (Fecha de vencimiento del Task) se llenaba con la fecha de creación de la nota en vez de la fecha del recordatorio (`reminderDate`). Corregido para que `ActivityDate`/`ReminderDateTime` reflejen el recordatorio cuando existe. Como consecuencia, se agregó `CreatedDate` a la consulta de `fetchActivitiesByLead` y se usa ese campo (inmutable, fecha real de creación en Salesforce) para el `timestamp` de la actividad, en vez de `ActivityDate`.
- **Auto-recuperación del loading de sesión (NextAuth):** el layout del dashboard quedaba colgado en "Verificando credenciales de seguridad..." si el fetch inicial de `/api/auth/session` se cortaba (p. ej. al reiniciar el servidor de desarrollo con una pestaña ya abierta), ya que `refetchOnWindowFocus` y `refetchWhenOffline` están desactivados a propósito en `providers.tsx`. Se agregó un watchdog en `(dashboard)/layout.tsx` que reintenta con `update()` de `useSession()` cada 5s mientras `status === 'loading'`, sin requerir F5 manual.
- **Diagnóstico de sincronización de facturas creadas directamente en Salesforce:** las facturas no llegaban a la app porque `syncInvoicesForLead` solo se dispara (a) en el polling de fondo, únicamente para leads con `updatedAt` modificado localmente recientemente, o (b) on-demand en `getGlobalLeadDetails`, solo para leads ajenos o purgados de la caché local. Un contacto propio y ya cacheado, con una factura creada directamente en Salesforce, no cae en ninguno de los dos casos. A diferencia de HubSpot, Salesforce no tenía webhooks configurados para avisar estos cambios de forma proactiva.
- **Simplificación del webhook genérico de facturas:** modificado `src/app/api/webhooks/crm/route.ts` para que `invoice.upsert` siempre traiga el estado completo y autoritativo de la factura vía `crm.fetchInvoiceById(crmId)`, en vez de parchear campo a campo con `propertyName`/`propertyValue` (patrón que solo se aplicaba en la creación inicial, no en actualizaciones). Esto simplifica el payload que debe enviar cualquier proveedor (solo el ID) y evita drift si se pierde algún evento intermedio.
- **Implementación de webhooks reales para Salesforce (en curso):**
  - Creada la clase Apex `InvoiceWebhookNotifier` (`Queueable, Database.AllowsCallouts`) que recibe una lista de IDs de `Invoice__c` y hace un callout HTTP POST a `/api/webhooks/crm` con el payload `{ events: [{ subscriptionType, crmId }, ...] }`.
  - Creado el trigger `InvoiceWebhookTrigger` sobre `Invoice__c` (`after insert, after update, after delete`) que encola el Queueable.
  - Configurado el Remote Site Setting `DashboardCRM_Webhook` apuntando al túnel de ngrok.
  - Actualizado `.env.template`: removidas las variables obsoletas `SALESFORCE_USERNAME`/`SALESFORCE_PASSWORD`/`SALESFORCE_SECURITY_TOKEN` (del flujo de auth viejo, ya no se usan con Client Credentials Flow) y agregada `SALESFORCE_WEBHOOK_SECRET`.
  - Instalado `ngrok` vía `winget` para exponer `localhost:3000` con dominio estático (`clamp-limit-gruffly.ngrok-free.dev`). Se resolvió un conflicto de versión de configuración (`ngrok.yml` tenía formato v3 de una instalación previa, incompatible con el binario recién instalado v3.3.1) migrando el archivo a formato v2, y luego se actualizó el binario a la v3.39.9 vía `ngrok update` porque la cuenta del usuario exige mínimo v3.20.0.

### Pendiente para mañana

1. Actualizar la clase Apex `InvoiceWebhookNotifier` con: la URL real del endpoint (`https://clamp-limit-gruffly.ngrok-free.dev/api/webhooks/crm`), el header `ngrok-skip-browser-warning: true` (necesario para que el plan gratuito de ngrok no interponga su página de advertencia HTML), y un token secreto real.
2. Setear ese mismo token en `SALESFORCE_WEBHOOK_SECRET` en `.env.development.local` y reiniciar el servidor.
3. Levantar el túnel (`ngrok http 3000 --domain=clamp-limit-gruffly.ngrok-free.dev`) y probar editando la factura `FAC-001` en Salesforce, verificando en la consola del servidor el log `[Webhook CRM] Factura crmId ... guardada/actualizada.` y en la pestaña Finanzas del contacto en la app.
4. Verificar que el picklist `Status__c` de `Invoice__c` tenga exactamente los valores `PENDING`, `PAID`, `OVERDUE` (inglés, mayúsculas) — el código no traduce ni normaliza este campo.
5. Evaluar si conviene extender el mismo patrón de webhooks (Apex trigger + Queueable) a `Contact` y `Account` para reflejar en tiempo real ediciones hechas directamente en Salesforce, replicando la cobertura que ya existe para HubSpot.

_Última actualización: 2026-07-06_

## Fases del 24 de julio de 2026 (Fixes de Búsqueda/Recordatorios y Webhooks de Deals con HubSpot)

- **Corrección de Búsqueda Global de Contactos:** en `searchGlobalLeads` ([src/app/actions/sync.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/actions/sync.ts)), los contactos encontrados en HubSpot por texto libre (nombre, no solo DNI/email exacto) se importaban correctamente a MongoDB pero luego se descartaban al volver a consultar la base local con el mismo filtro estrecho de hash exacto (`documentIdHash`/`emailHash`). Se corrigió capturando los `_id` de los leads recién importados/actualizados y agregándolos con `$in` a la query final.
- **Corrección de Tipado en el Adaptador Salesforce:** en [src/lib/crm/salesforce.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/salesforce.ts), el `build` de producción fallaba porque `conn.query()` de `jsforce` devuelve un objeto `Query` "thenable" pero no compatible en su tipado con `Promise<T>` (le faltan `finally` y `Symbol.toStringTag`). Se marcaron como `async` las 9 funciones flecha que retornaban `conn.query(...)` directamente a `withConnection`, resolviendo el error de compilación sin cambiar el comportamiento en runtime.
- **Notas con Recordatorio Generan Task Acompañante:** en [LeadDrawer.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/components/contacts/LeadDrawer.tsx), al crear una actividad con recordatorio activo cuyo tipo elegido no es ya `TASK` (p. ej. una `NOTE`), ahora se registran **dos** Activities locales separadas: la principal con el tipo elegido (sin `reminderDate` propio) y una `TASK` compañera con el mismo título/cuerpo que sí lleva el `reminderDate`. Antes, el recordatorio quedaba adjunto a la Nota y nunca generaba la Task nativa en el CRM (`createActivity` en `hubspot.ts` solo crea Task cuando `type === 'TASK'`).
- **Nueva Rama `feature/deal-webhook-sync` — Sincronización Entrante de Deals:** hasta ahora el webhook de CRM (`route.ts`) sólo procesaba eventos de `lead`, `company`, `invoice` y `association`; los cambios de etapa (`dealstage`) hechos directamente en HubSpot nunca llegaban a la app.
  - [src/lib/crm/interface.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/interface.ts): agregado `'deal.upsert' | 'deal.deletion'` a `ParsedCRMWebhookEvent` y el método `fetchLeadIdAssociatedWithDeal(dealCrmId)` a `ICRMProvider`.
  - [src/lib/crm/hubspot.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/hubspot.ts): mapeo de `deal.*` en `verifyAndParseWebhook` + implementación de `fetchLeadIdAssociatedWithDeal` vía `/deals/{id}/associations/contacts`.
  - [src/lib/crm/salesforce.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/salesforce.ts): `fetchLeadIdAssociatedWithDeal` vía SOQL sobre `OpportunityContactRole` (no requirió tocar `verifyAndParseWebhook`, que ya reenvía el `subscriptionType` genérico tal cual).
  - [src/lib/crm/mock.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/mock.ts): implementación trivial reutilizando el `dealAssociations` Map existente.
  - [src/app/actions/sync.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/actions/sync.ts): exportada `syncDealsForLead` (antes privada) para reutilizar desde el webhook toda la lógica ya probada de mapeo de stage (`hsStageToLocal`) y metadata (`termMonths`/`interestRate`/sub-etapas), en vez de duplicarla.
  - [src/app/api/webhooks/crm/route.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/api/webhooks/crm/route.ts): agregados los bloques `deal.deletion` (hard delete, igual que lead/company/invoice) y `deal.upsert` (resuelve el Lead dueño del Deal —por el Deal local existente o preguntándole al CRM si es nuevo— y llama a `syncDealsForLead`).
- **Fix Crítico — Ventana de 20s Bloqueaba Actualizaciones desde Webhook:** `syncDealsForLead` tiene un guard que descarta actualizaciones si el Deal local fue tocado en los últimos 20 segundos (pensado para que el polling de auto-sanación en background no pise ediciones locales recién hechas — ver sección del 2 de junio). Como crear un Deal desde la app ya "toca" `updatedAt` (al marcarlo `crmSynced: true`), cambiar su stage en HubSpot dentro de esos ~20s hacía que el webhook llegara bien pero la actualización se descartara silenciosamente, sin ningún log. Se agregó el parámetro `options.bypassRecencyGuard` a `syncDealsForLead`, seteado en `true` únicamente cuando se llama desde el webhook (ahí el CRM es la fuente de verdad de un cambio en tiempo real, no hay riesgo real de pisar una edición local reciente). El guard de `!existingDeal.crmSynced` se mantiene siempre, para no pisar cambios locales genuinamente pendientes de subir.
- **Configuración de Suscripciones de Webhook en HubSpot (Private App):**
  - **Deals:** `deal.creation`, `deal.deletion` y `deal.propertyChange` sobre las propiedades `dealstage`, `dealname`, `amount`, `description`, `closedate`, `hubspot_owner_id` (las mismas 6 que lee `fetchDealsByLead`).
  - **Contacts:** `contact.creation`, `contact.deletion` y `contact.propertyChange` sobre `firstname`, `lastname`, `email`, `phone`, `national_id_number` (las únicas 5 propiedades que traduce el mapeo de `hubspot.ts`/`route.ts`).
  - Se detectó y corrigió un error de configuración: el **Target URL** de las suscripciones apuntaba solo al dominio raíz de ngrok, sin el path `/api/webhooks/crm` — por eso ningún evento llegaba al servidor (confirmado revisando que no aparecía ninguna request en el inspector de ngrok, `http://127.0.0.1:4040`, al disparar el evento en HubSpot).

### Cómo levantar ngrok para probar webhooks en local

El proyecto usa un dominio estático reservado de ngrok (`clamp-limit-gruffly.ngrok-free.dev`) en vez de uno aleatorio, para no tener que reconfigurar el Target URL en HubSpot/Salesforce cada vez que se reinicia el túnel:

```bash
ngrok http 3000 --domain=clamp-limit-gruffly.ngrok-free.dev
```

- Requiere tener el servidor de Next.js corriendo en el puerto `3000` (`npm run dev` o `npm run build && npm start`).
- El **Target URL** configurado en cada proveedor de CRM debe incluir el path completo del endpoint, no solo el dominio:
  - HubSpot (Private App → Webhooks): `https://clamp-limit-gruffly.ngrok-free.dev/api/webhooks/crm`
  - Salesforce (Remote Site Setting `DashboardCRM_Webhook`, ver sección del 6 de julio): mismo dominio, mismo path.
- Para depurar por qué un webhook no llega a la app, en ese orden:
  1. Abrir `http://127.0.0.1:4040` (inspector local de ngrok) y disparar el evento en el CRM — si no aparece ninguna request, el problema es 100% de configuración en el CRM (Target URL incompleto/incorrecto, suscripción pausada, o el switch maestro de "Webhooks enabled" de la Private App apagado), no del código.
  2. Si la request sí llega pero con error, revisar el código de respuesta y el log del servidor (`[Webhook CRM] ...`).
  3. En HubSpot, cada suscripción tiene un panel de **Details** con el historial de entregas recientes (delivered/failed) y el código de respuesta recibido.
- Nota: al reiniciar `npm start` (build de producción) tras un cambio de frontend, conviene desregistrar el Service Worker de la PWA (DevTools → Application → Service Workers → Unregister) o probar en incógnito — de lo contrario el navegador puede seguir sirviendo el bundle JS cacheado de la versión anterior.

_Última actualización: 2026-07-24_

## Fases del 21 de agosto de 2026 (Fix Feedback #13 y Documentación de Migración a Nueva Arquitectura)

- **Fix Feedback #13 (parte 1) — "Ver Historial Crediticio":** corregido en la rama `feature/feedback-13-fix-credit-history-button` para que el botón abra el drawer del contacto directamente en la pestaña **Finanzas** en vez de la pestaña por defecto (`contacts/page.tsx`, `useContacts.ts`, `LeadCard.tsx`, `LeadTable.tsx`, `LeadDrawer.tsx`). Mergeado a `develop`.
- **Documentación de migración a la nueva arquitectura (BFF + microservicios):**
  - Analizado el documento de referencia de Negofin [20260812-307HPN-Arquitectura_de_la_solucion_Portal_de_Vendedores_v01.docx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/Documentacion/20260812-307HPN-Arquitectura_de_la_solucion_Portal_de_Vendedores_v01.docx) (v01, Lucio Flores): define la migración del backend a BFF + microservicios NestJS/PostgreSQL (uno por contexto: Leads, Asignación, Workflow, Agenda, Notificación, Reportes) + bus de eventos (RabbitMQ/SQS) + capa anticorrupción sobre todo sistema externo (SGC, Solucred, HubSpot, BSP de WhatsApp, proveedor de inferencia). El frontend Next.js/PWA se mantiene conceptualmente.
  - Revisadas y resueltas con el usuario, punto por punto, las divergencias entre el comportamiento actual de la app y esa arquitectura nueva: retiro del módulo Empresas, exclusión del chat de WhatsApp y del MFA (TOTP) actuales de la primera versión (se documentan como referencia, se rediseña MFA como OTP por email/SMS con SendGrid), sincronización con HubSpot estrictamente unidireccional (se excluyen tanto el webhook entrante de deals como la creación de leads vía búsqueda global/import por owner), descarte del cálculo de scoring en el portal (pasa a consultarse por API al core financiero), remoción de la edición/alta offline de solicitudes de préstamo, descarte de la integración Salesforce (HubSpot confirmado como CRM único, manteniendo el patrón de adaptador desacoplado `ICRMProvider`). Queda como único punto abierto real (no cubierto por el documento de arquitectura) el modelo de Franquicias/Sucursales/Royalties.
  - Generada la documentación completa en `docs/migration/` (12 archivos, barridos con 9 subagentes en paralelo sobre el código real): `README.md` (índice), `01-brechas-y-decisiones.md` (registro de las divergencias y decisiones de arriba), `00-trazabilidad-CU-RF.md` (matriz maestra cruzando cada CU-01..10 y RF-01..26 del documento de arquitectura contra el estado real del código), `contextos/` (`leads.md`, `asignacion-supervisor.md`, `workflow-deals.md`, `agenda-recordatorios.md`, `notificaciones-alertas.md`, `reportes-dashboard.md`, `identidad-admin-auth.md`), `integraciones-externas-actuales.md` (contrato real de HubSpot/Infobip, insumo para la capa anticorrupción) y `modelo-datos-actual.md` (esquemas Mongoose/Dexie y cifrado, insumo para los esquemas PostgreSQL por servicio).
  - Hallazgos más relevantes del barrido para tener en cuenta en la construcción de la nueva versión: RF-15 (asignación automática de leads) y RF-20 (concepto de "sucursal") no existen en ninguna forma hoy; el alta de usuario es autorregistro público sin aprobación de admin y no existe forma de dar de baja/desactivar un usuario, ni auditoría de identidad; de los 4 tipos de alerta que pide RF-17 solo 1 (recordatorios) tiene implementación real; la edición offline de deals en realidad nunca existió — solo alta y baja offline; HubSpot es hoy la autoridad de facto del `stage` del deal vía un parseo de comentario HTML oculto en `description`; no existe reconciliación nocturna ni control de cuota centralizado en la integración con HubSpot.
  - Rama `docs/migracion-arquitectura` creada desde `develop`, commit único con los 12 archivos, mergeada a `develop` (`--no-ff`) junto con `feature/feedback-13-fix-credit-history-button`, y pusheada a `origin/develop`.

### Pendiente para el lunes 24 de agosto

1. El usuario todavía no revisó el contenido completo de los 12 documentos de `docs/migration/` — solo se discutieron los hallazgos por resumen de chat.
2. Elevar a Negofin la definición de alcance de Franquicias/Royalties (única brecha sin resolver, el documento de arquitectura no la cubre).
3. Verificación puntual (no barrido nuevo) de 3 ítems marcados "no confirmado" en `00-trazabilidad-CU-RF.md`: RF-06 (registro rápido diferenciado), RF-10 (aviso de cambios sin guardar) y RF-26 (parametrización de terminología).
4. Confirmar si existe o falta una "parte 2" del feedback #13 (el commit de hoy se tituló explícitamente "parte 1").

_Última actualización: 2026-08-21_

