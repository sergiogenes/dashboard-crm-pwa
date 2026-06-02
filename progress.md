# Registro de Progreso - PWA CRM Dashboard

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
*   **Configuración en Producción:** Creación y despliegue del proyecto en **Vercel** vinculado a la cuenta existente de **MongoDB Atlas**.
*   **Soporte de Variables:** Soporte para las variables de entorno `prod_MONGODB_URI` y `prod_MONGODB_URI_URL` en la conexión de producción ([src/lib/mongodb.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/mongodb.ts)).
*   **Validación de PWA:** Despliegue completado con éxito; PWA plenamente probada e instalable en dispositivos móviles (Android/Chrome) en modo standalone con resolución de variables de entorno.

## Fases del 27 de mayo de 2026 (Privacidad, Asignación de Propietario en CRM y Sincronización)
*   **Forzar Base de Datos Dinámicamente:** Extracción automática de la base de datos de la URI de conexión. En producción sin base de datos en la URI, se conecta por defecto a `dashboard-pwa`. En desarrollo local y testing, respeta las bases de datos `dashboard-pwa` y `dashboard-pwa-test` / `testdb` respectivamente, evitando borrar datos de desarrollo en las pruebas.
*   **Visibilidad de Datos:** Re-arquitectura del flujo de sincronización y de la UI para que las Empresas sean compartidas globalmente por todos los usuarios y los Contactos (Leads) permanezcan privados para su creador.
*   **Asignación de HubSpot Owner:** Inyección condicional de la propiedad `hubspot_owner_id` en el adaptador de HubSpot, mapeada dinámicamente desde el `crmOwnerId` del usuario creador del contacto en MongoDB.
*   **Autodetectación de HubSpot Owner:** Mapeo automático del `crmOwnerId` consultando la API de HubSpot por el email del usuario en su primera sincronización. Se corrigió el enrutamiento de la petición al endpoint `/owners` de HubSpot redireccionándola fuera del prefijo `/objects`.
*   **Caché de Sesión Optimizado:** Configuración del Service Worker de la PWA (`next.config.mjs`) para usar la estrategia `NetworkFirst` para `/api/auth/session`, eliminando el bloqueo ("loading") infinito tras iniciar sesión en producción.
*   **Sincronización Inbound Robusta:** Incorporación de un fallback que fuerza la importación desde HubSpot si la base de datos de MongoDB está vacía, y propagación explícita de errores al cliente para asegurar reintentos en fallos de conexión o autenticación.
*   **Autosanación de Sincronización Outbound:** Integración de la llamada a `syncMongoDBToCRM` en `pullServerUpdates` para actuar como mecanismo de autosanación, resolviendo de forma transparente problemas con registros huérfanos (como el caso de "Jua per") en los ciclos de polling periódico tras una caída o interrupción.
*   **Alineación de Bases de Datos en Tests:** Introducción de `IS_PLAYWRIGHT_TEST=true` para forzar a Mongoose a conectarse a `dashboard-pwa-test` durante la ejecución de los tests, garantizando que el servidor de desarrollo y el test runner compartan el mismo almacenamiento.
*   **Resiliencia ante Duplicados en HubSpot:** Captura robusta de errores 400 de conflicto por email duplicado debido a latencias de indexación en la búsqueda de HubSpot, extrayendo el ID del contacto en conflicto para realizar una actualización (`PATCH`) transparente.
*   **Optimización de Tiempos de Conexión en Redes Lentas:** Incrementado el timeout de Mongoose a 15s (`serverSelectionTimeoutMS`), el abort timeout del frontend en login a 20s y el tiempo límite global de Playwright a 60s para prevenir falsos fallos y timeouts debido a latencia DNS o TCP en la conexión a MongoDB Atlas.
*   **Estabilización del Estado Online en Tests:** Añadida una espera de 1 segundo tras restaurar la conexión a Internet en Playwright (`setOffline(false)`) para que la pila de red virtual se inicialice completamente antes de disparar peticiones, evitando fallos inmediatos por desconexión temporal.

## Fases del 28 de mayo de 2026 (Configuración de Webhooks y Resiliencia en Borrados)
*   **Suscripciones de Webhooks Activas:** Configurada la aplicación en HubSpot para gatillar eventos de creación (`company.creation`) y modificaciones de nombre y dominio (`company.propertyChange`) de empresas apuntando a la URL de producción.
*   **Verificación Híbrida de Firmas (V3/V2/V1):** Rediseñado el validador del webhook en [src/app/api/webhooks/crm/route.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/api/webhooks/crm/route.ts) para soportar la firma criptográfica V3 (HMAC-SHA256 con timestamp) y mantener la compatibilidad con firmas V2 (SHA-256) y V1 (MD5), solucionando el error `401 Unauthorized`.
*   **Persistencia de Soft Delete en Base Intermedia:** Modificado el motor de sincronización en [src/lib/crm/sync-engine.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/sync-engine.ts) para que las empresas y contactos eliminados no se borren físicamente de MongoDB. Se actualizan a `crmSynced: true` manteniendo de forma persistente su estado `deleted: true`.
*   **Protección contra Recreaciones en Webhook:** Ajustada la lógica en el endpoint del webhook ([src/app/api/webhooks/crm/route.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/api/webhooks/crm/route.ts)) para ignorar cualquier evento de cambio de propiedad si el registro en MongoDB ya está marcado como `deleted: true`. Esto evita que eventos atrasados del CRM recreen elementos eliminados.
*   **Prevención de Re-importaciones Cíclicas:** Modificada la función `pullServerUpdates` en [src/app/actions/sync.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/actions/sync.ts) para contar tanto registros activos como borrados al verificar si MongoDB está vacía, previniendo que se gatille la re-importación masiva desde HubSpot si el usuario borra todas sus entidades locales.
*   **Sincronización Continua Inbound:** Modificada la función `checkServerAndSync` en [src/hooks/useSync.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/hooks/useSync.ts) para disparar la sincronización de forma incondicional en cada ciclo de 15 segundos si el dispositivo está online y el servidor responde. Esto garantiza que las creaciones o modificaciones realizadas en HubSpot (e ingresadas vía Webhooks) se descarguen de inmediato y se reflejen en la UI sin necesidad de refrescar manualmente la página.

*   Tareas Completadas:
    - Despliegue de los cambios en producción a través de Vercel.
    - Pruebas exhaustivas de creación, edición y borrado completadas con éxito, confirmando el correcto funcionamiento del soft delete y del webhook de HubSpot sin bucles de sincronización ni retrasos en la UI.

---

## Fases del 29 de mayo de 2026 (Seguridad y Recuperación de Contraseña)
*   **Modelo de Tokens de Recuperación:** Creado el modelo `PasswordResetToken` en MongoDB con índice TTL para autodestrucción (expiración automática de 30 minutos).
*   **Servicio de Correo con SendGrid:** Configurado `src/lib/mail.ts` utilizando `@sendgrid/mail` con simulación en consola para entornos locales de desarrollo.
*   **Server Actions de Seguridad:** Creadas las acciones `requestPasswordReset` y `resetPassword` en `src/app/actions/password-reset.ts` con tokens seguros y hashing SHA-256.
*   **Interfaces de UI de Recuperación:** Creadas las vistas `/auth/forgot-password` y `/auth/reset-password` integradas con el formulario principal `/auth/signin`.
*   **Robustecimiento de Autenticación:** Unificados los mensajes de error en NextAuth (`src/lib/auth.ts`) a un único mensaje genérico en español para evitar la enumeración de usuarios (User Enumeration).

## Fases del 1 de junio de 2026 (Actividades de Contactos y Sincronización)
*   **Fase 1: Capa de Persistencia (Local y Servidor):**
    - Creado el modelo Mongoose `Activity` en MongoDB ([src/models/Activity.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/models/Activity.ts)).
    - Actualizado el esquema de la base local Dexie ([src/lib/db.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/db.ts)) a la versión 4, incorporando la tabla `activities` tipada con `LocalActivity` para soporte offline.
*   **Fase 2: Capa CRM (Adaptador):**
    - Añadidas las firmas y definiciones para `CRMActivity` en el contrato de CRM ([src/lib/crm/interface.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/interface.ts)).
    - Implementada la emulación en memoria de actividades en el proveedor simulado ([src/lib/crm/mock.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/mock.ts)).
    - Creados los métodos `createActivity` y `fetchActivitiesByLead` en el adaptador real de HubSpot ([src/lib/crm/hubspot.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/hubspot.ts)), utilizando la creación nativa de notas con asociación `202` (Nota a Contacto) y un motor resiliente de análisis basado en expresiones regulares para descifrar tipos, títulos y cuerpos.
*   **Fase 3: Integración en el Hook de Sincronización (useSync) y Badge:**
    - Modificado el hook de sincronización cliente-servidor `useSync.ts` para capturar actividades offline en Dexie, subirlas usando la Server Action `pushClientChanges`, y aplicar los mappings de IDs resultantes.
    - Implementada la descarga del servidor (Inbound Sync) de actividades, con resolución automática de referencias cruzadas (`leadId` local tempId/realId) y borrado en cascada local de actividades si se elimina un contacto.
    - Modificado `SyncStatusBadge.tsx` para incluir las actividades no sincronizadas en el conteo total de cambios locales pendientes.
*   **Fase 4: Interfaz de Usuario Reactiva y Cronología (Timeline) de Actividades:**
    - Re-diseñado el Slide-Over Drawer de detalles del lead en `contacts/page.tsx` para implementar una vista por pestañas: "Finanzas" e "Actividades".
    - Diseñado un formulario offline para registrar nuevas actividades con selección de tipo (`NOTE`, `CALL`, `MEETING`, `EMAIL`, `TASK`), título y descripción, persistidas reactivamente en Dexie.
    - Implementada la cronología (timeline) de actividades en el Drawer con iconos distintivos de `lucide-react` y colores vibrantes según el tipo de actividad, mostrando indicadores de estado de sincronización (`Cloud` vs `Database`) y opción de eliminación local resiliente.
*   **Fase 5: Sistema de Recordatorios y Notificaciones (Campanita):**
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
        - **Drawer de Contacto con Pestaña Préstamos**: Modificado [src/app/(dashboard)/contacts/page.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/(dashboard)/contacts/page.tsx) añadiendo la pestaña "Préstamos" con un formulario de solicitud (Monto, Plazo, Interés, Notas) y un listado de préstamos activos representados con un Stepper horizontal del flujo de aprobación (`draft` -> `under_evaluation` -> `approved` -> `disbursed`), controlando también estados de alerta (`refused`, `overdue`, `completed`).
        - **Panel de Monitoreo General**: Rediseñado [src/app/(dashboard)/deals/page.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/(dashboard)/deals/page.tsx) como un Dashboard de solo lectura con filtros por etapa, búsqueda interactiva y métricas rápidas de los créditos activos, aprobados y en mora.
        - **Mapeo del Propietario del Deal (HubSpot Owner)**: Configurada la inyección de `hubspot_owner_id` en `upsertDeal` y `fetchDealsByLead` en [src/lib/crm/hubspot.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/hubspot.ts) recuperando el `crmOwnerId` del asesor desde MongoDB en [src/lib/crm/sync-engine.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/sync-engine.ts), garantizando que las solicitudes se carguen a nombre del vendedor creador.
        - **Sincronización Bidireccional de Etapas desde HubSpot**: Corregido el resolvedor de estados de deals en [src/app/actions/sync.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/actions/sync.ts) para procesar los cambios de columnas realizados directamente en la interfaz de HubSpot con prioridad, preservando las sub-etapas específicas del negocio local.

## Fases del 2 de junio de 2026 (Recordatorios Persistentes y Control de Alarmas)
*   **Persistencia de Lectura de Alertas (`reminderRead`)**:
    - **Esquemas local y servidor**: Agregada la propiedad `reminderRead` a la base local Dexie (`LocalActivity` en `db.ts`) y al modelo MongoDB (`Activity.ts`).
    - **Mapeo HubSpot**: Codificación automática del estado de lectura del recordatorio en el cuerpo del HTML de HubSpot (`<!-- reminder:TIMESTAMP,read:1 -->`) y descifrado correspondiente al descargar notas.
    - **Actualizaciones (PATCH) en HubSpot**: Modificada la API del adaptador en `hubspot.ts` para que al sincronizar cambios en notas existentes (`createActivity` con `activity.crmId` presente) realice una petición `PATCH` en lugar de duplicar la nota. Corregido también el mapeo de la fecha de vencimiento al crear la tarea nativa en HubSpot, asignando el vencimiento del recordatorio a la propiedad `hs_timestamp` de la tarea para cumplir con las especificaciones de HubSpot y evitar errores 400. Adicionalmente, se implementó el ciclo de vida completo de la tarea en HubSpot: al actualizar el recordatorio como leído se marca la tarea como `COMPLETED` en HubSpot, y al eliminar la alarma del dashboard se borra la tarea nativa (`DELETE /tasks/{id}`) de HubSpot buscando las tareas del contacto por su título.
    - **Sincronización de Estado de Lectura**: Modificadas las Server Actions (`sync.ts`) y el worker (`sync-engine.ts`) para transferir `reminderRead` en ambas direcciones.
    - **Orquestador de Alertas**: Modificado `useNotifications.ts` para inicializar y actualizar alertas locales como ya leídas/notificadas si la actividad asociada tiene `reminderRead: true`, previniendo repeticiones infinitas tras logouts.
    - **Persistencia en Cabecera**: Al hacer clic en un recordatorio o pulsar "Marcar todo leído" en `Header.tsx`, se marca `reminderRead: true` y `synced: false` en la actividad local usando su llave primaria (`tempId`), subiéndose automáticamente a la nube.
    - **Resolución de Condiciones de Carrera (SSOT)**: Modificado el resolvedor descendente (`syncActivitiesForLead` en `sync.ts`) para usar `$setOnInsert` en los campos `reminderDate` y `reminderRead`. Al no sobreescribir estos campos si el documento de actividad ya existe en MongoDB, garantizamos que las acciones locales (como marcar leído o borrar la alarma) tengan prioridad absoluta y no se vean alteradas por retrasos o consistencia eventual de la API de HubSpot.
*   **Gestión y Eliminación de Alertas**:
    - **Control en Cronología (UI)**: Se re-diseñó la visualización de recordatorios en el timeline de `contacts/page.tsx`, incorporando una tarjeta informativa premium con dos opciones de acción directa: **"Marcar Leído"** (para silenciar el recordatorio manteniendo su fecha) y **"Quitar Alarma"** (para remover la fecha de recordatorio permanentemente de la nota).
    - **Función de Purgado (`handleRemoveReminder` y `handleMarkReminderAsRead`)**: Implementadas funciones que actualizan la IndexedDB local usando de forma segura su llave primaria `tempId` y persisten de forma explícita valores `null` en MongoDB para permitir la eliminación real de propiedades e impedir la reaparición de alarmas.

## Roadmap de Seguridad (Tareas Pendientes)
*   [x] **Autenticación Multifactor Obligatoria (MFA) - Fase 2:**
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
*   [x] **Rediseño del Layout (Sidebar Lateral y Páginas Independientes) - Fase 8:**
    - Creados los componentes estructurales [Sidebar.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/components/Sidebar.tsx) (sticky y colapsable) y [Header.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/components/Header.tsx) (buscador y avatar de usuario, con `SyncStatusBadge` integrado).
    - Configurado el Layout Maestro [src/app/(dashboard)/layout.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/(dashboard)/layout.tsx) para el route group `(dashboard)`.
    - Creadas las páginas independientes para [Contacts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/(dashboard)/contacts/page.tsx), [Companies](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/(dashboard)/companies/page.tsx), [Dashboard Home](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/(dashboard)/page.tsx) y [Settings](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/(dashboard)/settings/page.tsx) dentro del route group.
    - Se dejó lista la indicación para eliminar el archivo raíz obsoleto `src/app/page.tsx`.
    - **Corrección de Solapamiento y Scroll**: Corregido el solapamiento estético del botón de expandir/colapsar en el sidebar colapsado mediante un botón circular flotante posicionado de forma absoluta sobre el borde derecho y centrando dinámicamente el logotipo. Asimismo, se incorporó `overflow-x-hidden` en el layout general y un comportamiento de desbordamiento dinámico (`overflow-visible` al colapsar y `overflow-y-auto` al expandir) en el menú de navegación para eliminar definitivamente scrollbars horizontales espurios en el navegador y el sidebar. Adicionalmente, se añadió la clase `truncate` al botón de cerrar sesión para evitar saltos de línea molestos durante la animación de transición.
    - **Limpieza de Interfaz**: Se removió el buscador global de cabecera sin funcionalidad del [Header.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/components/Header.tsx) y se re-alineó el menú de usuario hacia la derecha.
*   [ ] **Cifrado y Purga de Datos Locales (IndexedDB) - Fase 3:**
    - Cifrado transparente en la capa local de Dexie.js derivando claves efímeras en RAM en el inicio de sesión.
    - [x] Implementar purga total de Dexie.js en el evento de cierre de sesión (logout) y limpieza de `localStorage`/`sessionStorage`.
*   [ ] **Cifrado en MongoDB (Capa de Base Intermedia) - Fase 4:**
    - Implementar Field-Level Encryption (CSFLE) o cifrado simétrico en el servidor de campos confidenciales de contactos.
*   [ ] **Sincronización en Producción via Webhooks (Fase 4):**
    - Configurar suscripción de Webhook en el portal de desarrolladores de HubSpot para cambios en el estado de facturas (`invoices` o Custom Object de facturas) y procesar los eventos entrantes en el endpoint del webhook para actualizar en tiempo real el estado en MongoDB Atlas al pasar a producción.

---
*Última actualización: 2026-06-02*

## Fases del 2 de junio de 2026 (Sincronización Bidireccional Desacoplada y Navegación Reactiva)
*   **Nueva Arquitectura Desacoplada (Notes & Tasks)**:
    - **Alineación con el Modelo de HubSpot**: Se refactorizaron los adaptadores en [hubspot.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/hubspot.ts) y la creación local en [contacts/page.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/(dashboard)/contacts/page.tsx) para desacoplar por completo las notas y recordatorios. Ahora se registran como dos entidades independientes (`NOTE` y `TASK`) asociadas únicamente al contacto.
    - **Sincronización Nativa**: Las notas se guardan en `/notes` y las tareas en `/tasks` de HubSpot de manera independiente, eliminando asociaciones v4 inválidas (error 400) y parsing de texto.
    - **Gestión del Ciclo de Vida y Borrado Determinista**: Se adaptó el método `deleteActivity` de `ICRMProvider` a `deleteActivity(crmId, type)` en [mock.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/mock.ts), [hubspot.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/hubspot.ts) y [sync-engine.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/sync-engine.ts). Esto asegura que al presionar "Quitar Alarma" en una tarea, la petición HTTP apunte con precisión al endpoint `/tasks/{crmId}` en lugar del endpoint `/notes/{crmId}` (el cual responde falsamente con `204` sin procesar el borrado de tareas).
*   **Navegación Reactiva de Alertas en Header**:
    - **Optimización de Lectura**: Modificada la acción de marcar como leído en [Header.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/components/Header.tsx) para evitar mutaciones y sincronizaciones inútiles con HubSpot si la notificación ya estaba leída.
    - **Comunicación por Eventos**: Se implementó una comunicación reactiva mediante el evento DOM `open-lead-reminder`. Al hacer click en una notificación del Header, el Dashboard abre el Drawer y posiciona el timeline en la actividad correspondiente, incluso si el usuario ya se encuentra visualizando la página de contactos.
*   **Resolución de Condición de Carrera**:
    - **Ventana de Propagación de 20 segundos**: Mantenimiento de la ventana de protección de 20 segundos en [sync.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/actions/sync.ts) para evitar sobreescrituras por indexación lenta de HubSpot. Durante los primeros 20 segundos posteriores a un cambio local en MongoDB, las descargas entrantes (`syncActivitiesForLead` y `syncDealsForLead`) no sobrescribirán el estado local, previniendo rebotes visuales (estados que se desmarcan y se vuelven a marcar tras unos segundos).
