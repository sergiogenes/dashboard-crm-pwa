# Identidad, Autenticación y Administración — cross-cutting (arquitectura nueva)

> Fuente: código actual de `dashboard-crm` (rama `feature/feedback-13-fix-credit-history-button`). Documento de insumo para la migración a BFF + microservicios NestJS/PostgreSQL + bus de eventos. Corresponde a la sección 3.8 del documento de arquitectura ("el portal gobierna la identidad de todos sus usuarios").

## Casos de uso y requerimientos que cubre

- **CU-09** — Administración de usuarios, roles y sucursales (Administrador): alta y baja de vendedores y supervisores, agrupación por sucursal, permisos por sucursal.
- **RF-20** — Administración de sucursales y agrupación de vendedores/supervisores por sucursal.
- **RF-21** — Esquema de roles y permisos con alcance por sucursal.
- **RF-22** — Inicio de sesión simplificado con segundo factor por código de un solo uso, sin requerir aplicación de autenticación.
- **Sección 3.8** — El portal gobierna la identidad de todos sus usuarios (no depende de un directorio corporativo de Negofin, por costo de licenciamiento y riesgo de bajas no notificadas de personal de franquicia). La autenticación se resuelve en la puerta de entrada (futuro API Gateway); la autorización, en cada servicio, sobre el contexto recibido. Modelo jerárquico vendedor/supervisor/administrador con alcance por sucursal. El ciclo de vida de identidades (alta, cambio de sucursal, baja, reasignación de cartera) es función del portal y queda auditado.

Este documento contrasta ese objetivo con lo que existe hoy en el código, para dejar explícitas las brechas que la migración debe cerrar.

## Modelo de roles actual

`src/models/User.ts` define `roles: ('admin' | 'supervisor' | 'user')[]` — un usuario puede tener **más de un rol simultáneamente** (array, no campo único). Existe además un campo legado `role` (string singular) que ya no se escribe en altas nuevas pero que `admin.ts` y otras partes del código todavía leen como fallback (`u.roles?.length ? u.roles : [u.role || 'user']`), señal de una migración de esquema en curso dentro del propio sistema actual.

Qué puede hacer cada rol hoy:

- **`admin`** — Único rol con acceso a `/admin` (`getAdminIdOrThrow()` en `src/app/actions/admin.ts` exige `session.user.roles.includes('admin')`). Puede:
  - Ver el listado completo de usuarios (`getAdminUserData`).
  - Cambiar los roles de cualquier usuario (`updateUserRoles`) — con la validación de que un usuario debe conservar al menos un rol.
  - Asignar/desasignar vendedores a un supervisor en bloque (`assignSalespeopleToSupervisor`).
  - Resetear el MFA de cualquier usuario (`adminResetMFA` en `mfa.ts`).
  - **No existe** una acción para crear un usuario directamente ni para darlo de baja/desactivarlo (ver brechas).
- **`supervisor`** — Dashboard de equipo, ve las métricas y leads de los vendedores que tienen su `_id` en `supervisorId` (lógica en `src/app/actions/supervisor.ts`, fuera del alcance leído para este documento pero referenciada en `CLAUDE.md`). Puede reasignar leads e importar CSV según la documentación del proyecto.
- **`user`** (vendedor) — Gestiona sus propios contactos, empresas y préstamos. Es el único rol al que aplica `supervisorId`.

La jerarquía hoy es **plana en el modelo de datos**: no hay una tabla de permisos por rol, cada Server Action valida el rol "a mano" (`session.user.roles?.includes('admin')`, o comparaciones directas contra `currentUser.role`). No hay un catálogo de permisos granular (RF-21 pide "esquema de roles y permisos"): hoy es rol → todo o nada dentro de las rutas ya code-first protegidas por cada Server Action, no una matriz de permisos declarativa.

Nota de inconsistencia menor detectada: `mfa.ts::adminResetMFA` valida `currentUser.role !== 'admin'` (campo legado singular), mientras que `admin.ts::getAdminIdOrThrow` valida `session.user.roles?.includes('admin')` (array nuevo). Si un admin fue promovido solo vía `roles` sin el campo `role` legado, `adminResetMFA` podría rechazarlo indebidamente — comportamiento a verificar/limpiar si se decide portar esta lógica tal cual, aunque no aplica según la decisión de migración de MFA (ver más abajo).

## Flujo de autenticación y MFA actual (TOTP) — referencia histórica

> Nota: por decisión de migración ya tomada, este flujo TOTP **no se traslada** a la nueva arquitectura. Se documenta con precisión porque es la referencia histórica a conservar.

**Login (`src/lib/auth.ts`, NextAuth Credentials Provider):**
1. `authorize()` busca el usuario por `email` (lowercase) en MongoDB y compara `password` contra `passwordHash` con `bcrypt.compare`.
2. Si es válido, descifra `dbEncryptionKey` (AES-256-CBC servidor, `decrypt()` de `src/lib/crypto.ts`) y arma el objeto de sesión con `mfaRequired: true` y `mfaVerified: false` siempre en el primer login del ciclo de sesión — es decir, MFA se re-exige en cada nueva sesión JWT, no solo la primera vez que el usuario configura MFA.
3. El callback `jwt()` guarda `id`, `roles`, `twoFactorEnabled`, `dbEncryptionKey` y los flags de MFA en el token. Cuando el cliente dispara `session.update()` con un `mfaToken` firmado, `verifyMfaToken()` valida la firma HMAC-SHA256 y la expiración (60 segundos) antes de marcar `mfaVerified = true` en el token.
4. `src/middleware.ts` intercepta toda ruta protegida (todo excepto `api/auth`, `api/webhooks/*`, `api/health`, `auth/signin`, `auth/forgot-password`, `auth/reset-password`, assets estáticos): si `mfaRequired && !mfaVerified`, redirige a `/auth/mfa-setup` (si el usuario nunca activó 2FA) o a `/auth/mfa` (si ya lo tiene activo). Si ya está verificado e intenta volver a esas rutas, lo manda al home.

**Setup inicial (`generateMfaSetup` / `enableMFA` en `mfa.ts`, página `src/app/auth/mfa-setup/page.tsx`):**
1. `generateMfaSetup()` exige sesión válida y que el usuario **no** tenga ya `twoFactorEnabled`. Genera un secreto TOTP con `otplib` (`generateSecret()`), arma la URI `otpauth://` (`generateURI({ secret, label: user.email, issuer: 'DashboardCRM' })`) y la codifica como QR en base64 (`qrcode`).
2. El usuario escanea el QR con Google Authenticator/Authy e ingresa el primer código de 6 dígitos.
3. `enableMFA(secret, code)` valida el código contra el secreto (`otplib.verify`, async). Si es válido, genera **8 backup codes** de 10 caracteres hex (`crypto.randomBytes(5).toString('hex').toUpperCase()`), guarda solo sus hashes SHA-256 en `twoFactorBackupCodes`, guarda `twoFactorSecret` en claro en Mongo (**no cifrado** — ver brechas) y pone `twoFactorEnabled = true`.
4. Devuelve los backup codes en texto plano una única vez (para descarga/copia en el cliente) junto con un `mfaToken` firmado que la UI usa para actualizar la sesión NextAuth (`mfaVerified = true`) sin pedir el código de nuevo.

**Verificación en cada login (`verifyMFA` en `mfa.ts`, página `src/app/auth/mfa/page.tsx`):**
1. Acepta o bien un código TOTP de 6 dígitos (regex `^\d{6}$`) o un backup code de 10 caracteres hex (regex `^[0-9A-F]{10}$`).
2. Si es TOTP, valida contra `otplib.verify`. Si es backup code, compara el hash SHA-256 contra `twoFactorBackupCodes` y, si coincide, **lo elimina del array** (se "quema", uso único).
3. Si es válido, firma y devuelve un `mfaToken` (HMAC, 60s de validez) que el cliente sube a NextAuth vía `session.update()`.

**Lockout de 3 intentos:** implementado **enteramente en el cliente** (`src/app/auth/mfa/page.tsx`), con un contador en `sessionStorage` (`mfa_attempts`) que persiste entre refrescos de página. Al llegar a 3 intentos fallidos, la UI deshabilita el formulario, muestra el mensaje de error y ejecuta `signOut()` a los 2 segundos con `callbackUrl=/auth/signin?error=MfaAttemptsExceeded`. **No hay ningún límite de intentos aplicado en el servidor** — `verifyMFA()` en `mfa.ts` no cuenta ni bloquea intentos; un cliente que no pase por esa UI (llamando la Server Action directamente) puede intentar códigos sin límite. Ver brechas.

**Reset administrativo (`adminResetMFA`):** un admin puede resetear el MFA de cualquier usuario (borra `twoFactorSecret`, `twoFactorBackupCodes`, pone `twoFactorEnabled = false`), típicamente para destrabar a un usuario que perdió su dispositivo y sus backup codes.

## Administración de usuarios (alta/baja/roles)

- **Alta:** hoy **no existe un flujo de alta por parte del administrador**. La única forma de crear un usuario es el **autorregistro público** en `/auth/signin` (`registerUser` en `src/app/actions/auth.ts`): cualquier persona con acceso a la pantalla de login puede crear una cuenta con nombre/email/password, sin invitación ni aprobación previa, y queda logueada automáticamente. El usuario nace con el rol por defecto del esquema (`roles: ['user']`) y sin `supervisorId` — un admin debe asignarle supervisor y roles después, manualmente, desde `/admin`.
- **Baja:** **no existe ninguna acción para eliminar o desactivar un usuario.** No hay campo `active`/`disabled`/`deletedAt` en `User.ts`, ni una función `deleteUser`/`deactivateUser` en `admin.ts` ni en ningún otro archivo del repo. Un usuario dado de baja de la financiera seguiría pudiendo autenticarse indefinidamente salvo que alguien cambie manualmente su contraseña en la base o le quite todos los roles (lo cual tampoco le impide loguearse, solo le quita acceso a rutas protegidas por rol).
- **Cambio de roles:** `updateUserRoles(userId, roles)` en `admin.ts` — reemplaza el array `roles` completo. Reglas de negocio embebidas:
  - No permite dejar a un usuario sin ningún rol.
  - Si el usuario deja de ser `supervisor`, se le quita `supervisorId` a todos los vendedores que lo tenían asignado (`$unset` masivo).
  - Si el usuario deja de tener rol `user` (vendedor), se le limpia su propio `supervisorId`.
- **Asignación vendedor↔supervisor:** `assignSalespeopleToSupervisor(supervisorId, salespeopleIds)` hace un reemplazo completo del set de vendedores a cargo de un supervisor (asigna a los nuevos, desasigna a los que ya no están en la lista).
- **Password reset autoservicio:** `src/app/actions/password-reset.ts` — token de un solo uso (32 bytes random, hash SHA-256 almacenado, TTL de 30 min con índice Mongo TTL además de validación por código), enviado por email vía SendGrid (`src/lib/mail.ts`). Con mitigación de enumeración de usuarios (responde éxito aunque el email no exista).
- **UI de administración:** `src/app/(dashboard)/admin/page.tsx` — tabla de usuarios con checkboxes de rol (Vendedor/Supervisor/Admin) y panel de asignación de vendedores a un supervisor seleccionado. No expone alta ni baja de usuarios, solo edición de roles y de la relación supervisor-vendedor.
- **`settings/page.tsx`:** autoservicio del propio usuario — ve su perfil (nombre, email, id), estado de MFA, y estadísticas de la caché local (Dexie). No permite cambiar contraseña ni datos de perfil desde ahí (eso pasa por el flujo de "forgot password").

## ¿Existe el concepto de "sucursal" hoy?

**No.** Se buscó explícitamente "sucursal", "branch" y "office" (case-insensitive) en todo `src/` y no hay ninguna coincidencia. El único mecanismo de agrupación de usuarios hoy es la relación jerárquica plana `supervisorId` en `User.ts` (un vendedor apunta a un único supervisor por `_id` de Mongo) — no hay una entidad "Sucursal"/"Oficina" ni un campo que agrupe usuarios por ubicación física o unidad de negocio, y por lo tanto tampoco hay permisos con alcance por sucursal (todo el alcance de datos hoy se resuelve por `supervisorId` o por ser dueño del recurso, no por pertenencia a un grupo intermedio).

Esto confirma que **RF-20 y RF-21 (agrupación y permisos por sucursal) son concepto nuevo a construir**, no una evolución de algo existente. El diseño nuevo tendrá que introducir una entidad `Sucursal`/`Branch`, asociarla a `User` (y probablemente a `Lead`/`Deal` para el alcance de datos), y decidir si reemplaza o convive con el actual `supervisorId`.

## Datos que toca

- **`User`** (`src/models/User.ts`): `name`, `email` (único, index), `passwordHash` (bcrypt), `crmOwnerId` (id de owner en HubSpot), `twoFactorEnabled`, `twoFactorSecret` (**en claro**, sin cifrar), `twoFactorBackupCodes` (array de hashes SHA-256), `roles` (array), `supervisorId` (string, no `ObjectId` con `ref`, solo `index`), `disbursementGoal`, `dbEncryptionKey` (cifrado con `SERVER_ENCRYPTION_SECRET`, se descifra en cada login para inyectarse en el JWT y usarse en cliente para Dexie).
- **`PasswordResetToken`** (`src/models/PasswordResetToken.ts`): `userId` (ref a `User`), `tokenHash` (SHA-256), `expiresAt` (con índice TTL de Mongo `expires: 0`, borrado automático al expirar).
- **Sesión NextAuth (JWT):** `id`, `roles`, `mfaRequired`, `mfaVerified`, `twoFactorEnabled`, `dbEncryptionKey` — este último es sensible: viaja dentro del JWT de sesión para que el cliente pueda descifrar/cifrar su caché local Dexie.
- No hay ninguna colección/tabla de auditoría de identidad (ver más abajo).

## Edge cases y comportamientos conocidos

- El MFA se vuelve a exigir en **cada sesión nueva** (cada login re-arranca en `mfaVerified: false`), no es "recordar este dispositivo" — comportamiento estricto pero también más fricción, relevante para el rediseño con RF-22 (login simplificado).
- El lockout de intentos MFA es **solo de cliente** (sessionStorage) — bypasseable llamando la Server Action directamente sin la UI. Es una brecha real de seguridad a resolver en el nuevo diseño (rate-limit / lockout server-side).
- El secreto TOTP (`twoFactorSecret`) se guarda **sin cifrar** en MongoDB, a diferencia del resto de los campos sensibles del sistema (PII cifrada con AES-256-CBC vía getters/setters Mongoose, según `CLAUDE.md`). Inconsistencia de seguridad respecto al resto del modelo de datos.
- El autorregistro público (`registerUser`) no tiene ningún control de invitación, dominio de email permitido, ni aprobación de un admin — cualquiera que llegue a `/auth/signin` puede crear una cuenta activa de "vendedor" en el sistema (con acceso limitado hasta que se le asigne supervisor, pero cuenta funcional igual). Contradice el modelo de "alta gobernada por administrador" que pide CU-09.
- No existe soft-delete ni flag de usuario activo/inactivo: dar de baja a alguien hoy requeriría intervención manual directa en la base de datos.
- `supervisorId` es un `string` suelto (no `ObjectId` con populate real) — la resolución del nombre del supervisor en `getAdminUserData` se hace comparando strings en memoria (`allUsers.find(sup => String(sup._id) === u.supervisorId)`), no vía `.populate()` de Mongoose.
- Existe una inconsistencia entre el campo legado `role` (singular) y el nuevo `roles` (array) — conviven en el modelo y distintas partes del código validan por uno u otro (ver nota en "Modelo de roles actual"), riesgo a limpiar antes o durante la migración.
- El middleware protege por sesión válida + estado de MFA, pero **no** por rol — el control de acceso por rol ocurre recién dentro de cada Server Action (`getAdminIdOrThrow`, comparaciones directas). No hay un guard centralizado de autorización.

## Disposición en la migración

- **MFA/TOTP actual:** se documenta aquí como referencia histórica pero **no se traslada tal cual** a la nueva arquitectura. Decisión de migración ya tomada: diseñar un **flujo de OTP por email/SMS** (código de un solo uso, sin app autenticadora — esto es exactamente lo que pide RF-22), implementado detrás de un **adaptador desacoplado**, con el mismo patrón que hoy usa `ICRMProvider`/`IMessagingProvider` (interfaz + implementación intercambiable + mock para tests). Conceptualmente este adaptador vive en el futuro **servicio de Notificación**.
  - Proveedor de email: **SendGrid** (ya integrado hoy vía `src/lib/mail.ts` para el flujo de password reset — se reutiliza el proveedor, no la lógica de MFA).
  - Proveedor de SMS: **pendiente de definir con Negofin.**
  - El lockout de intentos deberá reimplementarse **del lado servidor** (contador y expiración persistidos, no en `sessionStorage` del cliente) para cerrar la brecha de seguridad detectada arriba.
  - Los backup codes (o un mecanismo equivalente de recuperación) deben rediseñarse para el nuevo flujo OTP — el mecanismo actual (10 caracteres hex, hash SHA-256, uso único) es reutilizable conceptualmente.
- **Autenticación vs. autorización (sección 3.8):** la migración separa explícitamente ambas responsabilidades. Hoy están mezcladas: NextAuth resuelve autenticación, pero cada Server Action re-implementa a mano su propia validación de autorización (`session.user.roles?.includes('admin')`). En la nueva arquitectura, la autenticación se resuelve en la puerta de entrada (futuro API Gateway/BFF) y la autorización se evalúa en cada microservicio sobre el contexto (usuario, roles, sucursal) que ese gateway propaga — hay que decidir el formato de ese contexto (¿JWT propio del gateway con claims de rol+sucursal, similar al JWT de NextAuth de hoy pero emitido por el nuevo Auth/Identity service?).
- **Roles y alcance por sucursal (RF-20/RF-21):** el modelo actual roles-array + `supervisorId` es la base conceptual pero es insuficiente — hay que introducir la entidad `Sucursal` desde cero (no existe hoy) y decidir si el alcance de datos se resuelve por sucursal, por jerarquía de supervisor, o por ambos (ej. un supervisor ve su sucursal completa, no solo "sus" vendedores asignados uno a uno como hoy).
- **Alta y baja de usuarios (CU-09):** la migración debe reemplazar el autorregistro abierto actual por un flujo de alta gobernado por el administrador (o al menos gateado por invitación/aprobación), y agregar baja real (desactivación, no necesariamente borrado físico, para preservar trazabilidad de datos históricos de leads/deals ya asignados a ese usuario).
- **Auditoría del ciclo de vida de identidad:** hoy no existe (ver brecha abajo) — el nuevo diseño debe agregar un registro auditable explícito de alta, cambio de rol, cambio de sucursal, reasignación de cartera y baja, coherente con que "el ciclo de vida de identidades... queda auditado" (sección 3.8).
- **Cifrado de `dbEncryptionKey` en el JWT:** este mecanismo es específico de la arquitectura actual (Dexie cifrado en cliente) y su continuidad depende de si el nuevo diseño mantiene una capa offline-first con cifrado de cliente — a resolver en conjunto con el contexto de sincronización (`project_sync_architecture` en memoria), no es una decisión aislada de este contexto.

## Brechas / preguntas abiertas detectadas

1. **No hay concepto de "sucursal" hoy** — RF-20/RF-21 requieren construirlo desde cero (entidad nueva, asociación a `User`, y probablemente a los recursos sobre los que se calcula alcance).
2. **No hay alta de usuarios gobernada por admin** — hoy es autorregistro público sin invitación ni aprobación. Contradice el espíritu de CU-09 ("alta... por el Administrador"). ¿La migración mantiene algún autorregistro (ej. para franquicias aliadas) o lo cierra completamente a favor de invitación por admin?
3. **No hay baja de usuarios** — ni soft-delete ni flag activo/inactivo. Falta definir qué pasa con los leads/deals/actividades ya asignados a un usuario dado de baja (¿se reasignan automáticamente? ¿quedan huérfanos? ¿bloquea la baja si tiene cartera activa?).
4. **No hay auditoría del ciclo de vida de identidad** — no se encontró ninguna colección/tabla de logs de auditoría para altas, cambios de rol, cambios de supervisor o bajas en todo el código (`admin.ts` no escribe ningún registro histórico; los `updatedAt` de Mongoose solo dan el último cambio, no el historial). Es un gap total frente al requisito de sección 3.8 de que el ciclo de vida "queda auditado".
5. **Lockout de MFA solo client-side** — bypasseable; debe rehacerse server-side en el nuevo servicio de OTP, independientemente de que cambie TOTP por email/SMS.
6. **`twoFactorSecret` sin cifrar en Mongo** — inconsistente con el resto de campos sensibles del sistema; no aplica de cara adelante si se abandona TOTP, pero vale dejarlo señalado como antecedente de higiene de datos.
7. **Mezcla de campo legado `role` (singular) y `roles` (array)** en el modelo actual, con validaciones inconsistentes entre archivos (`admin.ts` vs `mfa.ts::adminResetMFA`) — a limpiar antes de tomarlo como base para el nuevo esquema de roles.
8. **`supervisorId` como string libre, no referencia tipada** — funciona hoy por bajo volumen de usuarios, pero no es el patrón a repetir en PostgreSQL/NestJS (debería ser FK real).
9. **SMS para el nuevo flujo OTP queda pendiente de definir con Negofin** — no hay proveedor elegido; email vía SendGrid sí está resuelto en principio por reutilización del proveedor ya integrado.
10. **No hay control de acceso centralizado (guard/middleware) por rol** — el middleware actual solo controla sesión + estado de MFA; la autorización por rol vive dispersa en cada Server Action. Confirma la necesidad, ya prevista en 3.8, de que la autorización se resuelva de forma consistente en cada servicio nuevo a partir de un contexto de identidad propagado desde el gateway, en vez de reimplementarse ad hoc como hoy.
