# Matriz de trazabilidad — Casos de Uso y Requerimientos Funcionales

Cruza cada CU/RF numerado en `Documentacion/20260812-307HPN-Arquitectura_de_la_solucion_Portal_de_Vendedores_v01.docx` con el estado real encontrado en el código de `dashboard-crm`, a partir del barrido documentado en `docs/migration/contextos/` e `docs/migration/integraciones-externas-actuales.md` / `modelo-datos-actual.md`.

**Este es el checklist de aceptación de la migración**: cada fila marcada ❌ o 🟡 es funcionalidad que hay que construir o completar, no solo trasladar. Úsalo para no dar por hecho que algo "ya está" solo porque existe una pantalla parecida.

Leyenda:
- ✅ **Completo** — existe hoy y cubre el requerimiento tal como está redactado.
- 🟡 **Parcial** — existe algo, pero no cubre el requerimiento completo (falta una parte, o funciona distinto de lo pedido).
- ❌ **No existe** — brecha total, funcionalidad nueva a construir.
- 🚫 **Se descarta / excluye** — existe hoy pero, por decisión ya tomada (ver `01-brechas-y-decisiones.md`), no se traslada o queda fuera de esta versión.
- 🔍 **No confirmado** — ningún agente lo verificó explícitamente en el barrido; revisar antes de asumir estado.

---

## Casos de Uso — Portal de Vendedores

| CU | Descripción | Estado | Notas | Doc de contexto |
|---|---|---|---|---|
| CU-01 | Gestión de pipeline (Vendedor) | 🟡 Parcial | La vista por etapa existe (dashboard + `/deals`), pero no hay máquina de estados de embudo persistida — la categoría (Nuevo/En Proceso/Aprobado/Rechazado) se infiere en cliente cruzando `Deal.stage` con presencia de `Activity`, con un criterio de "contactado" laxo. Hay que definir esto como estado explícito antes de diseñar los eventos de Reportes. | `reportes-dashboard.md`, `workflow-deals.md` |
| CU-02 | Registro y seguimiento de solicitudes (Vendedor) | 🟡 Parcial | Alta y visualización de estado existen; validación de aptitud contra el core no existe (no hay core hoy); no hay comentarios/recordatorios vinculados a una solicitud puntual (`Activity` no referencia `Deal`). | `workflow-deals.md` |
| CU-03 | Contactos y actividades (Vendedor) | 🟡 Parcial | Ver detalle RF-01 a RF-07 abajo — varias reglas puntuales están invertidas o ausentes. | `leads.md` |
| CU-04 | Agenda y recordatorios (Vendedor) | 🟡 Parcial | Separación actividad/recordatorio ya existe (RF-08); atajos frecuentes no (RF-09). | `agenda-recordatorios.md` |
| CU-05 | Tablero de performance personal (Vendedor) | 🟡 Parcial | Existen indicadores, pero los montos en guaraníes no están en la primera pantalla (viven en `/deals`, no en home) — ver RF-16. | `reportes-dashboard.md` |
| CU-06 | Pantalla de inicio con alertas (Vendedor) | 🟡 Parcial (fuerte) | De los 4 tipos de alerta pedidos, solo 1 existe realmente (recordatorios manuales). Leads pendientes, cambios de estado y documentación rechazada son brecha total — ni siquiera existe el campo de dominio necesario para dos de ellos. | `notificaciones-alertas.md` |
| CU-07 | Vista de supervisor (Supervisor) | 🟡 Parcial | Actividad desagregada por vendedor existe (`SupervisorDashboard.tsx`); "recordatorios no gestionados" no es visible al supervisor porque los recordatorios viven solo en Dexie local del dispositivo del vendedor. | `asignacion-supervisor.md`, `notificaciones-alertas.md` |
| CU-08 | Reasignación de cartera (Supervisor) | 🟡 Parcial | Existe `assignLeadToSalesperson` (mueve prospectos uno por uno); no existe transferencia completa de cartera de un vendedor activo a otro (el caso real de licencia/baja), no propaga a `Deal`/`Activity` (quedan con `userId` propio), y no hay trazabilidad de quién reasignó qué y cuándo. | `asignacion-supervisor.md` |
| CU-09 | Administración de usuarios, roles y sucursales (Administrador) | 🟡 Parcial (fuerte) | Roles básicos existen (admin/supervisor/user); "sucursal" no existe en ningún lado del código; el alta hoy es autorregistro público sin aprobación de admin (contradice el caso de uso tal como está descrito); no existe forma de dar de baja/desactivar un usuario; no hay auditoría del ciclo de vida de identidades. | `identidad-admin-auth.md` |
| CU-10 | Vista gerencial agregada (Gerencia) | ❌ Bloqueado | Depende de que exista el concepto de "sucursal", que hoy no existe — no puede resolverse sin antes cerrar el modelo de Franquicias/Sucursales (brecha #7 del registro de decisiones). | `asignacion-supervisor.md`, `identidad-admin-auth.md`, memoria `project_franchise_pending` |

## Requerimientos Funcionales

| RF | Descripción | Estado | Notas |
|---|---|---|---|
| RF-01 | Alta de contacto con validación PY (teléfono obligatorio, correo opcional) | ❌ Invertido | Hoy exige documento y correo obligatorios, teléfono opcional — justo al revés del requisito. Es reconstrucción de regla, no migración. |
| RF-02 | Restricciones de formato (teléfono/documento numéricos, correo con estructura) | 🟡 Parcial | Existen validaciones, pero la de cédula paraguaya no tiene dígito verificador oficial confirmado (hay un comentario propio en el código marcándolo como supuesto sin confirmar con Negofin). |
| RF-03 | Titularidad de contacto configurable por regla | ❌ No existe | Solo hay asignación fija al vendedor que crea el contacto; la parte "configurable por regla" es diseño nuevo. |
| RF-04 | Columnas configurables en vista de contactos | ✅ Completo | Implementado como hook/componente reutilizable (ver commit `bc8da44`), ya aplicado también a Empresas y Negocios. |
| RF-05 | Última fecha de contacto calculada automáticamente | ✅ Completo | Campo "Última vez contactado" ya agregado (commit `52eafb1`). |
| RF-06 | Registro rápido de contacto directo vs. seguimiento, diferenciado | 🔍 No confirmado | Ningún agente lo verificó explícitamente — revisar tipos de actividad en `LeadDrawer.tsx` antes de asumir estado. |
| RF-07 | Nota de voz para descripción de actividad | ❌ No existe | Sin ningún equivalente en el código actual — se construye desde cero. |
| RF-08 | Separación actividad realizada / recordatorio pendiente | ✅ Completo (a nivel UX) | Existe como dos pestañas separadas con ciclo de vida propio (`active`→`waiting`→`completed`); a nivel de modelo sigue siendo la misma entidad `Activity` con `type: 'TASK'` + `reminderDate` — no es una entidad separada, ver `modelo-datos-actual.md`. |
| RF-09 | Recordatorios con atajos frecuentes | ❌ No existe | Formularios con inputs de fecha/hora libres, sin botones tipo "mañana"/"en 3 días". |
| RF-10 | Aviso de cambios sin guardar al abandonar formulario | 🔍 No confirmado | Ningún agente lo verificó explícitamente — revisar antes de asumir estado. |
| RF-11 | Validación de aptitud de solicitud contra el core financiero | ❌ No existe | Hoy solo hay validación de formulario (`amount > 0`); no hay ningún core financiero integrado. |
| RF-12 | Estado de solicitud con nomenclatura real de Negofin | 🟡 Parcial (vía workaround frágil) | Hoy el estado depende de un parseo de comentario HTML escondido en el campo `description` del deal en HubSpot, para recuperar la sub-etapa exacta. Se reemplaza por completo al pasar la autoridad del estado al core (ver decisión #10 del registro de brechas). |
| RF-13 | Documentación rechazada con motivo | ❌ No existe | Sin carga documental, adjuntos ni motivo de rechazo estructurado en ningún modelo; el estado `refused` hoy solo muestra un texto fijo genérico. |
| RF-14 | Consulta de scoring e historial crediticio desde la ficha del contacto | 🟡 Parcial | La consulta/visualización existe; el **cálculo** se descarta de la migración (decisión #5) — hoy `Lead.scoring` es un campo calculado y persistido localmente, usado también para filtrar/ordenar la lista de contactos, así que el nuevo flujo por API tiene que cubrir ese mismo uso, no solo la visualización en el drawer. |
| RF-15 | Asignación automática de leads por sucursal/disponibilidad/puntaje | ❌ No existe en ninguna forma | Toda asignación es manual hoy (dueño = creador del lead, o elección manual uno por uno por el supervisor). No hay modelo de sucursal ni de disponibilidad/carga de vendedor. 100% funcionalidad nueva. |
| RF-16 | Tablero personal con montos en guaraníes en la primera pantalla | ❌ No existe tal como se pide | Los montos existen, pero en `/deals`, no en la pantalla de inicio del vendedor. |
| RF-17 | Alertas de inicio (leads pendientes, cambios de estado, doc. incompleta, vencimientos) | 🟡 Parcial (fuerte, 1 de 4) | Solo "vencimientos" en su forma más estrecha (recordatorios manuales de actividad) tiene implementación real end-to-end. Los otros 3 tipos son brecha total. |
| RF-18 | Vista de supervisor: actividad desagregada + recordatorios no gestionados | 🟡 Parcial | Actividad desagregada existe; recordatorios no gestionados no son visibles al supervisor (viven solo en Dexie local del vendedor, nunca sincronizan a servidor). |
| RF-19 | Reasignación de cartera con trazabilidad | 🟡 Parcial | Mecanismo básico existe; falta trazabilidad/auditoría de la operación y propagación consistente a Deal/Activity. |
| RF-20 | Administración de sucursales y agrupación de usuarios | ❌ No existe | Sin ningún campo de sucursal en ningún modelo. |
| RF-21 | Esquema de roles y permisos con alcance por sucursal | 🟡 Parcial | Roles básicos existen (admin/supervisor/user, con inconsistencia entre campo legado `role` singular y `roles` array); alcance por sucursal no existe (depende de RF-20). Tampoco hay guard de autorización centralizado — cada Server Action valida el rol a mano. |
| RF-22 | Login simplificado con OTP por correo/SMS, sin app autenticadora | 🚫 Se descarta implementación actual / 🟡 a construir | TOTP actual (otplib) documentado como referencia histórica, no se traslada (decisión #3). Nuevo flujo OTP email/SMS a diseñar como adaptador desacoplado; SendGrid para email, SMS pendiente con Negofin. |
| RF-23 | Registro offline de actividad/contacto/recordatorio sin duplicación | ✅ Completo | Ya funciona bien vía `tempId` único-sparse y deduplicación en `pushClientChanges` — mecanismo directamente trasladable al patrón de "3 operaciones offline" de la arquitectura nueva. |
| RF-24 | Sincronización unidireccional hacia el CRM | 🟡 Parcial hoy, corregido por decisión | Hoy es bidireccional en dos puntos: webhook entrante de deals y altas de leads vía búsqueda global/importación por owner. Ambos resueltos aplicando la regla general del documento (sincronización unidireccional desde el propietario) — decisiones #4 y #9, ambas excluidas de esta versión. |
| RF-25 | Agente conversacional sobre canal web | ❌ No existe | Ningún agente conversacional en la app actual — 100% funcionalidad nueva, fuera del alcance de este barrido de código existente. |
| RF-26 | Parametrización de nombres de estados/campos (terminología Negofin) | 🔍 No confirmado (probable brecha) | Ningún agente lo verificó explícitamente; los nombres de estado observados en el código (`disbursed`, `refused`, etc.) parecen hardcodeados en inglés/genérico, no parametrizables — revisar antes de asumir. |

## Notas sobre Requerimientos No Funcionales relevantes

No se hizo un barrido dedicado de RNF (el foco pedido fue funcional), pero surgieron hallazgos directamente relevantes durante el barrido de integraciones y datos:

- **RNF-07** (antigüedad del modelo de lectura de reportes < 60s): hoy los reportes se calculan por consulta directa/cliente, no por un modelo de lectura alimentado por eventos — cambio de arquitectura de datos a diseñar desde cero, no una optimización incremental.
- **RNF-14** (idempotencia en toda escritura y todo consumidor de evento): el mecanismo de `tempId` para altas offline ya cumple este principio hoy para leads/actividades/recordatorios — es una base reutilizable conceptualmente.
- **RNF-17** (cifrado en tránsito/reposo con claves gestionadas): hoy hay dos capas de cifrado con algoritmos distintos (AES-256-CBC servidor / AES-256-GCM cliente) y el dato viaja **descifrado entre ambas capas** — a repensar si se centraliza el cifrado en el nuevo diseño con KMS.
- Reconciliación nocturna (mecanismo implícito en sección 3.6 del documento, ligado a RNF-11): **no existe ningún job de reconciliación hoy** — ni cron, ni comparación de conteos/checksums. Es la brecha más directa detectada contra ese requisito.
- Control de cuota centralizado del CRM (sección 3.6): **no existe** — el único tratamiento es reactivo ante un 429, sin contador distribuido entre réplicas.

## Ítems marcados 🔍 "no confirmado" — seguimiento recomendado

Antes de dar por cerrada esta matriz, conviene una pasada corta y puntual (no un nuevo barrido completo) sobre:
- RF-06 (registro rápido diferenciado de contacto directo vs. seguimiento)
- RF-10 (aviso de cambios sin guardar)
- RF-26 (parametrización de terminología)

Estos tres no fueron verificados explícitamente por ningún agente durante el barrido inicial — no significa que no existan, significa que no hay evidencia de código citada todavía.
