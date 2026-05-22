# Prompt para Inicializar Panel PWA con CRM HubSpot (Arquitectura Desacoplada con DB Intermedia)

Este prompt está diseñado para ser copiado y pegado en una nueva conversación de IA para arrancar el desarrollo del panel del CRM HubSpot utilizando la arquitectura Offline-First y de base de datos intermedia detallada en `ARCH_BLUEPRINT.md`.

---

Actúa como un desarrollador experto en Next.js 14 y PWAs Offline-First de alto rendimiento. Necesito inicializar un nuevo proyecto PWA que servirá como un panel de usuario (Dashboard) para gestionar Leads (Contactos y Empresas) de un CRM (HubSpot) utilizando su API oficial mediante Tokens de Acceso Privado.

El proyecto debe seguir de forma estricta la arquitectura y configuraciones detalladas en el archivo de referencia `ARCH_BLUEPRINT.md`.

### 1. Requerimientos Funcionales (CRM HubSpot)
- **Gestión de Leads**: Listar, crear, editar y borrar (soft delete local) leads/contactos.
- **Asociación de Empresas**: Cada lead/contacto puede ser asociado a una empresa (Company).
- **Dashboard Principal**: Un panel con estadísticas rápidas (total de leads en local, sincronizados con la DB intermedia, pendientes locales del cliente y errores de sincronización del CRM).

### 2. Lineamientos Arquitectónicos Clave (Basados en ARCH_BLUEPRINT.md)
1. **Fuente Única de Verdad en Cliente (SSOT)**: La interfaz de usuario NUNCA interactúa directamente con la API externa ni con la DB del servidor en tiempo real. Siempre lee y escribe en la base de datos local **Dexie.js** (IndexedDB).
2. **Sincronización PWA (Cliente <-> DB Intermedia)**: El hook `useSync` en el cliente sincroniza Dexie con una base de datos intermedia (MongoDB) a través de Server Actions de Next.js, aislándolo de los tiempos de espera y límites del CRM.
3. **Desacoplamiento del CRM (Clean Architecture)**: La integración con HubSpot se realiza a través de la interfaz común `ICRMProvider`. Ninguna acción o componente del servidor interactúa con HubSpot directamente; en su lugar, se comunican con la interfaz resuelta dinámicamente por un `CRMProviderFactory` basado en variables de entorno.
4. **Sincronización Asíncrona con el CRM (Outbound Sync)**: 
   - Un motor en segundo plano (`sync-engine.ts`) procesa secuencialmente los cambios de la base de datos intermedia (MongoDB) hacia el CRM.
   - **Clasificación de Errores de API**: Errores transitorios (red caída, Rate Limit 429) detienen la cola para reintentar después; errores lógicos permanentes (ej. 400 Bad Request por correo duplicado en el CRM) sacan el registro de la cola activa marcando `crmSynced: true` pero registran el error en `crmSyncError` para mostrar alertas en la UI del cliente.
5. **Sincronización Inbound (Webhooks)**: Implementación de un endpoint `/api/webhooks/crm` en Next.js para recibir actualizaciones en tiempo real desde el CRM y propagarlas a MongoDB, actualizándolas posteriormente en el cliente.
6. **Configuración de PWA y Service Worker**: Configurar la aplicación con `next-pwa` con persistencia de sesión offline y fallback offline para la página `/~offline`.

### 3. Entregables Esperados para el Setup Inicial
Proporciona la estructura del proyecto y el código limpio y tipado de los siguientes archivos clave:
1. **Comandos de Consola e Inicialización**: Explicación paso a paso de las dependencias (`npm install`) y devDependencies necesarias para este stack, junto con la estructura de variables de entorno para `.env.local`.
2. **Archivos de Definiciones de TypeScript (`/types`)**:
   - `types/next-auth.d.ts` (para extender la sesión con `userId`).
   - `types/next-pwa.d.ts` (para resolver problemas de tipado de importaciones en ESM).
3. **Esquema de Base de Datos Local (`src/lib/db.ts`)**: Tablas de Dexie para `leads`, `companies` y `users` con los campos necesarios de sincronización (`tempId`, `synced`, etc.).
4. **Modelo de MongoDB (`src/models/Lead.ts`)**: Esquema de Mongoose que almacene el estado local del servidor y los metadatos de sincronización hacia el CRM (`crmId`, `crmSynced`, `crmSyncError`, `crmLastSyncAt`).
5. **Contrato de Abstracción del CRM (`src/lib/crm/interface.ts`)**: Interfaz `ICRMProvider` con las firmas para CRUD y comprobación de salud.
6. **Adaptador de HubSpot (`src/lib/crm/hubspot.ts`)**: Implementación concreta de la interfaz `ICRMProvider` utilizando llamadas HTTPS autorizadas al endpoint de HubSpot.
7. **Factoría de Proveedores (`src/lib/crm/factory.ts`)**: `CRMProviderFactory` para resolver el adaptador activo a partir de `process.env.CRM_PROVIDER`.
8. **Motor de Sincronización Servidor-CRM (`src/lib/crm/sync-engine.ts`)**: La lógica secuencial para barrer MongoDB y actualizar el CRM respetando rate limits y clasificando errores de API.
9. **Webhook Receptor (`src/app/api/webhooks/crm/route.ts`)**: Ruta de Next.js que reciba notificaciones del CRM y actualice MongoDB.
10. **Orquestador PWA del Cliente (`src/hooks/useSync.ts`)**: Hook de sincronización cliente-servidor con polling de salud inteligente.
11. **Configuraciones de Calidad y CI/CD**: Archivo de formateo `.prettierrc` y la especificación del pipeline de integración continua `.github/workflows/ci.yml` configurando Node 18, servicios de MongoDB y tests automáticos.

Por favor, comienza detallando la estructura de carpetas y los archivos base para revisión paso a paso, explicando cada decisión de diseño técnico.

