# Registro de brechas y decisiones — Migración a nueva arquitectura

Fuente de la arquitectura objetivo: `Documentacion/20260812-307HPN-Arquitectura_de_la_solucion_Portal_de_Vendedores_v01.docx` (v01, 2026-08-12, Lucio Flores).

Este documento registra, para cada punto donde el comportamiento actual de `dashboard-crm` diverge de la arquitectura nueva (BFF + microservicios + PostgreSQL + bus de eventos), la decisión ya tomada con el usuario (Sergio Genes, Ceibo Digital) el 2026-08-21. Es el documento de referencia para no perder de vista qué se traslada, qué cambia y qué queda fuera de la primera versión.

Convención de estado:
- **TRASLADA** — la funcionalidad pasa a la nueva arquitectura, eventualmente con otra implementación técnica.
- **DOCUMENTA Y EXCLUYE** — la funcionalidad actual está resuelta y funcionando, se documenta como referencia, pero queda fuera del alcance de la primera versión entregada a Negofin. Se prevé retomarla en un incremento posterior.
- **DESCARTA** — no se traslada ni se documenta en detalle; no aplica a la nueva arquitectura.
- **PENDIENTE DE DISEÑO** — no está resuelto ni por la app actual ni por el documento de arquitectura; requiere diseño nuevo.

---

## 1. Módulo Empresas

**Estado: DESCARTA**

Hoy es una entidad CRM administrable (`companies/page.tsx`, modelo `Company` sincronizado con HubSpot). El documento de arquitectura (sección 1.3) la excluye explícitamente del Release 1: *"Módulo de empresas como entidad administrable. El empleador del cliente se trata como atributo proveniente del core, no como entidad del CRM."*

- El vendedor deja de gestionar empresas en el portal.
- El empleador se muestra como atributo de solo lectura en la ficha del contacto, proveniente del core financiero (SGC/Solucred).
- **No se migra ningún dato existente de `Company`.**
- Impacto en el diseño de Franquicias/Royalties (ver punto 7): el mapeo original de Aliado/Franquicia como `Company` en HubSpot queda obsoleto y debe rediseñarse sobre el modelo de "sucursal" del documento nuevo.

## 2. WhatsApp (chat vendedor↔lead vía Infobip)

**Estado: DOCUMENTA Y EXCLUYE**

Distinto del *canal WhatsApp del agente conversacional* que menciona el documento de arquitectura (ese sí está fuera de alcance por depender de verificación de negocio ante Meta). Acá se habla del chat manual vendedor↔lead que ya existe hoy (Infobip, ventana de 24hs, burbujas de chat en `LeadDrawer.tsx`).

- Está resuelto y funcionando en la app actual — se documenta completo (ver `contextos/integraciones-externas-actuales.md`).
- Queda **fuera del alcance de la primera versión** entregada a Negofin.
- Se retoma en un incremento posterior, coordinado con la definición del canal WhatsApp del agente (mismo bloqueante externo: Meta/BSP).

## 3. MFA (segundo factor de autenticación)

**Estado: DOCUMENTA Y EXCLUYE (implementación actual) / TRASLADA (requerimiento, con nuevo mecanismo)**

Hoy: TOTP vía `otplib`, requiere app autenticadora, lockout de 3 intentos. El documento de arquitectura (RF-22, sección 3.8) especifica *"código de un solo uso enviado por correo o mensaje de texto, sin exigir la instalación de una aplicación de autenticación"*.

- El TOTP actual se documenta como referencia histórica, pero **no se traslada** — no se reutiliza esa implementación.
- Se diseña un **nuevo flujo de OTP por email/SMS**, implementado detrás de un adaptador desacoplado (mismo patrón que `ICRMProvider`/`IMessagingProvider` de hoy), conceptualmente ubicado en el futuro servicio **Notificación**.
- Proveedor de email: **SendGrid** (ya en uso hoy para otros envíos).
- Proveedor de SMS: **pendiente de definir con Negofin** — el propio documento lo marca como definición abierta en 8.5 ("Política de segundo factor y criterios de acceso").

## 4. Sincronización con HubSpot (webhook entrante de deals)

**Estado: DOCUMENTA Y EXCLUYE**

Hoy existe un flujo de webhook entrante (`feature/deal-webhook-sync`, no mergeado a main) donde HubSpot puede empujar cambios de deals hacia el portal. El documento de arquitectura (sección 3.5–3.6) exige sincronización **estrictamente unidireccional** (portal → HubSpot), único escritor por entidad, sin resolución de conflictos por timestamp, y HubSpot como proyección de solo lectura.

Decisión tomada respetando la especificación del documento — con un argumento de peso citado textualmente del propio documento:

> *"La pérdida intermitente de actividades observada durante la demo responde a la ausencia de estas reglas [único escritor, sincronización unidireccional, sin resolución por timestamp], no a un defecto puntual de implementación."*

- El manejo actual de webhooks entrantes de HubSpot se documenta completo como referencia técnica, por si en el futuro se necesita reabrir ese camino de forma controlada.
- **Queda excluido de esta versión.** La sincronización se implementa estrictamente unidireccional.

## 5. Scoring crediticio

**Estado: DESCARTA**

Hoy la app lo calcula "en tiempo real" dentro del portal. El documento de arquitectura (sección 3.5, 3.7) establece que el score se **lee del core financiero** (SGC/Solucred) vía adaptador con caché de vigencia acotada.

- El portal deja de calcular scoring — solo lo consulta y muestra.
- **No hace falta portar ni documentar el algoritmo actual** de cálculo.

## 6. Edición offline de solicitudes de préstamo (deals)

**Estado: DESCARTA (remoción de capacidad existente) — alcance real más acotado de lo estimado inicialmente**

Confirmado en código (`src/hooks/useSync.ts`, `LeadDrawer.tsx`) que hoy el vendedor **sí puede crear y eliminar deals sin conexión** (`handleAddDeal`/`handleDeleteDeal`, escritura 100% local en `localDb.deals`, sincronización posterior). Precisión importante tras el barrido de código: **no existe hoy ninguna edición posterior** de monto, plazo, tasa, notas o etapa de un deal ya creado — ni online ni offline. O sea, lo que la migración elimina en la práctica es "alta y baja de solicitud sin conexión", no "edición de campos sin conexión" (esa funcionalidad de edición nunca existió). El documento de arquitectura (sección 1.3, 3.10) excluye explícitamente la edición sin conexión de solicitudes de préstamo, por requerir validación contra el core — la remoción real (alta/baja offline) es consistente con esa exclusión.

- Se documenta el comportamiento offline actual (alta y baja) como referencia (`contextos/workflow-deals.md`).
- En la nueva arquitectura, crear/eliminar un deal requiere conexión.
- Nota operativa para la migración/capacitación: los vendedores de campo con conectividad irregular hoy pueden dar de alta una solicitud sin señal; en la nueva versión no van a poder — esto debería comunicarse explícitamente en la capacitación de salida (el propio documento, sección 8.3, prevé "material y acompañamiento de la puesta en marcha").

## 7. Franquicias, jerarquía comercial y Royalties

**Estado: PENDIENTE DE DISEÑO**

No resuelto por la app actual (nunca se implementó) ni por el documento de arquitectura de Negofin (que solo llega hasta "sucursal" como nivel de agrupación, sin definir "franquicia" como nivel propio ni lógica de royalties).

Piezas pendientes:
- Modelar la jerarquía **Franquicia → Sucursal → Supervisor → Vendedor → Lead**.
- Lógica de **royalty por renovación**: cuando un cliente renueva un crédito, el vendedor original que lo dio de alta cobra royalty sobre la nueva colocación, sin importar quién gestionó la renovación.
- La "Regla Simply" (bloqueo de prospección cruzada entre aliados) sigue siendo una regla de negocio válida a implementar.
- El diseño previo (memoria `project_franchise_pending`) mapeaba Aliado/Franquicia como `Company` en HubSpot con esquema en MongoDB — **ese mapeo técnico quedó obsoleto** por la retirada del módulo Empresas (punto 1) y el cambio a PostgreSQL por servicio. Las reglas de negocio siguen siendo válidas; el mecanismo de implementación hay que rediseñarlo sobre los futuros servicios Leads/Asignación.
- Aclaración de nomenclatura: "Servicio Simpli" (documento de arquitectura, servicio del core para ingreso de solicitudes de crédito) y "Regla Simply" (bloqueo de prospección cruzada, diseño propio de Negofin/Ceibo) **no están relacionados** — coincidencia de nombre.

**Acción recomendada:** elevar como pregunta formal a Negofin/Lucio Flores si esta feature entra en el Release 1, en un incremento posterior, o requiere una definición de alcance propia antes de diseñarla.

## 8. Integración Salesforce

**Estado: DESCARTA**

Salesforce fue evaluado como alternativa de CRM (auth OAuth y esquema ya resueltos, webhooks de facturas vía Apex en curso — ver memoria `project_salesforce_integration`). Confirmado que el CRM definitivo del proyecto es **HubSpot**.

- El trabajo en curso de integración Salesforce no continúa.
- Se mantiene el principio de **desacoplar la integración de CRM** (patrón `ICRMProvider` ya usado hoy) para poder cambiar de proveedor en el futuro sin impacto en múltiples lugares de la aplicación — coincide con la exigencia de capa anticorrupción del documento de arquitectura (sección 3.1, 3.6).

## 9. HubSpot bidireccional en altas de leads (además del webhook de deals)

**Estado: DOCUMENTA Y EXCLUYE — resuelto aplicando directamente la regla del documento**

El barrido de código sobre el contexto Leads (`docs/migration/contextos/leads.md`) encontró un segundo camino de entrada desde HubSpot, distinto del webhook de deals ya resuelto en el punto 4: la búsqueda global por DNI (`searchGlobalLeadByDocumentId`) puede **crear un lead local a partir de datos que vienen de HubSpot** cuando no se encuentra localmente, y existe además importación de leads por `crmOwnerId`. Esto choca con la misma regla de "HubSpot como proyección de solo lectura, único escritor por entidad" del punto 4.

A diferencia del punto 7 (Franquicias), acá el documento de arquitectura **sí** da una regla general y explícita que cubre este caso sin necesidad de abrir una conversación de negocio aparte: la sincronización es siempre unidireccional desde el propietario (sección 3.5), y el propietario del contacto/prospecto es el Servicio Leads, no HubSpot (tabla de propiedad del dato, misma sección). Se aplica el mismo criterio que en el punto 4:

- El fallback a HubSpot en la búsqueda por DNI y la importación por `crmOwnerId` se documentan completos como referencia técnica (ya en `contextos/leads.md`).
- **Quedan excluidos de esta versión** — no hay camino de entrada desde HubSpot para creación de leads.
- Si en el futuro aparece un caso de negocio real (ej. un lead cargado en HubSpot antes de existir el portal), se resuelve por **importación masiva inicial puntual** (mecanismo que el propio documento ya prevé en la sección 3.6 para la carga histórica), no reabriendo un camino de lectura permanente.

## 10. HubSpot como autoridad de facto del estado del deal (hallazgo técnico, no requiere decisión — ya resuelto conceptualmente por la arquitectura nueva)

El barrido de Workflow/Deals encontró que hoy HubSpot es, en la práctica, quien manda sobre el `stage` de un deal: las 7 etapas locales se comprimen a 5 `dealstage` de HubSpot, y la sub-etapa exacta (`disbursed` vs `completed`, `refused` vs `overdue`) se recupera parseando un comentario HTML escondido en el campo `description` del deal en HubSpot. Esto ya queda resuelto por el modelo de propiedad de datos del documento de arquitectura (sección 3.5: "Solicitud de préstamo... estado autoritativo en el core financiero") — el workaround actual desaparece porque la autoridad pasa a ser el core (SGC/Solucred), no HubSpot ni el portal. Se deja registrado como nota técnica para quien diseñe el adaptador del core, no como decisión pendiente.

---

## Resumen ejecutivo (para revisión rápida)

| # | Funcionalidad | Estado | Acción |
|---|---|---|---|
| 1 | Módulo Empresas | Descarta | Retirar del portal, sin migrar datos |
| 2 | WhatsApp chat vendedor↔lead | Documenta y excluye | Incremento posterior |
| 3 | MFA | Documenta (TOTP) y excluye / Traslada (nuevo OTP) | Diseñar adaptador OTP email/SMS, SendGrid inicial |
| 4 | Sync HubSpot (webhook entrante) | Documenta y excluye | Unidireccional estricto en R1 |
| 5 | Scoring crediticio | Descarta | Consultar por API al core |
| 6 | Alta/baja offline de deals (no había edición) | Descarta | Requiere conexión en R1 — comunicar en capacitación |
| 7 | Franquicias/Royalties | Pendiente de diseño | Elevar pregunta de alcance a Negofin |
| 8 | Integración Salesforce | Descarta | HubSpot confirmado como CRM único |
| 9 | HubSpot bidireccional en altas de leads | Documenta y excluye | Misma regla del documento que el punto 4, aplicada directamente a leads |
| 10 | HubSpot como autoridad de facto del stage del deal | Resuelto por arquitectura | Nota técnica para el adaptador del core, no bloquea nada |
