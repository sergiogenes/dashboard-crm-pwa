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
*   [x] **Rediseño del Layout (Sidebar Lateral y Páginas Independientes) - Fase 8:**
    - Creados los componentes estructurales [Sidebar.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/components/Sidebar.tsx) (sticky y colapsable) y [Header.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/components/Header.tsx) (buscador y avatar de usuario, con `SyncStatusBadge` integrado).
    - Configurado el Layout Maestro [src/app/(dashboard)/layout.tsx](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/(dashboard)/layout.tsx) para el route group `(dashboard)`.
    - Creadas las páginas independientes para [Contacts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/(dashboard)/contacts/page.tsx), [Companies](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/(dashboard)/companies/page.tsx), [Dashboard Home](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/(dashboard)/page.tsx) y [Settings](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/app/(dashboard)/settings/page.tsx) dentro del route group.
    - Se dejó lista la indicación para eliminar el archivo raíz obsoleto `src/app/page.tsx`.
*   [ ] **Cifrado y Purga de Datos Locales (IndexedDB) - Fase 3:**
    - Cifrado transparente en la capa local de Dexie.js derivando claves efímeras en RAM en el inicio de sesión.
    - Implementar purga total de Dexie.js en el evento de cierre de sesión (logout).
*   [ ] **Cifrado en MongoDB (Capa de Base Intermedia) - Fase 4:**
    - Implementar Field-Level Encryption (CSFLE) o cifrado simétrico en el servidor de campos confidenciales de contactos.

---
*Última actualización: 2026-05-29*

