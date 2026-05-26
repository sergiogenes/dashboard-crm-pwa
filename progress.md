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
*   **Tareas Pendientes (Próximos Pasos):**
    1. Subir los cambios actuales al repositorio de GitHub y verificar el despliegue final en Vercel.
    2. Configurar los Webhooks en HubSpot apuntando al dominio de producción.

---
*Última actualización: 2026-05-26*

