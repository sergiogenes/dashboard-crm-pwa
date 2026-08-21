# Documentación de migración — Portal de Vendedores HPN

Documentación del comportamiento actual de `dashboard-crm`, organizada como insumo para la migración a la nueva arquitectura (BFF + microservicios NestJS/PostgreSQL + bus de eventos), definida en `Documentacion/20260812-307HPN-Arquitectura_de_la_solucion_Portal_de_Vendedores_v01.docx` (v01, 2026-08-12, Lucio Flores).

Generada el 2026-08-21 mediante un barrido dirigido del código actual, cruzado contra la numeración de casos de uso (CU) y requerimientos funcionales (RF) de ese documento.

## Cómo usar esta documentación

1. Empezá por **[`01-brechas-y-decisiones.md`](01-brechas-y-decisiones.md)** — son las decisiones ya tomadas con el usuario sobre los puntos donde la app actual choca con la arquitectura nueva (Empresas, WhatsApp, MFA, sync HubSpot, scoring, offline de deals, Franquicias/Royalties, Salesforce, HubSpot bidireccional en leads). Todas resueltas salvo una: la brecha #7 (Franquicias/Royalties), que el propio documento de arquitectura no cubre y queda como punto abierto para definir con Negofin.
2. Seguí con **[`00-trazabilidad-CU-RF.md`](00-trazabilidad-CU-RF.md)** — la matriz maestra: para cada CU/RF del documento de arquitectura, el estado real encontrado en el código (completo / parcial / no existe / se descarta). Es el checklist de aceptación de la migración.
3. Los documentos de **`contextos/`** son el detalle por futuro microservicio — flujos, reglas de negocio, datos, edge cases y disposición en la migración de cada área:
   - [`leads.md`](contextos/leads.md) — Contactos → servicio Leads
   - [`asignacion-supervisor.md`](contextos/asignacion-supervisor.md) — Reasignación de cartera y vista de supervisor → servicio Asignación
   - [`workflow-deals.md`](contextos/workflow-deals.md) — Solicitudes de préstamo, actividades, documentos → servicio Workflow
   - [`agenda-recordatorios.md`](contextos/agenda-recordatorios.md) — Recordatorios → servicio Agenda
   - [`notificaciones-alertas.md`](contextos/notificaciones-alertas.md) — Alertas de inicio → servicio Notificación
   - [`reportes-dashboard.md`](contextos/reportes-dashboard.md) — Tablero de performance y KPIs → servicio Reportes
   - [`identidad-admin-auth.md`](contextos/identidad-admin-auth.md) — Identidad, autenticación, administración de usuarios y roles (cross-cutting)
4. **[`integraciones-externas-actuales.md`](integraciones-externas-actuales.md)** — contrato real hoy con HubSpot e Infobip (insumo directo para diseñar los adaptadores de la capa anticorrupción de la arquitectura nueva).
5. **[`modelo-datos-actual.md`](modelo-datos-actual.md)** — entidades Mongoose/Dexie, cifrado, campos de control de sync; insumo para diseñar los esquemas PostgreSQL por servicio.

## Qué NO cubre esta documentación

- El agente conversacional (RF-25): no existe hoy en la app, así que no hay comportamiento actual que documentar — es diseño 100% nuevo.
- El detalle de infraestructura AWS/Terraform (secciones 4 y 5 del documento de arquitectura): no aplica a `dashboard-crm`, que hoy corre sobre Vercel/MongoDB Atlas.
- Requerimientos no funcionales en profundidad: se dejaron solo notas puntuales donde el barrido funcional encontró algo directamente relevante (ver el final de `00-trazabilidad-CU-RF.md`).

## Único punto genuinamente abierto

- **Brecha #7** (Franquicias/Royalties): el documento de arquitectura no define nada al respecto (ni la jerarquía Franquicia→Sucursal, ni la lógica de royalties) — pendiente de definición de alcance con Negofin, ¿entra en el Release 1, en un incremento posterior, o requiere un documento de alcance propio?

Todo lo demás en `01-brechas-y-decisiones.md` está resuelto, aplicando directamente las reglas ya explícitas en el documento de arquitectura donde correspondía (ej. sincronización unidireccional), sin necesidad de una conversación de negocio adicional.
