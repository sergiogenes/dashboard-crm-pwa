# Blueprint Arquitectónico: PWA Offline-First de Alto Rendimiento con Base de Datos Intermedia y Abstracción de CRM

Este documento detalla la arquitectura de referencia para construir aplicaciones web progresivas (PWA) de nivel empresarial. La arquitectura combina el enfoque **Offline-First en el cliente** con un patrón de **Base de Datos Intermedia en el servidor** y un **diseño desacoplado (Clean Architecture)** para la comunicación con CRMs o APIs externas (ej. HubSpot, Salesforce).

---

## 1. Stack Tecnológico y Arquitectura de Dos Capas

La arquitectura se divide en dos capas de sincronización independientes para aislar al cliente de la latencia, caídas y límites de cuota (Rate Limits) del CRM externo:

```
[ Capa de Cliente: Latencia Cero ]
  PWA UI (React) <──> Dexie.js (SSOT Local en IndexedDB)
                           │
                           ▼ (useSync / Server Actions)
[ Capa de Servidor: Resiliencia y Control ]
  Base de Datos Intermedia (MongoDB)
                           │
         ┌─────────────────┴─────────────────┐
         ▼ (Outbound: Cron/Queue)            ▲ (Inbound: Webhooks)
   [ ICRMProvider ]                    [ Webhook Receiver ]
         │                                   │
         ▼                                   │
[ CRM (HubSpot/Salesforce) ] ────────────────┘
```

### Componentes Core:
*   **Base de Datos Local (SSOT):** Dexie.js (IndexedDB) en el navegador. La UI solo lee y escribe aquí.
*   **Base de Datos Intermedia (Servidor):** MongoDB. Actúa como buffer, almacena la sesión y la caché de datos unificada, y guarda metadatos de sincronización con el CRM.
*   **Capa de Abstracción del CRM (Clean Architecture):** Interfaces y adaptadores que aíslan el negocio de las peculiaridades de cada CRM.
*   **Motor de Sincronización Asíncrona:** Demonios, colas de tareas (ej. BullMQ) o Serverless Crons en el servidor que procesan la cola de MongoDB hacia el CRM.
*   **TanStack Query:** Carga inicial (SSR/hidratación) y gestión de caché de lectura en el cliente.
*   **NextAuth.js & bcryptjs:** Autenticación persistente offline y seguridad criptográfica.

---

## 2. Requerimientos de Setup y Configuración Inicial

Para poner en marcha esta arquitectura en un nuevo proyecto, se deben configurar los siguientes elementos base:

### 2.1 Instalación de Dependencias
Ejecuta manualmente los siguientes comandos en la consola de tu proyecto Next.js 14:

```bash
# Dependencias principales de producción
npm install @tanstack/react-query dexie dexie-react-hooks lucide-react mongoose next-auth next-pwa bcryptjs

# Dependencias de desarrollo y tipados
npm install -D @types/bcryptjs dotenv @playwright/test
```

### 2.2 Variables de Entorno (`.env.local`)
Crea un archivo `.env.local` en la raíz del proyecto para definir la conexión con la base de datos, el proveedor de autenticación y los credenciales del CRM:

```ini
# Base de Datos Intermedia (MongoDB)
MONGODB_URI="mongodb+srv://<usuario>:<password>@cluster.mongodb.net/nextpwa?retryWrites=true&w=majority"

# Configuración de Sesiones de Autenticación (NextAuth)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generar_un_secreto_criptografico_seguro"

# Configuración de CRM Desacoplado
CRM_PROVIDER="hubspot" # Valores soportados: hubspot, salesforce, etc.
HUBSPOT_ACCESS_TOKEN="pat-eu1-xxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 2.3 Archivos de Declaración de Tipos de TypeScript (`/types`)
Crea una carpeta llamada `types/` en la raíz del proyecto y añade los siguientes archivos para extender las definiciones y evitar errores de compilación:

#### Archivo `types/next-auth.d.ts`
```typescript
import NextAuth, { DefaultSession } from "next-auth"

declare module "next-auth" {
  /** Extendemos el tipo de sesión para incluir el id del usuario */
  interface Session {
    user: {
      id: string
    } & DefaultSession["user"]
  }

  interface User {
    id: string
  }
}

declare module "next-auth/jwt" {
  /** Extendemos el JWT para incluir el id del usuario */
  interface JWT {
    id: string
  }
}
```

#### Archivo `types/next-pwa.d.ts`
```typescript
declare module 'next-pwa' {
    import { NextConfig } from 'next';

    interface PWAConfig {
        dest?: string;
        disable?: boolean;
        register?: boolean;
        scope?: string;
        sw?: string;
        skipWaiting?: boolean;
        buildExcludes?: Array<RegExp | string>;
        [key: string]: unknown;
    }

    function withPWA(config: PWAConfig): (nextConfig: NextConfig) => NextConfig;

    export default withPWA;
}

// Solución para declaraciones de imports CSS locales en Service Worker / componentes
declare module "*.css" {
  const content: { [className: string]: string };
  export default content;
}
```

---

## 3. Capa de Cliente: La Fuente Única de Verdad (SSOT)

La interfaz de usuario del cliente **nunca interactúa directamente con el servidor ni con el CRM externo en caliente**. Toda mutación o consulta se realiza sobre Dexie.js.

### Configuración de Dexie (`src/lib/db.ts`)
```typescript
import Dexie, { Table } from 'dexie';

export interface LocalTask {
  id?: string;         // ID real de MongoDB (UUID)
  tempId?: string;     // ID temporal generado en el cliente
  userId: string;      // Vinculación de sesión
  title: string;
  completed: boolean;
  deleted?: boolean;   // Soft Delete para sincronización con MongoDB
  synced: boolean;     // Estado de sincronización local -> MongoDB
  createdAt: number;
}

export class PWAResilientDatabase extends Dexie {
  tasks!: Table<LocalTask>;

  constructor() {
    super('PWAResilientDB');
    this.version(1).stores({
      tasks: 'id, tempId, userId, synced, deleted'
    });
  }
}

export const localDb = new PWAResilientDatabase();
```

---

## 4. Sincronización Cliente-Servidor (PWA → MongoDB)

El hook `useSync` se encarga de subir los cambios pendientes de Dexie a la base de datos intermedia (MongoDB) a través de Server Actions. El cliente no sabe qué CRM se está utilizando ni interactúa con él.

### Health Check Polling para Lie-Fi y Recuperación de Errores
Para evitar llamadas fallidas recurrentes cuando el servidor está caído pero el navegador reporta estar conectado, se realiza un ping ligero a `/api/health` únicamente si hay tareas locales pendientes o si el estado de sincronización es de error (lo que permite reconexión automática al volver a la vida el servidor):

```typescript
const syncStatusRef = useRef<SyncStatus>('idle');
useEffect(() => {
  syncStatusRef.current = syncStatus;
}, [syncStatus]);

useEffect(() => {
  if (status !== 'authenticated' || !userId) return;

  const checkServerAndSync = async () => {
    if (!navigator.onLine) return;

    const pendingCount = await localDb.tasks
      .filter(t => t.synced === false && t.userId === userId)
      .count();

    if (pendingCount > 0 || syncStatusRef.current === 'error') {
      try {
        const response = await fetch('/api/health');
        if (response.ok) {
          syncTasks();
        }
      } catch {
        // Servidor intermedio caído, reintentar en el próximo intervalo
      }
    }
  };

  const intervalId = setInterval(checkServerAndSync, 15000); // Polling de salud
  window.addEventListener('online', syncTasks);
  syncTasks();

  return () => {
    clearInterval(intervalId);
    window.removeEventListener('online', syncTasks);
  };
}, [status, userId, syncTasks]);
```

---

## 5. UI Reactiva y Estados de Sincronización

La interfaz de usuario mapea de forma reactiva el estado de sincronización local utilizando badges visuales.

### Mapeo Dinámico
```typescript
const isSyncingInQueue = syncingTaskIds.includes(task.id!);
const isCreating = createMutation.isPending && createMutation.variables?.tempId === task.id;
const isUpdating = updateMutation.isPending && updateMutation.variables?.id === task.id;
const isDeleting = deleteMutation.isPending && deleteMutation.variables === task.id;
const isTaskSyncing = isSyncingInQueue || isCreating || isUpdating || isDeleting;
```

### Responsividad de Estados
*   **Desktop/Tablet:** Se despliega el badge con texto completo (`Nube` + "Sincronizado", "Local" o "Sincronizando").
*   **Mobile (`hidden md:inline`):** Se muestra únicamente el icono representativo (`Cloud`, `CloudOff`, o `CloudUpload` animado en pulse/bounce) para evitar colapsar la vista compacta.

---

## 6. Integración con TanStack Query (Modo PWA)

React Query se configura para optimizar la hidratación del lado del servidor (SSR) sin interferir con la lógica Offline-First del cliente.

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 0,                   // Fallar rápido en offline para evitar reintentos infinitos
      refetchOnWindowFocus: false, // Evitar peticiones innecesarias al reenfocar la ventana offline
      refetchOnReconnect: false,   // Controlado manualmente por el orquestador
      staleTime: Infinity,        // Confiar en Dexie; el orquestador invalidará el caché al sincronizar exitosamente
    },
  },
});
```

---

## 7. Autenticación Resiliente y Seguridad

El sistema de sesión de NextAuth debe proteger las páginas en el servidor pero ser permisivo durante micro-cortes de red en la PWA del cliente.

*   **Middleware Tolerante:** Valida la existencia del token JWT en la cookie de sesión. Evita redirecciones forzosas al login si falla la conexión a la base de datos externa:
    ```typescript
    export default withAuth({
      callbacks: { authorized: ({ token }) => !!token },
      pages: { signIn: "/auth/signin" }
    });
    ```
*   **Redirección y Captura de Errores de Auth:**
    Para evitar que fallos de red o base de datos dejen atrapado al usuario en la página de error por defecto (`/api/auth/error`), se configura `error: "/auth/signin"` en `authOptions.pages`. En el lado del cliente, se leen los parámetros `?error=...` de la URL para desplegar mensajes localizados amigables según la naturaleza del error (`Configuration`, `AccessDenied`, `CredentialsSignin`).
*   **Pre-validación de Conexión en Login:**
    Antes de invocar `signIn` de NextAuth, se comprueba `navigator.onLine` y se efectúa una validación de salud rápida a `/api/health` con timeout de 3 segundos. Si el servidor no responde o el navegador está offline, se anula la petición y se muestra el mensaje de error directamente en el formulario, mitigando fallos silenciosos de NextAuth.
*   **SessionProvider Config:**
    ```typescript
    <SessionProvider refetchOnWindowFocus={false} refetchWhenOffline={false}>
      {children}
    </SessionProvider>
    ```
*   **Seguridad con bcryptjs:** Registro y login cifran la contraseña del lado del servidor con hash+salting (10 rondas de salting) previniendo el almacenamiento en texto plano.
*   **Persistencia Offline del JWT:** El Service Worker cachea `/api/auth/session` usando `StaleWhileRevalidate` para permitir recargas y navegaciones offline sin cerrar la sesión.

---

## 8. Desacoplamiento del CRM (Clean Architecture en el Servidor)

Para permitir el cambio de CRM (HubSpot, Salesforce, Zoho, etc.) de forma transparente y sin modificar la lógica de negocio ni el frontend, implementamos un patrón de **Repository / Provider** en el servidor de Next.js.

### 8.1 Capa de Dominio: El Contrato del CRM (`ICRMProvider`)
Definimos la interfaz que todo adaptador de CRM debe implementar de forma obligatoria en `src/lib/crm/interface.ts`:

```typescript
export interface CRMTask {
  crmId?: string;
  title: string;
  completed: boolean;
  userId: string;
}

export interface ICRMProvider {
  /** Comprueba la salud del CRM (API Key válida, servicio online) */
  healthCheck(): Promise<boolean>;
  
  /** Envía una tarea nueva y retorna el ID del CRM asignado */
  createTask(task: CRMTask): Promise<string>;
  
  /** Actualiza una tarea existente en el CRM */
  updateTask(crmId: string, task: Partial<CRMTask>): Promise<void>;
  
  /** Elimina físicamente o archiva la tarea en el CRM */
  deleteTask(crmId: string): Promise<void>;
  
  /** Obtiene las tareas actualizadas desde el CRM (Inbound Poll) */
  fetchTasks(userId: string, since?: Date): Promise<CRMTask[]>;
}
```

### 8.2 Capa de Infraestructura: Adaptador Concreto (Ej: HubSpot)
Implementación específica de la interfaz para HubSpot en `src/lib/crm/hubspot.ts`:

```typescript
import { ICRMProvider, CRMTask } from './interface';

export class HubSpotProvider implements ICRMProvider {
  private accessToken: string;
  private baseUrl = 'https://api.hubapi.com/crm/v3/objects/tasks';

  constructor() {
    this.accessToken = process.env.HUBSPOT_ACCESS_TOKEN || '';
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}?limit=1`, {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async createTask(task: CRMTask): Promise<string> {
    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          hs_task_subject: task.title,
          hs_task_status: task.completed ? 'COMPLETED' : 'NOT_STARTED',
          hs_task_body: `User: ${task.userId}`
        }
      })
    });
    if (!res.ok) throw new Error('Error al crear tarea en HubSpot');
    const data = await res.json();
    return data.id; // Retorna el ID asignado por HubSpot
  }

  async updateTask(crmId: string, task: Partial<CRMTask>): Promise<void> {
    const properties: Record<string, string> = {};
    if (task.title !== undefined) properties.hs_task_subject = task.title;
    if (task.completed !== undefined) {
      properties.hs_task_status = task.completed ? 'COMPLETED' : 'NOT_STARTED';
    }

    const res = await fetch(`${this.baseUrl}/${crmId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ properties })
    });
    if (!res.ok) throw new Error('Error al actualizar tarea en HubSpot');
  }

  async deleteTask(crmId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/${crmId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${this.accessToken}` }
    });
    if (!res.ok) throw new Error('Error al eliminar tarea en HubSpot');
  }

  async fetchTasks(userId: string, since?: Date): Promise<CRMTask[]> {
    // Lógica para descargar cambios desde HubSpot usando filtros de búsqueda
    return [];
  }
}
```

### 8.3 CRM Factory para Inyección Dinámica
El orquestador del servidor determina el proveedor activo leyendo `process.env.CRM_PROVIDER` en `src/lib/crm/factory.ts`:

```typescript
import { ICRMProvider } from './interface';
import { HubSpotProvider } from './hubspot';
// import { SalesforceProvider } from './salesforce';

export class CRMProviderFactory {
  static getProvider(): ICRMProvider {
    const providerType = process.env.CRM_PROVIDER || 'mock';

    switch (providerType.toLowerCase()) {
      case 'hubspot':
        return new HubSpotProvider();
      // case 'salesforce':
      //   return new SalesforceProvider();
      default:
        throw new Error(`Proveedor de CRM no soportado: ${providerType}`);
    }
  }
}
```

---

## 9. Sincronización en el Servidor (MongoDB ↔ CRM)

El flujo de datos entre la Base de Datos Intermedia (MongoDB) y el CRM se realiza de forma **asíncrona** y desacoplada del cliente.

### 9.1 Modelo de Datos en MongoDB (`src/models/Task.ts`)
Añadimos metadatos para el control de la sincronización del servidor hacia el CRM:

```typescript
import mongoose, { Schema, Document } from 'mongoose';

export interface ITaskSchema extends Document {
  title: string;
  completed: boolean;
  userId: string;
  deleted: boolean;
  
  // Metadatos de sincronización con el CRM
  crmId?: string;          // ID único retornado por el CRM
  crmSynced: boolean;      // ¿Los datos en MongoDB están alineados con el CRM?
  crmSyncError?: string;   // Errores persistentes de la API del CRM
  crmLastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITaskSchema>({
  title: { type: String, required: true },
  completed: { type: Boolean, default: false },
  userId: { type: String, required: true },
  deleted: { type: Boolean, default: false },
  crmId: { type: String },
  crmSynced: { type: Boolean, default: false },
  crmSyncError: { type: String },
  crmLastSyncAt: { type: Date }
}, { timestamps: true });

export default mongoose.models.Task || mongoose.model<ITaskSchema>('Task', TaskSchema);
```

### 9.2 Motor de Sincronización Outbound (`src/lib/crm/sync-engine.ts`)
Un proceso en segundo plano (Worker, Cron Job o desencadenado tras Server Actions) sincroniza los cambios pendientes de MongoDB hacia el CRM.

```typescript
import Task from '@/models/Task';
import { CRMProviderFactory } from './factory';

export async function syncMongoDBToCRM() {
  const crm = CRMProviderFactory.getProvider();
  
  // Verificar salud del CRM antes de comenzar para evitar fallos repetidos
  const isCrmOnline = await crm.healthCheck();
  if (!isCrmOnline) return;

  // Obtener tareas que han sido actualizadas localmente en MongoDB y no sincronizadas al CRM
  const pendingTasks = await Task.find({ crmSynced: false });

  for (const task of pendingTasks) {
    try {
      // 1. Caso Borrado (Soft Delete en MongoDB)
      if (task.deleted) {
        if (task.crmId) {
          await crm.deleteTask(task.crmId);
        }
        await Task.deleteOne({ _id: task._id }); // Limpieza definitiva de MongoDB
        continue;
      }

      // 2. Caso Crear
      if (!task.crmId) {
        const crmId = await crm.createTask({
          title: task.title,
          completed: task.completed,
          userId: task.userId
        });
        task.crmId = crmId;
      } 
      // 3. Caso Actualizar
      else {
        await crm.updateTask(task.crmId, {
          title: task.title,
          completed: task.completed
        });
      }

      // Sincronización exitosa
      task.crmSynced = true;
      task.crmSyncError = undefined;
      task.crmLastSyncAt = new Date();
      await task.save();

    } catch (error: any) {
      // Clasificación de errores
      const isTransient = error.status === 429 || error.status >= 500;
      
      if (isTransient) {
        // Error de red o Rate Limit: Abortar la cola para reintentar más tarde
        break;
      } else {
        // Error de lógica (ej. 400 Bad Request por datos inválidos):
        // Se marca como sincronizado para sacarlo de la cola activa, pero se registra el error
        task.crmSynced = true;
        task.crmSyncError = error.message || 'Error de validación en el CRM';
        await task.save();
      }
    }
  }
}
```

### 9.3 Sincronización Inbound mediante Webhooks (`src/app/api/webhooks/crm/route.ts`)
Cuando ocurre un cambio directamente en el panel web del CRM (HubSpot/Salesforce), este envía un webhook al servidor de Next.js para actualizar la base de datos intermedia (MongoDB) y reflejar el cambio en la PWA del cliente:

```typescript
import { NextResponse } from 'next/server';
import Task from '@/models/Task';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // NOTA: Aquí se debe validar la firma/secreto del webhook del CRM por seguridad
    
    const { eventType, objectId, properties } = body;

    if (eventType === 'association.change' || eventType === 'object.creation' || eventType === 'object.propertyChange') {
      const title = properties?.hs_task_subject?.value;
      const status = properties?.hs_task_status?.value;
      const completed = status === 'COMPLETED';

      // Actualizar la tarea en MongoDB basada en el crmId (objectId)
      await Task.findOneAndUpdate(
        { crmId: objectId },
        { 
          title, 
          completed,
          crmSynced: true, // Ya viene sincronizado desde el CRM
          crmLastSyncAt: new Date()
        },
        { upsert: true } // Crea si no existe
      );
    } else if (eventType === 'object.deletion') {
      // Borrar físicamente de MongoDB para que el cliente lo elimine al sincronizar
      await Task.deleteOne({ crmId: objectId });
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

---

## 10. Estrategias del Service Worker (`next.config.mjs`)

El Service Worker actúa como caché inteligente para interceptar peticiones de red y asegurar el funcionamiento sin conexión. En Next.js 14 App Router, se requiere:
1. **Registro Manual:** Dado que `next-pwa` no inyecta automáticamente el script en el App Router, debe usarse un componente de cliente que ejecute `navigator.serviceWorker.register('/sw.js')` montado en el Layout.
2. **Exclusión de Manifiestos:** Configurar `buildExcludes` para evitar el precachado de archivos JSON de desarrollo que devuelven `404` en producción (como `app-build-manifest.json` y `middleware-manifest.json`), lo cual rompería el Service Worker.

```javascript
// Configuración de next-pwa con exclusión y fallback offline
const pwaConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  buildExcludes: [/app-build-manifest\.json$/, /middleware-manifest\.json$/],
  additionalManifestEntries: [
    { url: '/~offline', revision: Date.now().toString() }
  ],
  fallbacks: {
    document: '/~offline', 
  },
  runtimeCaching: [
  {
    // Rutas críticas de autenticación NUNCA se cachean
    urlPattern: /\/api\/auth\/(signin|signout|callback|signup).*/,
    handler: 'NetworkOnly',
    options: { cacheName: 'auth-api-critical' }
  },
  {
    // Persistencia de Sesión Offline
    urlPattern: /\/api\/auth\/session/,
    handler: 'StaleWhileRevalidate',
    options: { 
      cacheName: 'auth-session',
      expiration: { maxEntries: 1, maxAgeSeconds: 7 * 24 * 60 * 60 }
    }
  },
  {
    // Caché de recursos de datos RSC de Next.js
    urlPattern: /\/_next\/data\/.+\/.+\.json$|.*_rsc=.*/i,
    handler: 'StaleWhileRevalidate',
    options: { cacheName: 'next-data' }
  },
  {
    // Páginas Core (Home, Signin, Fallback Offline)
    urlPattern: /\/(auth\/signin|~offline|(\?.*)?$)/,
    handler: 'StaleWhileRevalidate',
    options: { cacheName: 'pages-cache' }
  }
]
```

---

## 11. Cultura de Calidad y Tests E2E de Sincronización

La integración continua y la robustez de la sincronización se validan mediante Playwright simulando cortes e inestabilidad de red.

*   **Prueba de Inserción Masiva (Estrés):** Crea 50 tareas en modo offline en el navegador, activa la red y comprueba que se sincronizan de forma secuencial y sin colisiones en MongoDB.
*   **Prueba de Lie-Fi (Red Inestable):** Inicia la sincronización de 20 tareas, corta la conexión de red a mitad del proceso, restáurala y verifica que no existen registros duplicados o corruptos en MongoDB.
*   **Aislamiento y Limpieza:** Cada test genera un usuario de sesión único (ej. `test-[timestamp]@example.com`) y limpia por completo IndexedDB antes de comenzar para evitar contaminación cruzada.

---

## 12. Herramientas de Desarrollo, Calidad y CI/CD

Para asegurar la uniformidad en el estilo del código y evitar regresiones en producción, se implementan herramientas de formateo automático, hooks locales y un pipeline de integración continua (CI).

### 12.1 Formateador de Código (Prettier)
Para formatear el código y ordenar de manera automática las clases de Tailwind CSS, instala las dependencias e implementa el archivo de configuración `.prettierrc` en la raíz del proyecto:

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

### 12.2 Git Hooks (Husky + lint-staged)
Para garantizar que no se suba código con errores del linter al repositorio, se configuran hooks de Git previos al commit. En tu `package.json`, añade:

```json
"lint-staged": {
  "*.{js,jsx,ts,tsx}": [
    "eslint --fix",
    "prettier --write"
  ]
}
```

Instala y arranca Husky:
```bash
npx husky-init && npm install
```

### 12.3 Pipeline de Integración Continua (GitHub Actions)
Crea el archivo `.github/workflows/ci.yml` para ejecutar pruebas automatizadas en cada Pull Request o subida de código a las ramas principales (`main` o `master`).

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]

jobs:
  build-and-test:
    runs-on: ubuntu-latest

    services:
      # Levanta un MongoDB real en la máquina virtual para las pruebas de integración
      mongodb:
        image: mongo:6.0
        ports:
          - 27017:27017

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run Linter
        run: npm run lint

      - name: Build Next.js Application
        run: npm run build
        env:
          MONGODB_URI: mongodb://localhost:27017/testdb
          NEXTAUTH_SECRET: ${{ secrets.NEXTAUTH_SECRET }}
          NEXTAUTH_URL: http://localhost:3000

      - name: Install Playwright Browsers
        run: npx playwright install --with-deps chromium

      - name: Run Playwright E2E Tests
        run: npx playwright test
        env:
          MONGODB_URI: mongodb://localhost:27017/testdb
          NEXTAUTH_SECRET: ${{ secrets.NEXTAUTH_SECRET }}
          NEXTAUTH_URL: http://localhost:3000
```

### 12.4 Inspección y Hosting
*   **Inspección Local de IndexedDB:** Usa **F12 -> Application -> IndexedDB** en Chrome/Edge para auditar los registros y flags `synced` en Dexie.
*   **Base de Datos Servidor:** Usa **MongoDB Compass** para inspeccionar la base de datos intermedia (MongoDB) y vigilar la consistencia de los metadatos de CRM (`crmId`, `crmSynced`).
*   **Despliegue Serverless (Vercel + Atlas):** No utilices IPs públicas abiertas (`0.0.0.0/0`) en MongoDB Atlas. En su lugar, instala la **integración oficial de MongoDB Atlas en el panel de Vercel**, la cual automatiza de forma segura la autenticación de red y los secretos de entorno.

