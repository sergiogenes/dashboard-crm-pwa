# Bitácora de Integración con Salesforce CRM

Este documento resume los pasos realizados, los esquemas de datos configurados en Salesforce y el diagnóstico detallado de los problemas de autenticación encontrados con el fin de servir como guía de referencia para continuar con la integración en cualquier momento.

---

## 1. Pasos Completados

### A. Configuración en la Plataforma de Salesforce
1. **Registro e Ingreso:** Se creó y activó una organización gratuita de desarrollo (**Salesforce Developer Edition**).
2. **Aplicación Conectada:** Se creó una aplicación conectada (*Connected App*) llamada **Dashboard CRM PWA** (nombre de API: `dashboard_crm_pwa`) con los siguientes alcances (scopes) de OAuth habilitados:
   * `api` (Administrar datos de usuario a través de API)
   * `refresh_token, offline_access` (Realizar solicitudes en cualquier momento)
3. **Credenciales Obtenidas:** Se copiaron de forma segura las credenciales de la Connected App:
   * **Clave de consumidor** (*Consumer Key* / Client ID)
   * **Secreto de consumidor** (*Consumer Secret* / Client Secret)
4. **Token de Seguridad:** Se restableció y obtuvo el **Security Token** (Token de Seguridad) de la cuenta de usuario.
5. **Políticas de Ejecución:** Se editó la política de la aplicación conectada para asignar como **Usuario de ejecución** (*Execution User*) al usuario administrador `Sergio Genes`.

---

### B. Personalización del Esquema en Salesforce
Para lograr compatibilidad 1:1 con las entidades locales y HubSpot, se crearon los siguientes objetos y campos personalizados en Salesforce (añadiéndoles automáticamente el sufijo de API `__c`):

1. **En el objeto `Contact` (Contacto):**
   * `National_ID_Number__c` (Tipo: Texto, Longitud: 50, marcado como *Único* e *Identificador externo*). Almacena la Cédula/DNI del contacto.
   * `Scoring__c` (Tipo: Texto, Longitud: 50). Almacena el scoring crediticio.
2. **En el objeto `Account` (Cuenta/Empresa):**
   * `Domain__c` (Tipo: Texto, Longitud: 255). Almacena el dominio de la empresa (ej: `empresa.com`).
3. **Objeto Personalizado `Invoice__c` (Factura):**
   * Se creó la tabla `Invoice__c` con los siguientes campos:
     * `Amount__c` (Moneda 16, 2): Monto facturado.
     * `Balance_Due__c` (Moneda 16, 2): Saldo pendiente de pago.
     * `Status__c` (Lista de selección): Valores permitidos: `PAID`, `PENDING`, `OVERDUE`.
     * `Invoice_Date__c` (Fecha/Hora): Fecha de emisión.
     * `Due_Date__c` (Fecha/Hora): Fecha de vencimiento.
     * `Payment_Date__c` (Fecha/Hora): Fecha de pago efectiva.
     * `Contact__c` (Relación de búsqueda / Lookup): Vínculo hacia el Contacto.

---

### C. Cambios en el Código (Next.js)
1. **Librería Cliente:** Se instaló `jsforce` y sus tipos `@types/jsforce` en la nueva rama `feature/salesforce-integration`.
2. **Base de Datos de Pruebas:** Se creó una nueva base de datos en MongoDB Atlas llamada `dashboard-pwa-salesforce` y se actualizó la variable `MONGODB_URI` en el archivo local `.env.development.local` para aislar los datos e IDs antiguos de HubSpot.
3. **Estructura del Adaptador:** Se creó el archivo [salesforce.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/salesforce.ts) implementando la interfaz `ICRMProvider` de forma 100% tipada (resolviendo conflictos de firmas de métodos de jsforce mediante casteos seguros de `unknown` en retornos de `.create()`).
4. **Registro en Factoría:** Se modificó [factory.ts](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/src/lib/crm/factory.ts) para resolver la clase `SalesforceProvider` cuando `CRM_PROVIDER="salesforce"`.
5. **Plantilla de Variables:** Se actualizó [.env.template](file:///C:/Users/sergi/Documents/Ceibo/Proyectos/307-HPN/dashboard-crm/.env.template) con el bloque de variables requeridas para Salesforce.

---

## 2. Diagnóstico del Problema de Autenticación

Al intentar probar la conexión, el servidor Next.js arrojó repetidamente el siguiente error de autenticación:
> `[Salesforce Connection Error in checkHealth]: invalid_grant: authentication failure`

### Causa del Fallo
El error se debió al intento de utilizar el flujo clásico **Username-Password + Security Token**. A partir de la versión **Summer '23**, Salesforce **bloquea de forma predeterminada** los flujos de contraseña y nombre de usuario en todas las organizaciones nuevas. En el panel de control de tu cuenta (en *Configuración de OAuth y OpenID Connect*), la opción *"Permitir flujos de contraseña-nombre de usuario de OAuth"* se encuentra desactivada y completamente deshabilitada (grisada), impidiendo su activación por políticas estrictas de seguridad.

### Solución Diseñada
Reemplazar el flujo Username-Password por el **OAuth 2.0 Client Credentials Flow** (Flujo de Credenciales de Cliente). Este flujo moderno:
1. No requiere contraseñas ni tokens de seguridad locales (evita fallos de dotenv con caracteres especiales).
2. Solo requiere la **Clave** y el **Secreto de consumidor** (`Client ID` y `Client Secret`).
3. Se ejecuta de manera segura en segundo plano utilizando los privilegios del usuario de ejecución que ya asignamos (`Sergio Genes`).

---

## 3. Hoja de Ruta para Retomar la Sincronización

Cuando decidas continuar, debes seguir exactamente estos pasos:

### Paso 1: Activar el flujo de credenciales de cliente en Salesforce
1. En tu panel de Salesforce (vista clásica o Lightning), ve a la página de definición de la Connected App.
   * *Ruta en Classic:* Configuración -> Compilar -> Crear -> Aplicaciones -> En la tabla "Aplicaciones conectadas", haz clic en **Modificar** (Edit) al lado de `Dashboard CRM PWA` (asegúrate de que sea el formulario que tiene las casillas de OAuth, no la página de políticas de sesión).
2. Desplázate a la sección **API (Habilitar configuración de OAuth)**.
3. Busca y marca la casilla **Activar flujo de credenciales de cliente** (Enable Client Credentials Flow).
4. Guarda los cambios.

### Paso 2: Aplicar la propuesta de código para Client Credentials en `salesforce.ts`
Modifica el método `getConnection()` en `src/lib/crm/salesforce.ts` para solicitar el token dinámicamente usando la API REST de Salesforce (`/services/oauth2/token`) en lugar de `conn.login()`:

```typescript
  private async getConnection(): Promise<Connection> {
    const now = Date.now()
    if (this.conn && now - this.lastLoginTime < this.tokenExpiryMs) {
      return this.conn
    }

    const clientId = process.env.SALESFORCE_CLIENT_ID
    const clientSecret = process.env.SALESFORCE_CLIENT_SECRET
    const loginUrl = process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com'

    if (!clientId || !clientSecret) {
      throw new Error('Faltan variables de entorno SALESFORCE_CLIENT_ID o SALESFORCE_CLIENT_SECRET')
    }

    // Petición directa al endpoint de tokens de Salesforce
    const params = new URLSearchParams()
    params.append('grant_type', 'client_credentials')
    params.append('client_id', clientId)
    params.append('client_secret', clientSecret)

    const tokenRes = await fetch(`${loginUrl}/services/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    if (!tokenRes.ok) {
      const errText = await tokenRes.text()
      throw new Error(`Fallo de autenticación Client Credentials en Salesforce: ${errText}`)
    }

    const tokenData = await tokenRes.json()

    // Inicializamos jsforce con el token y la URL de instancia obtenidos en el flujo de credenciales
    this.conn = new Connection({
      accessToken: tokenData.access_token,
      instanceUrl: tokenData.instance_url,
    })
    this.lastLoginTime = Date.now()

    return this.conn
  }
```

### Paso 3: Limpiar `.env.development.local`
Ya no necesitaremos el usuario, contraseña ni token de seguridad. Puedes simplificar tus variables de entorno para Salesforce a solo estas 3 en tu archivo local:
```env
CRM_PROVIDER="salesforce"
SALESFORCE_CLIENT_ID="Tu_Clave_De_Consumidor"
SALESFORCE_CLIENT_SECRET="Tu_Secreto_De_Consumidor"
SALESFORCE_LOGIN_URL="https://login.salesforce.com"
```

### Paso 4: Levantar el servidor y Probar
1. Ejecuta `npm run dev`.
2. Crea un contacto en la PWA y verifica que se sincronice en tu panel de Salesforce (menú Ventas -> Contactos -> Todos los contactos).

---

## 4. Sesión del 6 de julio de 2026 — Estabilización y Webhooks de Facturas

### Bugs resueltos

1. **`INVALID_SESSION_ID` intermitente en `checkHealth`**: causado por que Next.js compila el código en capas de módulos aisladas (`rsc`, `action-browser`, `edge`), cada una con su propia instancia de `SalesforceProvider` logueándose por separado y compitiendo por la sesión del mismo usuario de ejecución. Se corrigió `src/lib/crm/factory.ts` para cachear **todos** los proveedores (antes solo el mock) en `globalThis`, y se agregó en `src/lib/crm/salesforce.ts` un wrapper `withConnection()` con reintento automático ante sesión inválida.
2. **Fecha de recordatorio incorrecta en Salesforce**: `createActivity` seteaba `ActivityDate` (Fecha de vencimiento) con la fecha de creación de la nota en vez de la fecha del recordatorio (`reminderDate`). Corregido, y se usa `CreatedDate` de Salesforce (inmutable) para el `timestamp` real de la actividad al leer con `fetchActivitiesByLead`.
3. **Campo faltante `Balance_Due__c` en `Invoice__c`**: no existía en el esquema (no era un problema de nombre como `Dominio__c`, directamente faltaba). Se creó como Moneda(16,2) con etiqueta en inglés "Balance Due".

### Gap de arquitectura identificado: Salesforce no tiene webhooks

A diferencia de HubSpot (que empuja cambios de facturas vía webhooks nativos), Salesforce en esta integración solo se consulta por polling. Una factura creada directamente en Salesforce para un contacto que ya está sincronizado y sin cambios locales pendientes **nunca llega a la app** salvo que:
- el lead se edite localmente (dispara el polling de fondo), o
- el lead sea ajeno o recién purgado de la caché local (dispara `getGlobalLeadDetails` on-demand).

Se decidió implementar webhooks reales usando Apex (Trigger + Queueable con callout HTTP), en vez de depender solo del polling.

### Simplificación del webhook genérico

Se modificó `src/app/api/webhooks/crm/route.ts`: el handler de `invoice.upsert` ahora **siempre** hace un refetch completo vía `crm.fetchInvoiceById(crmId)`, en vez de parchear campo a campo con `propertyName`/`propertyValue` (ese patrón, heredado del formato de webhooks de HubSpot, solo se ejecutaba en la creación inicial). Esto simplifica el payload que cualquier proveedor debe enviar — solo el ID que cambió — y elimina el riesgo de drift si se pierde algún evento intermedio.

### Infraestructura de webhooks para Salesforce (Apex)

**Clase Apex `InvoiceWebhookNotifier`** (Queueable, hace el callout HTTP):
```apex
public class InvoiceWebhookNotifier implements Queueable, Database.AllowsCallouts {
    private List<Id> invoiceIds;
    private String eventType;

    public InvoiceWebhookNotifier(List<Id> invoiceIds, String eventType) {
        this.invoiceIds = invoiceIds;
        this.eventType = eventType;
    }

    public void execute(QueueableContext context) {
        List<Map<String, String>> events = new List<Map<String, String>>();
        for (Id invId : invoiceIds) {
            events.add(new Map<String, String>{
                'subscriptionType' => eventType,
                'crmId' => String.valueOf(invId)
            });
        }

        Map<String, Object> payload = new Map<String, Object>{ 'events' => events };

        HttpRequest req = new HttpRequest();
        req.setEndpoint('https://clamp-limit-gruffly.ngrok-free.dev/api/webhooks/crm');
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setHeader('ngrok-skip-browser-warning', 'true');
        req.setHeader('x-salesforce-webhook-token', 'EL_MISMO_VALOR_DE_SALESFORCE_WEBHOOK_SECRET');
        req.setBody(JSON.serialize(payload));

        Http http = new Http();
        HttpResponse res = http.send(req);
        System.debug('[InvoiceWebhook] Respuesta: ' + res.getStatusCode() + ' ' + res.getBody());
    }
}
```
Ya creada en Salesforce (Setup → Apex Classes).

**Trigger `InvoiceWebhookTrigger`** sobre `Invoice__c` (`after insert, after update, after delete`):
```apex
trigger InvoiceWebhookTrigger on Invoice__c (after insert, after update, after delete) {
    List<Id> invoiceIds = new List<Id>();
    String eventType = Trigger.isDelete ? 'invoice.deletion' : 'invoice.upsert';

    for (Invoice__c inv : (Trigger.isDelete ? Trigger.old : Trigger.new)) {
        invoiceIds.add(inv.Id);
    }

    System.enqueueJob(new InvoiceWebhookNotifier(invoiceIds, eventType));
}
```
Pendiente de crear (Setup → Gestor de objetos → Factura → Desencadenadores/Triggers).

**Remote Site Setting** `DashboardCRM_Webhook` → `https://clamp-limit-gruffly.ngrok-free.dev` — creado.

**Túnel local (ngrok)**: instalado vía `winget install ngrok.ngrok`, con dominio estático reservado `clamp-limit-gruffly.ngrok-free.dev`. Se resolvió un conflicto de versión de config (`ngrok.yml` en formato v3 de una instalación previa vs. binario v3.3.1 recién instalado que solo soporta v1/v2) migrando el YAML a formato v2, y se actualizó el binario a v3.39.9 vía `ngrok update` (la cuenta del usuario exige agente mínimo v3.20.0).

**Variables de entorno**: `.env.template` actualizado — removidas `SALESFORCE_USERNAME`/`SALESFORCE_PASSWORD`/`SALESFORCE_SECURITY_TOKEN` (obsoletas, del flujo de auth anterior a Client Credentials), agregada `SALESFORCE_WEBHOOK_SECRET`.

### Pendiente para la próxima sesión

1. Terminar de crear el trigger `InvoiceWebhookTrigger` en Salesforce (Object Manager → Factura → Triggers).
2. Completar en el Apex `InvoiceWebhookNotifier` la URL real, el header `ngrok-skip-browser-warning`, y un token secreto real.
3. Setear ese mismo token en `SALESFORCE_WEBHOOK_SECRET` en `.env.development.local` y reiniciar `npm run dev`.
4. Levantar `ngrok http 3000 --domain=clamp-limit-gruffly.ngrok-free.dev` y probar editando `FAC-001` en Salesforce — verificar el log `[Webhook CRM] Factura crmId ... guardada/actualizada.` en la consola del servidor y el reflejo en la pestaña Finanzas de la app.
5. Verificar que el picklist `Status__c` tenga exactamente los valores `PENDING`, `PAID`, `OVERDUE` (inglés, mayúsculas).
6. Evaluar si extender el mismo patrón (Apex Trigger + Queueable) a `Contact` y `Account` para reflejar en tiempo real ediciones hechas directamente en Salesforce, replicando la cobertura de HubSpot.
