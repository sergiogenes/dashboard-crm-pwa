import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'
import path from 'path'

// Cargar variables de entorno específicas de testing
dotenv.config({ path: path.resolve(process.cwd(), '.env.test') })
process.env.IS_PLAYWRIGHT_TEST = 'true'

export default defineConfig({
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
    baseURL: 'http://localhost:3000',
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
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      MONGODB_URI:
        process.env.MONGODB_URI || 'mongodb://localhost:27017/testdb',
      CRM_PROVIDER: 'mock',
      NEXTAUTH_SECRET: 'secreto_criptografico_seguro_para_pruebas_locales',
      NEXTAUTH_URL: 'http://localhost:3000',
      NODE_ENV: 'test',
      IS_PLAYWRIGHT_TEST: 'true',
    },
  },
})
