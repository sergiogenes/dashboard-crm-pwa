const fs = require('fs')
const path = require('path')

const envLocalPath = path.resolve(process.cwd(), '.env.local')
const envLocalTmpPath = path.resolve(process.cwd(), '.env.local.tmp')
const envTestPath = path.resolve(process.cwd(), '.env.test')

// Solo hacer el backup si no existe un backup previo para evitar sobreescribir tus datos de desarrollo
if (fs.existsSync(envLocalPath) && !fs.existsSync(envLocalTmpPath)) {
  console.log('\n--- [Pre-Test Env] Ocultando temporalmente .env.local ---')
  fs.renameSync(envLocalPath, envLocalTmpPath)
}

if (fs.existsSync(envTestPath)) {
  console.log('--- [Pre-Test Env] Copiando .env.test a .env.local temporal ---')
  fs.copyFileSync(envTestPath, envLocalPath)
}
