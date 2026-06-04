import { test, expect } from '@playwright/test'
import mongoose from 'mongoose'
import { generate } from 'otplib'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/testdb'

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGODB_URI)
  }
})

test.afterAll(async () => {
  await mongoose.disconnect()
})

// Variables compartidas entre tests en modo serial
let testEmail = ''
let testCompany = ''

test.beforeEach(async ({ page }) => {
  // Limpiar IndexedDB en el navegador para comenzar desde cero en cada prueba
  await page.goto('/auth/signin')
  await page.evaluate(async () => {
    // Cerrar la conexión activa de Dexie si existe
    if ((window as any).localDb) {
      try {
        await (window as any).localDb.close()
      } catch (e) {
        console.warn('Error al cerrar Dexie:', e)
      }
    }
    // Borrar la base de datos físicamente
    if (window.indexedDB) {
      const dbs = await window.indexedDB.databases()
      for (const db of dbs) {
        if (db.name) {
          await window.indexedDB.deleteDatabase(db.name)
        }
      }
    }
  })
  // Recargar la página para que la aplicación vuelva a instanciar la base de datos limpia
  await page.reload()
})

// Helper para iniciar sesión con MFA usando el secreto de MongoDB
async function loginWithMfa(page: any, email: string) {
  await page.goto('/auth/signin')
  // Esperar a que React complete la hidratación global
  await page.waitForFunction(() => (window as any).__hydrated === true, { timeout: 30000 })
  await page.getByPlaceholder('email@ejemplo.com').fill(email)
  await page.getByPlaceholder('••••••••').fill('Password123!')
  await page.getByRole('button', { name: 'Ingresar' }).click()

  // Esperar a ser redirigido a la verificación de MFA
  await page.waitForURL('**/auth/mfa')
  await expect(page.getByRole('heading', { name: 'Verificación de Seguridad' })).toBeVisible()

  // Buscar el secreto MFA del usuario en MongoDB
  const user = await mongoose.connection.db!.collection('users').findOne({ email: email.toLowerCase() })
  if (!user || !user.twoFactorSecret) {
    throw new Error(`No se encontró Two Factor Secret para el usuario ${email}`)
  }

  // Generar código OTP e ingresarlo
  const otpCode = await generate({ secret: user.twoFactorSecret })
  await page.locator('#code').fill(otpCode)
  await page.getByRole('button', { name: 'Verificar e Ingresar' }).click()

  // Esperar a navegar al dashboard principal
  await expect(page.getByRole('heading', { name: /¡Hola,/ })).toBeVisible({ timeout: 15000 })
}

test('Debe registrar un nuevo usuario y configurar MFA exitosamente', async ({ page }) => {
  // Limpiar la base de datos intermedia (MongoDB) antes de iniciar
  const collections = mongoose.connection.collections
  for (const key in collections) {
    await collections[key].deleteMany({})
  }

  testEmail = `test-sync-${Date.now()}@example.com`

  await page.goto('/auth/signin')
  // Esperar a que React complete la hidratación global
  await page.waitForFunction(() => (window as any).__hydrated === true, { timeout: 30000 })
  await expect(page.getByRole('heading', { name: 'Iniciar Sesión' })).toBeVisible()

  // Cambiar al formulario de registro
  await page.getByText('¿No tienes una cuenta? Regístrate gratis').click()
  await expect(page.getByRole('heading', { name: 'Crear Cuenta' })).toBeVisible()

  // Completar formulario de registro
  await page.getByPlaceholder('Juan Pérez').fill('Test User')
  await page.getByPlaceholder('email@ejemplo.com').fill(testEmail)
  await page.getByPlaceholder('••••••••').fill('Password123!')

  // Enviar formulario
  await page.getByRole('button', { name: 'Registrarse' }).click()

  // Esperar a navegar al setup de MFA
  await page.waitForURL('**/auth/mfa-setup')
  await expect(page.getByRole('heading', { name: 'Configurar Seguridad (MFA)' })).toBeVisible()

  // Obtener el secreto de 2FA del DOM
  const secret = (await page.locator('code').textContent())?.trim() || ''
  expect(secret).not.toBe('')

  // Generar código OTP
  const otpCode = await generate({ secret })
  await page.locator('#code').fill(otpCode)
  await page.getByRole('button', { name: 'Verificar y Activar' }).click()

  // Confirmar que se generaron los códigos de recuperación
  await expect(page.getByText('¡El doble factor ha sido activado correctamente!')).toBeVisible()

  // Finalizar e ingresar
  await page.getByRole('button', { name: 'Completar e Ingresar' }).click()

  // Esperar a navegar al dashboard principal
  await expect(page.getByRole('heading', { name: /¡Hola,/ })).toBeVisible({ timeout: 15000 })
})

test('Debe persistir localmente en modo Offline y sincronizar al volver Online', async ({ page, context }) => {
  // Login con MFA
  await loginWithMfa(page, testEmail)

  testCompany = `Acme Corp ${Date.now()}`

  // 1. Navegar a Empresas (Online para descargar el chunk de la página)
  await page.getByRole('link', { name: 'Empresas', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Nueva Empresa' })).toBeVisible()

  // 2. Simular Estado Offline y Crear una Empresa Offline
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Nueva Empresa' }).click()
  await expect(page.getByRole('heading', { name: 'Nueva Empresa' })).toBeVisible()

  await page.getByPlaceholder('Google Inc.').fill(testCompany)
  await page.getByPlaceholder('google.com').fill('acme.com')
  await page.getByRole('button', { name: 'Crear Empresa' }).click()

  // Verificar que la empresa aparezca en la UI con badge 'LocalDb'
  await expect(page.getByRole('cell', { name: testCompany })).toBeVisible()
  await expect(page.locator(`tr:has-text("${testCompany}")`).getByText('LocalDb')).toBeVisible()

  // 3. Volver Online temporalmente para navegar a Contactos
  await context.setOffline(false)
  await page.waitForTimeout(500)
  await page.getByRole('link', { name: 'Contactos', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Nuevo Contacto' })).toBeVisible()

  // 4. Simular Estado Offline y Crear un Lead Offline asociado a la empresa
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Nuevo Contacto' }).click()
  await expect(page.getByRole('heading', { name: 'Nuevo Contacto / Lead' })).toBeVisible()

  await page.getByPlaceholder('Juan', { exact: true }).fill('Jane')
  await page.getByPlaceholder('Pérez', { exact: true }).fill('Doe')
  await page.getByPlaceholder('juan.perez@email.com', { exact: true }).fill('jane.doe@example.com')
  await page.getByPlaceholder('+54 9 11 1234-5678', { exact: true }).fill('+541122334455')

  // Seleccionar la empresa que acabamos de crear (que está local)
  const optionText = await page.evaluate((companyName) => {
    const select = document.querySelector('form select') as HTMLSelectElement
    if (!select) return null
    const option = Array.from(select.options).find(opt => opt.text.includes(companyName))
    return option ? option.text : null
  }, testCompany)

  if (optionText) {
    await page.locator('form select').selectOption({ label: optionText })
  } else {
    throw new Error(`No se encontró la opción para la empresa ${testCompany} en el selector`)
  }
  await page.getByRole('button', { name: 'Crear Lead' }).click()

  // Verificar que aparezca el lead con badge 'LocalDb'
  await expect(page.getByRole('cell', { name: 'Jane Doe' })).toBeVisible()
  await expect(page.locator('tr:has-text("Jane Doe")').getByText('LocalDb')).toBeVisible()

  // 5. Restaurar Conexión (Volver Online)
  await context.setOffline(false)
  await page.waitForTimeout(1000) // Dar tiempo a la pila de red del navegador para restablecerse

  // Forzar un evento 'online' en la ventana para gatillar el hook useSync de inmediato
  await page.evaluate(() => {
    window.dispatchEvent(new Event('online'))
  })

  // 6. Verificar que el estado cambie a 'CloudDb' (Sincronizado con MongoDB/CRM)
  const syncBadge = page.locator('button:has-text("Error de Sincronización")')
  if (await syncBadge.isVisible()) {
    const errorMsg = await syncBadge.getAttribute('title')
    console.error('DEBUG - Mensaje de Error de Sincronización:', errorMsg)
  }
  await expect(page.getByText('CloudDb').first()).toBeVisible({ timeout: 20000 })

  // 7. Verificar persistencia física y metadatos de sincronización en MongoDB (con reintentos para dar tiempo al background sync)
  let dbCompany = null
  for (let i = 0; i < 10; i++) {
    dbCompany = await mongoose.connection.db!.collection('companies').findOne({ name: testCompany })
    if (dbCompany && dbCompany.crmSynced === true) {
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  expect(dbCompany).not.toBeNull()
  expect(dbCompany?.crmSynced).toBe(true)
  expect(dbCompany?.crmId).toBeDefined()

  let dbLead = null
  for (let i = 0; i < 10; i++) {
    dbLead = await mongoose.connection.db!.collection('leads').findOne({ email: 'jane.doe@example.com' })
    if (dbLead && dbLead.crmSynced === true) {
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  expect(dbLead).not.toBeNull()
  expect(dbLead?.crmSynced).toBe(true)
  expect(dbLead?.crmId).toBeDefined()
})

test('Debe gestionar el ciclo de vida de un recordatorio (Crear, Marcar Leído y Quitar Alarma)', async ({ page }) => {
  // Login con MFA
  await loginWithMfa(page, testEmail)

  // 1. Navegar a contactos y abrir Jane Doe
  await page.getByRole('link', { name: 'Contactos', exact: true }).click()
  await page.getByRole('cell', { name: 'Jane Doe' }).click()

  // 2. Rellenar formulario de actividades (Nota con recordatorio)
  await page.getByPlaceholder('Ej. Llamada de seguimiento').fill('Recordatorio Test Playwright')
  await page.getByPlaceholder('Escribe el resumen o notas de la actividad...').fill('Este es un cuerpo de prueba para el test automatizado')
  await page.locator('#enable-reminder').check()
  await page.getByRole('button', { name: 'Registrar Actividad' }).click()

  // 3. Confirmar aparición en el timeline
  await expect(page.getByText('Recordatorio: Recordatorio Test Playwright')).toBeVisible()
  await expect(page.getByText('Este es un cuerpo de prueba para el test automatizado').first()).toBeVisible()

  // 4. Marcar como leído
  await page.getByRole('button', { name: 'Marcar Leído' }).first().click()
  await expect(page.getByText('Leído')).toBeVisible()

  // 5. Quitar Alarma
  page.once('dialog', async dialog => {
    await dialog.accept()
  })
  await page.getByRole('button', { name: 'Quitar Alarma' }).first().click()
  
  // Confirmar que ya no se ve la sección de alarma (pero la nota sigue visible)
  await expect(page.getByText('Quitar Alarma')).not.toBeVisible()
  await expect(page.getByText('Recordatorio Test Playwright')).toBeVisible()
})

test('Debe registrar una nota general sin recordatorio', async ({ page }) => {
  // Login con MFA
  await loginWithMfa(page, testEmail)

  // 1. Navegar a contactos y abrir Jane Doe
  await page.getByRole('link', { name: 'Contactos', exact: true }).click()
  await page.getByRole('cell', { name: 'Jane Doe' }).click()

  // 2. Rellenar formulario de actividades (Nota general)
  await page.locator('form:has-text("Registrar Actividad") select').selectOption({ value: 'NOTE' })
  await page.getByPlaceholder('Ej. Llamada de seguimiento').fill('Nota General Test Playwright')
  await page.getByPlaceholder('Escribe el resumen o notas de la actividad...').fill('Cuerpo de la nota general de prueba sin recordatorio')
  await page.getByRole('button', { name: 'Registrar Actividad' }).click()

  // 3. Confirmar aparición en el timeline
  await expect(page.getByText('Nota General Test Playwright')).toBeVisible()
  await expect(page.getByText('Cuerpo de la nota general de prueba sin recordatorio')).toBeVisible()
})

test('Debe registrar una nota de llamada sin recordatorio', async ({ page }) => {
  // Login con MFA
  await loginWithMfa(page, testEmail)

  // 1. Navegar a contactos y abrir Jane Doe
  await page.getByRole('link', { name: 'Contactos', exact: true }).click()
  await page.getByRole('cell', { name: 'Jane Doe' }).click()

  // 2. Rellenar formulario de actividades (Llamada)
  await page.locator('form:has-text("Registrar Actividad") select').selectOption({ value: 'CALL' })
  await page.getByPlaceholder('Ej. Llamada de seguimiento').fill('Llamada de Seguimiento Test Playwright')
  await page.getByPlaceholder('Escribe el resumen o notas de la actividad...').fill('Se conversó sobre el plan de pagos del microcrédito')
  await page.getByRole('button', { name: 'Registrar Actividad' }).click()

  // 3. Confirmar aparición en el timeline
  await expect(page.getByText('Llamada de Seguimiento Test Playwright')).toBeVisible()
  await expect(page.getByText('Se conversó sobre el plan de pagos del microcrédito')).toBeVisible()
})

test('Debe registrar una nota de correo electrónico sin recordatorio', async ({ page }) => {
  // Login con MFA
  await loginWithMfa(page, testEmail)

  // 1. Navegar a contactos y abrir Jane Doe
  await page.getByRole('link', { name: 'Contactos', exact: true }).click()
  await page.getByRole('cell', { name: 'Jane Doe' }).click()

  // 2. Rellenar formulario de actividades (Email)
  await page.locator('form:has-text("Registrar Actividad") select').selectOption({ value: 'EMAIL' })
  await page.getByPlaceholder('Ej. Llamada de seguimiento').fill('Correo de Cotización Test Playwright')
  await page.getByPlaceholder('Escribe el resumen o notas de la actividad...').fill('Se envió la propuesta de tasa de interés por correo')
  await page.getByRole('button', { name: 'Registrar Actividad' }).click()

  // 3. Confirmar aparición en el timeline
  await expect(page.getByText('Correo de Cotización Test Playwright')).toBeVisible()
  await expect(page.getByText('Se envió la propuesta de tasa de interés por correo')).toBeVisible()
})

test('Debe registrar una nueva solicitud de préstamo en la pestaña Préstamos', async ({ page }) => {

  // Login con MFA
  await loginWithMfa(page, testEmail)

  // 1. Navegar a contactos y abrir Jane Doe
  await page.getByRole('link', { name: 'Contactos', exact: true }).click()
  await page.getByRole('cell', { name: 'Jane Doe' }).click()

  // 2. Cambiar a la pestaña de préstamos
  await page.getByRole('button', { name: 'Préstamos' }).click()

  // 3. Completar formulario de préstamo
  await page.getByPlaceholder('Ej. 5000').fill('15000')
  await page.locator('form:has-text("Nueva Solicitud de Préstamo") select').selectOption({ value: '24' }) // 24 meses
  await page.getByPlaceholder('Ej. 15').fill('12.5')
  await page.getByPlaceholder('Escribe comentarios u observaciones del préstamo...').fill('Justificación de préstamo para el test de Playwright')

  // Enviar solicitud
  await page.getByRole('button', { name: 'Enviar Solicitud' }).click()

  // 4. Confirmar que aparece en la lista de préstamos activos con estado Borrador
  await expect(page.getByText('$15,000 USD')).toBeVisible()
  await expect(page.getByText('Plazo: 24 meses | Tasa: 12.5%')).toBeVisible()
  await expect(page.getByText('Justificación de préstamo para el test de Playwright')).toBeVisible()
})
