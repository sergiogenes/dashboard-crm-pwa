import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

// Parseamos .env.test directamente (sin tocar process.env ni ningún archivo
// compartido como .env.local) y le pasamos el resultado únicamente al `env`
// del proceso hijo del webServer más abajo. Antes esto se hacía copiando
// .env.test ENCIMA de .env.local (ver tests/pre-test-env.js, ya en desuso):
// ese archivo es compartido con cualquier `npm run dev` corriendo en paralelo,
// que en modo desarrollo recarga en caliente sus variables al detectar el
// cambio — filtrando config de test (o, peor, dejando temporalmente al
// servidor real sin la config esperada) hacia un proceso conectado a datos
// reales. Ese fue justamente el vector que llevó a que se borraran deals
// reales de HubSpot durante una corrida de tests.
const testEnvPath = path.resolve(process.cwd(), '.env.test')
const parsedTestEnv = fs.existsSync(testEnvPath)
  ? dotenv.parse(fs.readFileSync(testEnvPath))
  : {}

export default defineConfig({
  globalSetup: require.resolve('./tests/global-setup'),
  globalTeardown: require.resolve('./tests/global-teardown'),
  testDir: './tests',
  /* Límite de tiempo por test (60 segundos por latencia de red y compilación) */
  timeout: 60 * 1000,
  /* Ejecución secuencial para evitar colisiones en la DB de pruebas */
  fullyParallel: false,
  /* Cancelar ejecución en CI si se queda colgado algún test */
  forbidOnly: !!process.env.CI,
  /* Reintentos en CI */
  retries: process.env.CI ? 2 : 0,
  /* Un solo worker por la DB compartida localmente */
  workers: 1,
  /* Reportero para visualización de resultados */
  reporter: 'html',
  /* Configuración global del navegador */
  use: {
    baseURL: 'http://localhost:3001',
    /* Traza al fallar el primer intento */
    trace: 'on-first-retry',
    /* Captura de pantalla en caso de error */
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Configuración del servidor web de desarrollo antes de ejecutar tests */
  webServer: {
    // Ya no pasa por tests/pre-test-env.js (que copiaba .env.test encima del
    // .env.local compartido). El proceso hijo recibe su config de test
    // exclusivamente vía `env` de abajo, sin tocar ningún archivo en disco.
    command: 'npx next dev -p 3001',
    url: 'http://localhost:3001',
    reuseExistingServer: false,
    timeout: 120 * 1000,
    env: {
      // .env.test tiene precedencia; los `process.env.*` de acá son solo
      // fallback si faltara la variable en el archivo.
      ...parsedTestEnv,
      MONGODB_URI:
        parsedTestEnv.MONGODB_URI ||
        process.env.MONGODB_URI ||
        'mongodb://127.0.0.1:27017/dashboard-pwa-test',
      CRM_PROVIDER: 'mock',
      NEXTAUTH_SECRET:
        parsedTestEnv.NEXTAUTH_SECRET ||
        process.env.NEXTAUTH_SECRET ||
        'wFEBL8fzJO0ZyAFMUS+ChOBbZ8yXkmk4bXxoz93dDrU=',
      NEXTAUTH_URL: 'http://localhost:3001',
      NODE_ENV: 'test',
      IS_PLAYWRIGHT_TEST: 'true',
    },
  },
})
