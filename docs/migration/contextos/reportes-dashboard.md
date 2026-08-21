# Reportes y Performance — mapea a servicio Reportes (arquitectura nueva)

## Casos de uso y requerimientos que cubre

- **CU-05 — Tablero de performance personal (Vendedor):** "Indicadores en tiempo real: solicitudes ingresadas, conversión, estados y montos en guaraníes."
- **CU-10 — Vista gerencial agregada (Gerencia):** consumo en HubSpot de contactos, solicitudes e indicadores agregados por sucursal. En el portal actual no existe un rol "Gerencia" ni una vista agregada por sucursal — lo más cercano es el panel de `supervisor` (ver más abajo), que es un agregado por equipo de vendedores, no por sucursal, y vive dentro del propio portal (no en HubSpot). El detalle de qué y cómo se sincroniza hacia HubSpot para que Gerencia lo consuma allí lo cubre el documento de sincronización CRM, no este.
- **RF-16:** Tablero personal con cantidades y montos, expresados en guaraníes, visibles en la primera pantalla.
- **RNF-07:** Antigüedad del modelo de lectura de reportes por debajo de 60 segundos en régimen.

## Qué hace hoy (comportamiento actual)

El portal no tiene un módulo de "Reportes" separado ni un backend de agregación: cada pantalla que muestra indicadores los calcula **en el cliente**, en JavaScript, iterando arrays leídos de Dexie (IndexedDB) o, en el caso del supervisor, consultando Mongo directamente en cada carga. No hay una tabla/colección de métricas precalculadas ni un job de agregación en el servidor.

Existen tres focos de cálculo de indicadores, cada uno independiente y con su propia lógica duplicada:

1. **Dashboard personal del vendedor** (`src/hooks/useDashboard.ts` + `src/app/(dashboard)/page.tsx`, ruta `/`, rol `user`).
   - Lee reactivamente (`useLiveQuery` de Dexie) `leads`, `companies`, `deals` y `activities` del usuario logueado directamente desde IndexedDB local.
   - Los leads y activities vienen cifrados en Dexie (AES-256-GCM) y se descifran en el cliente con `decryptLead`/`decryptActivity` antes de calcular nada.
   - Clasifica cada lead en una única categoría (Nuevo / En Proceso / Aprobado / Rechazado) cruzando sus deals asociados (por `stage`) y sus actividades (contactado o no), con prioridad determinística: aprobado > en proceso/contactado > rechazado > nuevo.
   - Calcula porcentajes de cada etapa sobre el total de leads y una tasa de conversión (aprobados / total leads).
   - Calcula un `syncRate` (porcentaje de leads+empresas ya sincronizados con el servidor) y una lista de "últimos cambios locales" (5 leads/empresas más recientes por `updatedAt`).
   - No muestra ningún monto en guaraníes. Todo el tablero personal está expresado en cantidades de leads (conteos y porcentajes), no en montos de solicitudes/deals.
2. **Panel de solicitudes (Deals)** (`src/hooks/useDeals.ts` + `src/app/(dashboard)/deals/page.tsx`, ruta `/deals`).
   - También lee reactivamente desde Dexie (`deals` y `leads`, con el mismo patrón de descifrado en caliente).
   - Aquí sí se calculan y muestran montos: `totalApplied` (suma de `amount` de todos los deals), `totalActiveAmount` (deals en `draft`/`under_evaluation`/`approved`), `totalDisbursedAmount` (`disbursed`/`completed`) y `overdueCount` (deals en mora).
   - Los montos se formatean en guaraníes con `formatGsCompact` (`src/lib/format.ts`) — ejemplo "Gs. 5,50M" — y el detalle de cada deal (tabla/tarjetas) usa `formatGs` (monto completo, sin compactar).
   - Esta es la pantalla que efectivamente cumple con "montos en guaraníes", pero es una pantalla separada (`/deals`), no la primera pantalla del dashboard (`/`) que pide RF-16.
3. **Panel del supervisor** (`src/app/actions/supervisor.ts` función `getSupervisorDashboardData` + `src/components/SupervisorDashboard.tsx`, se renderiza en la misma ruta `/` cuando `session.user.roles` incluye `supervisor`).
   - A diferencia de los dos anteriores, esto es una Server Action que consulta MongoDB directamente en cada invocación (no pasa por Dexie): trae los vendedores a cargo (`User.find` por `supervisorId` y rol `user`), los deals de todo el equipo (`Deal.find` por `userId` en la lista de vendedores, no eliminados) y los prospectos sin asignar del propio supervisor.
   - Calcula en memoria (loop sobre los deals traídos): `totalDisbursed` (suma de `amount` en `disbursed`/`completed`), `totalOperations` (cantidad total de deals del equipo) y `pendingApprovalCount` (`under_evaluation`/`approved`), y repite el mismo cálculo por vendedor individual (`salespeoplePerformance`).
   - El componente hace polling cada 15 segundos (`setInterval` de 15000ms en el cliente) llamando de nuevo a la Server Action — es decir, "tiempo real" aquí es literalmente "refetch completo de Mongo cada 15s", sin caché ni modelo de lectura intermedio.
   - El objetivo de desembolso (`disbursementGoal`) es un campo simple en el propio documento `User` del supervisor (no una entidad de reportes).

## KPIs e indicadores calculados

| Indicador | Dónde | Fórmula / fuente | Moneda/formato |
|---|---|---|---|
| Total de leads | Dashboard personal | Cantidad de leads en Dexie filtrados por `userId` y no eliminados | Cantidad |
| Leads nuevos / en proceso / aprobados / rechazados | Dashboard personal | Clasificación cruzando `deals.stage` + `activities` por `leadId` | Cantidad + porcentaje sobre el total |
| Tasa de conversión | Dashboard personal | Aprobados / total de leads, redondeado | Porcentaje |
| Porcentaje de sincronización (`syncRate`) | Dashboard personal | (leads+empresas sincronizados) / (leads+empresas totales) | Porcentaje |
| Últimos cambios locales | Dashboard personal | Top 5 leads/empresas por `updatedAt` descendente | Lista, sin monto |
| Total solicitado | Panel Deals (`/deals`) | Suma de `amount` de todos los deals del usuario (o de todo el equipo si es supervisor) | Guaraníes (`formatGsCompact`) |
| Monto en evaluación | Panel Deals | Suma de `amount` de deals en `draft`/`under_evaluation`/`approved` | Guaraníes |
| Monto desembolsado | Panel Deals | Suma de `amount` de deals en `disbursed`/`completed` | Guaraníes |
| Créditos en mora | Panel Deals | Cantidad de deals en etapa `overdue` | Cantidad |
| Total desembolsado del equipo | Panel Supervisor | Suma de `amount` de deals del equipo en `disbursed`/`completed` | Guaraníes |
| Progreso de meta de desembolso | Panel Supervisor | Total desembolsado / meta, tope 100 por ciento | Porcentaje |
| Operaciones totales / pendientes de aprobación (equipo) | Panel Supervisor | Cantidad de deals del equipo / cantidad en `under_evaluation` más `approved` | Cantidad |
| Rendimiento por vendedor (desembolsado, deals totales, deals pendientes) | Panel Supervisor | Mismo cálculo que el total, agrupado por `userId` de cada deal | Guaraníes + cantidad |

Todo monto se expresa siempre en guaraníes (PYG); no hay soporte multi-moneda. `formatGs`/`formatGsCompact` (`src/lib/format.ts`) son las únicas dos funciones de formateo monetario del proyecto y ambas asumen PYG (sin decimales, separador de miles es-PY, prefijo "Gs.").

## Datos que toca

- **Dexie/IndexedDB (cliente):** tablas `leads`, `companies`, `deals`, `activities` — todos con campos PII cifrados (AES-256-GCM), descifrados en memoria del navegador solo para el cálculo de KPIs del dashboard personal y del panel de deals.
- **MongoDB (servidor), vía Mongoose:** colecciones `User` (para `disbursementGoal`, `supervisorId`, `roles`), `Lead` y `Deal` — consultadas directamente por la Server Action del supervisor, sin ninguna colección/vista intermedia de métricas.
- No existe hoy ninguna tabla, vista materializada, cache de agregados, ni cola de eventos dedicada a reportes. Todo cálculo es "on the fly" en el momento en que se renderiza la pantalla (cliente) o se invoca la Server Action (servidor).

## Edge cases y comportamientos conocidos

- **Caché local limitada a 100 leads:** `useSync.ts` purga la caché de Dexie a un máximo de 100 leads (ventana deslizante, eliminando primero los más antiguos y ya sincronizados, con un piso de 7 días) en cada ciclo de sincronización (cada 15s). Esto significa que el dashboard personal de un vendedor con más de 100 leads históricos no ve el total real — solo calcula sobre el subconjunto que quedó en caché local. Es una limitación de correctitud del KPI, no solo de latencia.
- **Clasificación de leads es una heurística cliente, no un estado persistido:** la categoría del embudo de cada lead se recalcula en cada render cruzando `deals` y `activities`; no existe un campo de estado de reporte persistido en el modelo Lead. Un lead con una actividad pero sin deal aprobado ni rechazado queda "En Proceso" aunque nunca haya tenido una solicitud real — el criterio de "contactado" (cualquier actividad con ese leadId) es muy laxo.
- **El dashboard personal (RF-16, primera pantalla) no muestra montos en guaraníes** — solo cantidades y porcentajes de leads. El requisito de mostrar montos ya existe implementado, pero en otra pantalla (`/deals`), no en la superior/home. Es una brecha directa contra RF-16 tal como está redactado ("visibles en la primera pantalla").
- **"Tiempo real" hoy es polling, no push:** tanto el dashboard personal (a través de `useSync` cada 15s más `useLiveQuery` reactivo sobre Dexie) como el panel de supervisor (polling explícito de 15s contra la Server Action) dependen de intervalos fijos, no de eventos. En el peor caso la desviación puede acercarse a los 15s más la latencia de red/consulta — hoy cumpliría holgadamente el RNF-07 de 60s, pero por diseño de polling, no por un modelo de lectura dedicado.
- **Doble fuente de verdad para el "estado" de un lead:** el pipeline visual del dashboard personal deriva el estado del lead a partir de `Deal.stage`, mientras que el panel de supervisor mide todo a nivel de Deal directamente (sin pasar por Lead). No hay un único lugar que defina en qué etapa está un prospecto; cada pantalla lo infiere a su manera.
- **Cálculo de rendimiento por vendedor recorre todos los deals del equipo en memoria** en cada invocación de `getSupervisorDashboardData` (filtro por vendedor sobre el arreglo completo de deals del equipo) — sin paginación ni límite; funciona hoy porque el volumen es bajo, pero es un patrón que no escala como reporte de verdad.
- **Sin desglose por sucursal:** el modelo User no tiene campo de sucursal/franquicia hoy (está planificado como parte del futuro modelo de Franquicias/Royalties, ver memoria del proyecto project_franchise_pending), por lo que la vista agregada por sucursal de CU-10 no tiene con qué agregarse todavía en el dato actual.

## Disposición en la migración (cambio de arquitectura de datos: de consulta directa a modelo de lectura por eventos)

Hoy los tres focos de reporte descritos arriba no son un servicio: son cálculos ad-hoc embebidos en hooks de React (leyendo Dexie del propio dispositivo) y en una Server Action que golpea MongoDB en vivo. En la arquitectura nueva esto se reemplaza por un microservicio Reportes con las siguientes reglas:

- El servicio Reportes no debe consultar las bases de datos de Contactos, Solicitudes/Deals o Usuarios directamente (ni vía join, ni vía llamada síncrona a esos servicios en el camino caliente de lectura). Su única fuente de entrada son eventos de dominio publicados por esos servicios en el bus de eventos (por ejemplo SolicitudCreada, SolicitudCambioEstado, SolicitudDesembolsada, ContactoCreado, ContactoConvertido, etc.).
- Reportes mantiene su propio modelo de lectura (tablas/proyecciones desnormalizadas en su propia base, estilo CQRS) precalculado a partir de esos eventos: contadores por etapa, montos acumulados en guaraníes, conversión, ranking por vendedor/sucursal. Esto es exactamente lo que hoy hacen `useDashboard.ts`, `useDeals.ts` y `getSupervisorDashboardData` recalculando en caliente — todo ese cálculo se traslada a los event handlers/proyectores del servicio Reportes.
- RNF-07 (antigüedad menor a 60s) se cumple por diseño de la proyección basada en eventos (el modelo de lectura se actualiza al consumir cada evento, no por polling), reemplazando el patrón actual de polling de 15s y de `useLiveQuery` sobre IndexedDB.
- El tablero personal del vendedor (CU-05 / RF-16) pasa a ser una consulta de solo lectura al servicio Reportes (vía el BFF), que ya debe traer cantidades y montos en guaraníes en la misma respuesta — corrigiendo la brecha actual donde el home del vendedor no muestra montos. El formateo en guaraníes ("Gs." más separador de miles es-PY, sin decimales) es una regla de negocio ya validada en el frontend actual (`src/lib/format.ts`) y debe preservarse como estándar de presentación, aunque el cálculo del monto ya no ocurra en el cliente.
- La vista gerencial agregada (CU-10) tiene dos caminos posibles a evaluar con Negofin: (a) que Gerencia siga consumiendo agregados en HubSpot (como ya ocurre hoy y está fuera del alcance de este documento), o (b) que el servicio Reportes exponga también la agregación por sucursal una vez exista el dato de sucursal/franquicia (dependencia directa del futuro modelo de Franquicias). Mientras esa entidad no exista, no hay dato con qué agregar "por sucursal" en Reportes.
- El panel de supervisor deja de ser una Server Action que consulta Usuarios y Deals con loops en memoria; su reemplazo natural es una proyección de "rendimiento de equipo" en Reportes, indexada por supervisor y por vendedor, actualizada por los mismos eventos de Solicitudes.
- La regla de que un lead solo puede estar en una categoría de embudo a la vez (hoy resuelta con prioridad determinística en el cliente) debe convertirse en una máquina de estados explícita y persistida — probablemente en el servicio de Solicitudes/Contactos, que emite el evento de cambio de estado — en lugar de inferirse en Reportes cruzando eventos de actividad y de deal por separado.

## Brechas / preguntas abiertas detectadas

1. RF-16 no se cumple literalmente hoy: el dashboard personal (primera pantalla, rol vendedor) no muestra ningún monto en guaraníes, solo cantidades de leads. Los montos existen pero en la pantalla de Deals (`/deals`). Hay que confirmar con Negofin si en la migración el home del vendedor debe incorporar montos (lectura literal de RF-16) o si "primera pantalla" puede interpretarse como el conjunto home más deals.
2. La caché local de 100 leads en Dexie hace que el dashboard actual subestime totales para vendedores con cartera histórica grande — un defecto de datos, no solo de UX, que conviene tener presente al migrar los números de referencia/baseline usados para validar el nuevo servicio de Reportes.
3. No existe hoy un campo de estado persistido del lead/solicitud: el embudo se infiere cruzando el stage del deal y la presencia de actividades, con reglas de prioridad ad-hoc y un criterio de "contactado" muy laxo (cualquier actividad, sin importar el tipo). Antes de definir los eventos de dominio que alimentarán Reportes, hay que decidir dónde vive la máquina de estados canónica del embudo.
4. CU-10 (vista por sucursal) no tiene hoy el dato de sucursal en ningún modelo — depende del futuro modelo de Franquicias/Royalties (campo franchiseId en User/Lead/Deal, ver memoria project_franchise_pending). Sin esa entidad, el servicio Reportes no puede agregar por sucursal aunque tenga los eventos de Solicitudes y Contactos.
5. El panel de "supervisor" actual no es exactamente CU-10 (Gerencia): es un agregado por equipo de vendedores (cartera de un supervisor), servido desde el propio portal vía MongoDB directo, no la vista de Gerencia vía HubSpot que describe CU-10. Conviene aclarar con Negofin si el panel de supervisor migra también al servicio Reportes (como un reporte más, distinto del gerencial) o si su función pasa a cubrirse de otra forma en la nueva arquitectura.
6. Duplicación de lógica de cálculo de montos entre `useDeals.ts` (vendedor) y `supervisor.ts` (equipo) — ambos suman `amount` por stage con las mismas categorías pero código independiente; es la señal más clara de que ambos deberían consolidarse en una única proyección de Reportes en la nueva arquitectura, en vez de mantenerse como dos cálculos paralelos.
