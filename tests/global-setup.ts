import fs from 'fs'
import path from 'path'

async function globalSetup() {
  console.log('\n--- [Playwright Debug] Variables de Entorno del Sistema antes del Setup: ---')
  console.log('NEXTAUTH_URL original:', process.env.NEXTAUTH_URL)
  console.log('CRM_PROVIDER original:', process.env.CRM_PROVIDER)

  // Forzar valores correctos para el entorno de pruebas
  process.env.NEXTAUTH_URL = 'http://localhost:3001'
  process.env.CRM_PROVIDER = 'mock'
  console.log('--- [Playwright Debug] Forzando NEXTAUTH_URL a http://localhost:3001 ---')


}

export default globalSetup
