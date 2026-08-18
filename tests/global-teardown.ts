// Ya no hay swap de .env.local que restaurar: la config de test se inyecta
// directamente en el `env` del proceso hijo del webServer (ver playwright.config.ts),
// sin tocar nunca ningún archivo compartido con un `npm run dev` real.
async function globalTeardown() {}

export default globalTeardown
