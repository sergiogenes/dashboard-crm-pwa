<!-- BEGIN:nextjs-agent-rules -->
# rules for next.js development
This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Proyecto: Dashboard PWA con Sincronización de CRM

Este proyecto es una aplicación web progresiva (PWA) diseñada para gestionar leads (contactos y empresas) conectada de forma asíncrona a un CRM externo (ej. HubSpot, Salesforce).

## Arquitectura de Referencia
*   **Blueprint Técnico:** El proyecto sigue de forma obligatoria el diseño arquitectónico detallado en el archivo `ARCH_BLUEPRINT.md` (Base de Datos Local Dexie + Base de Datos Intermedia MongoDB + Abstracción de CRM `ICRMProvider`).
*   **Setup Inicial:** La instalación de dependencias, variables de entorno (.env.local) y los archivos de declaraciones de tipos (`/types`) deben implementarse siguiendo exactamente la **Sección 2** de `ARCH_BLUEPRINT.md`.
*   **Fuente Única de Verdad (SSOT):** La UI lee/escribe únicamente de Dexie.js en IndexedDB.
*   **Desacoplamiento del CRM:** Toda interacción con el CRM debe realizarse a través de la interfaz `ICRMProvider` obtenida mediante `CRMProviderFactory`. Las Server Actions nunca interactúan directamente con el SDK o API de un CRM específico.

## Stack Tecnológico
- **Framework:** Next.js 14 (App Router).
- **Estilos:** Tailwind CSS.
- **Base de Datos Intermedia:** MongoDB (Mongoose).
- **Autenticación:** NextAuth.js (Auth.js) y cifrado de contraseñas locales con `bcryptjs`.
- **Caché del Cliente:** TanStack Query (React Query) configurado para PWA (`retry: 0`, `refetchOnWindowFocus: false`, `staleTime: Infinity`).
- **Persistencia Local (PWA):** Dexie.js.
- **Service Worker:** Integrado vía `next-pwa` para almacenamiento en caché estático, sesión offline y fallback offline.

## Reglas y Convenciones de Desarrollo
- **Enfoque Tutorial:** Cada cambio o línea de código modificada debe acompañarse de una explicación detallada del "por qué" y cómo funciona para facilitar el aprendizaje.
- **Ejecución Manual de Comandos:** Todos los comandos de consola deben ser proporcionados al usuario para que los ejecute manualmente. El agente de IA NO debe usar herramientas de ejecución de shell.
- **Tipado Estricto (TypeScript):** Queda estrictamente prohibido el uso de `any`. Se deben definir interfaces detalladas para todos los modelos de datos y respuestas del CRM.
- **Validación con Linter:** El código debe estar libre de advertencias y errores de ESLint (variables sin usar, importaciones redundantes, etc.) antes de considerarse completo.
- **Formateado de Código (Prettier):** Todo código generado debe alinearse a las reglas definidas en `.prettierrc` (y formatear usando `prettier --write`).
- **Integración Continua (CI/CD):** Asegurar que ningún cambio rompa el pipeline definido en `.github/workflows/ci.yml` (compilación, lint y tests automáticos).
- **Validación con Tests (Playwright):** Todo cambio significativo en sincronización, offline o autenticación requiere un test automatizado en `tests/` que simule estados online/offline.
- **Registro de Progreso:** Cada avance significativo se debe documentar puntualmente en el archivo `progress.md`.
- **Configuración de PWA y Service Worker:**
  - **Registro Manual:** Dado que `next-pwa` no inyecta el script de registro en Next.js 14 App Router, es obligatorio renderizar el componente `ServiceWorkerRegistration.tsx` en el root layout.
  - **Exclusión de Manifiestos:** Configurar `buildExcludes` en `next.config.mjs` para evitar el precachado de manifiestos internos que devuelven `404` en producción (como `app-build-manifest.json` y `middleware-manifest.json`).
  - **Recuperación Resiliente de Red:** El hook `useSync.ts` debe monitorear el estado mediante un `syncStatusRef` para reintentar la sincronización contra `/api/health` si se encuentra en estado de error, logrando la reconexión automática sin requerir F5 del usuario.
  - **Manejo de Errores de Autenticación:** Para prevenir que NextAuth redirija a pantallas de error genéricas (`/api/auth/error`) al estar sin conexión, la pantalla de login debe pre-validar que el navegador esté online y el servidor responda (health check ligero). Todo error capturado por NextAuth debe redirigirse a `/auth/signin` configurando el campo `error` en `authOptions.pages`, y la pantalla de signin debe mostrar un mensaje amigable leyendo los parámetros de la URL.


## Estructura de Carpetas
- `/app`: Rutas de App Router (rutas de autenticación, vistas, y webhook `/api/webhooks/crm`).
- `/components`: Componentes atómicos e interactivos (Client Components).
- `/types`: Archivos de declaraciones globales (`next-auth.d.ts` y `next-pwa.d.ts`).
- `/lib/db.ts`: Configuración del cliente local Dexie.
- `/lib/crm`: Interfaz (`interface.ts`), Factoría (`factory.ts`), y adaptadores específicos de CRM (ej. `hubspot.ts`).
- `/models`: Esquemas de Mongoose para la base de datos intermedia (con campos de control de sincronización).
- `/hooks`: Hooks personalizados (como `useSync` para sincronización cliente-servidor).
- `/public`: Manifiesto PWA, iconos y Service Worker.
- `/tests`: Suites de tests E2E con Playwright (incluyendo tests de carga y persistencia).
