const fs = require('fs');
const path = require('path');

// Ruta del icono generado por la IA en la carpeta de la sesión de Gemini
const srcPath = "C:\\Users\\sergi\\.gemini\\antigravity-cli\\brain\\cdcda4ec-6449-43f8-a97a-4e97b9d32dc1\\crm_pwa_icon_1779473036029.png";
const publicDir = path.join(__dirname, 'public');
const oldFaviconPath = path.join(__dirname, 'src', 'app', 'favicon.ico');

const targets = [
  'favicon.png',
  'apple-touch-icon.png',
  'icon-192x192.png',
  'icon-512x512.png'
];

if (!fs.existsSync(srcPath)) {
  console.error("Error: No se encontró el archivo de origen: " + srcPath);
  process.exit(1);
}

// 1. Copiar los nuevos iconos PNG a public/
targets.forEach(target => {
  const destPath = path.join(publicDir, target);
  fs.copyFileSync(srcPath, destPath);
  console.log(`Copiado exitosamente: ${target}`);
});

// 2. Eliminar el favicon por defecto de Next.js si existe
if (fs.existsSync(oldFaviconPath)) {
  fs.unlinkSync(oldFaviconPath);
  console.log(`Eliminado el favicon por defecto antiguo en: src/app/favicon.ico`);
}

console.log("¡Iconos de la PWA distribuidos y favicon por defecto eliminado!");
