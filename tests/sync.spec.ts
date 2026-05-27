import { test, expect } from '@playwright/test'
import mongoose from 'mongoose'

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

test.beforeEach(async ({ page }) => {
  // Limpiar IndexedDB en el navegador para comenzar desde cero en cada prueba
  await page.goto('/auth/signin')
  await page.evaluate(async () => {
    if (window.indexedDB) {
      const dbs = await window.indexedDB.databases()
      for (const db of dbs) {
        if (db.name) {
          window.indexedDB.deleteDatabase(db.name)
        }
      }
    }
  })
})

test('Debe registrar un nuevo usuario exitosamente', async ({ page }) => {
  // Limpiar la base de datos intermedia (MongoDB) antes de iniciar
  const collections = mongoose.connection.collections
  for (const key in collections) {
    await collections[key].deleteMany({})
  }

  testEmail = `test-sync-${Date.now()}@example.com`

  await page.goto('/auth/signin')
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

  // Esperar a navegar al dashboard principal
  await expect(page.getByRole('heading', { name: 'Panel de Control' })).toBeVisible({ timeout: 30000 })
})

test('Debe persistir localmente en modo Offline y sincronizar al volver Online', async ({ page, context }) => {
  // Reutilizar login con el usuario creado en el test anterior
  await page.goto('/auth/signin')
  await page.getByPlaceholder('email@ejemplo.com').fill(testEmail)
  await page.getByPlaceholder('••••••••').fill('Password123!')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page.getByRole('heading', { name: 'Panel de Control' })).toBeVisible()

  // 1. Simular Estado Offline
  await context.setOffline(true)

  // 2. Crear una Empresa Offline
  await page.getByRole('button', { name: 'Empresa', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Nueva Empresa' })).toBeVisible()

  await page.getByPlaceholder('Google Inc.').fill('Acme Corp')
  await page.getByPlaceholder('google.com').fill('acme.com')
  await page.getByRole('button', { name: 'Crear Empresa' }).click()

  // Verificar que la empresa aparezca en la UI con badge 'LocalDb'
  await page.getByRole('button', { name: 'Empresas' }).click()
  await expect(page.getByText('Acme Corp')).toBeVisible()
  await expect(page.getByText('LocalDb').first()).toBeVisible()

  // 3. Crear un Lead Offline asociado a la empresa
  await page.getByRole('button', { name: 'Contacto', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Nuevo Contacto / Lead' })).toBeVisible()

  await page.getByPlaceholder('Juan', { exact: true }).fill('Jane')
  await page.getByPlaceholder('Pérez', { exact: true }).fill('Doe')
  await page.getByPlaceholder('juan.perez@email.com', { exact: true }).fill('jane.doe@example.com')
  await page.getByPlaceholder('+54 9 11 1234-5678', { exact: true }).fill('+541122334455')
  
  // Seleccionar la empresa que acabamos de crear (que está local)
  await page.locator('select').selectOption({ label: 'Acme Corp (Local)' })
  await page.getByRole('button', { name: 'Crear Lead' }).click()

  // Cambiar a la tab de Leads y verificar que aparezca el lead con badge 'LocalDb'
  await page.getByRole('button', { name: 'Leads / Contactos' }).click()
  await expect(page.getByText('Jane Doe')).toBeVisible()
  await expect(page.getByText('LocalDb').first()).toBeVisible()

  // 4. Restaurar Conexión (Volver Online)
  await context.setOffline(false)
  await page.waitForTimeout(1000) // Dar tiempo a la pila de red del navegador para restablecerse

  // Forzar un evento 'online' en la ventana para gatillar el hook useSync de inmediato
  await page.evaluate(() => {
    window.dispatchEvent(new Event('online'))
  })

  // 5. Verificar que el estado cambie a 'CloudDb' (Sincronizado con MongoDB/CRM)
  const syncBadge = page.locator('button:has-text("Error de Sincronización")')
  if (await syncBadge.isVisible()) {
    const errorMsg = await syncBadge.getAttribute('title')
    console.error('DEBUG - Mensaje de Error de Sincronización:', errorMsg)
  }
  await expect(page.getByText('CloudDb').first()).toBeVisible({ timeout: 20000 })

  // 6. Verificar persistencia física y metadatos de sincronización en MongoDB (con reintentos para dar tiempo al background sync)
  let dbCompany = null
  for (let i = 0; i < 10; i++) {
    dbCompany = await mongoose.connection.db.collection('companies').findOne({ name: 'Acme Corp' })
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
    dbLead = await mongoose.connection.db.collection('leads').findOne({ email: 'jane.doe@example.com' })
    if (dbLead && dbLead.crmSynced === true) {
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  expect(dbLead).not.toBeNull()
  expect(dbLead?.crmSynced).toBe(true)
  expect(dbLead?.crmId).toBeDefined()
})
