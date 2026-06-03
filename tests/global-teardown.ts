import fs from 'fs'
import path from 'path'

async function globalTeardown() {
  const envLocalPath = path.resolve(process.cwd(), '.env.local')
  const envLocalTmpPath = path.resolve(process.cwd(), '.env.local.tmp')

  console.log('\n--- [Playwright Teardown] Limpiando archivos temporales ---')
  if (fs.existsSync(envLocalPath)) {
    fs.unlinkSync(envLocalPath)
  }

  if (fs.existsSync(envLocalTmpPath)) {
    console.log('--- [Playwright Teardown] Restaurando .env.local de desarrollo ---')
    fs.renameSync(envLocalTmpPath, envLocalPath)
  }
}

export default globalTeardown
