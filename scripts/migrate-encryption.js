const dotenv = require('dotenv');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');

// Cargar variables de entorno locales
dotenv.config({ path: path.resolve(process.cwd(), '.env.development.local') });

const ALGORITHM = 'aes-256-cbc';
const SECRET_KEY_HASH = crypto.createHash('sha256')
  .update(process.env.SERVER_ENCRYPTION_SECRET || 'default-server-encryption-secret-32bytes-long-2026')
  .digest();

function encrypt(text) {
  if (!text) return text;
  if (text.includes(':') && text.split(':')[0].length === 32) return text; // Ya cifrado
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY_HASH, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function hash(text) {
  if (!text) return '';
  return crypto.createHash('sha256').update(text.trim().toLowerCase()).digest('hex');
}

async function migrate() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('Error: MONGODB_URI no está definida en las variables de entorno.');
    process.exit(1);
  }

  console.log('Conectando a MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Conectado exitosamente.');

  // Definir Schemas locales (sin getters/setters para leer datos en bruto)
  const User = mongoose.model('User', new mongoose.Schema({
    email: String,
    dbEncryptionKey: String,
  }, { collection: 'users' }));

  const Lead = mongoose.model('Lead', new mongoose.Schema({
    firstName: String,
    lastName: String,
    email: String,
    phone: String,
    documentId: String,
    emailHash: String,
    documentIdHash: String,
  }, { collection: 'leads' }));

  const Activity = mongoose.model('Activity', new mongoose.Schema({
    title: String,
    body: String,
  }, { collection: 'activities' }));

  // 1. Migrar Usuarios (Generar dbEncryptionKey si falta)
  console.log('\n--- Migrando Usuarios ---');
  const users = await User.find({});
  console.log(`Encontrados ${users.length} usuarios.`);
  for (const user of users) {
    if (!user.dbEncryptionKey) {
      const rawLocalKey = crypto.randomBytes(32).toString('hex');
      user.dbEncryptionKey = encrypt(rawLocalKey);
      await user.save();
      console.log(`Clave dbEncryptionKey generada para el usuario: ${user.email}`);
    } else {
      console.log(`Usuario ${user.email} ya posee dbEncryptionKey.`);
    }
  }

  // 2. Migrar Leads (Cifrar campos y generar hashes)
  console.log('\n--- Migrando Leads ---');
  const leads = await Lead.find({});
  console.log(`Encontrados ${leads.length} leads.`);
  for (const lead of leads) {
    let updated = false;

    // Verificar si ya están cifrados comprobando el formato "iv:encrypted"
    const isEncrypted = (str) => str && str.includes(':') && str.split(':')[0].length === 32;

    if (lead.email && !isEncrypted(lead.email)) {
      lead.emailHash = hash(lead.email);
      lead.email = encrypt(lead.email);
      updated = true;
    }
    if (lead.firstName && !isEncrypted(lead.firstName)) {
      lead.firstName = encrypt(lead.firstName);
      updated = true;
    }
    if (lead.lastName && !isEncrypted(lead.lastName)) {
      lead.lastName = encrypt(lead.lastName);
      updated = true;
    }
    if (lead.phone && !isEncrypted(lead.phone)) {
      lead.phone = encrypt(lead.phone);
      updated = true;
    }
    if (lead.documentId && !isEncrypted(lead.documentId)) {
      lead.documentIdHash = hash(lead.documentId);
      lead.documentId = encrypt(lead.documentId);
      updated = true;
    }

    if (updated) {
      await lead.save();
      console.log(`Lead ID ${lead._id} migrado correctamente.`);
    } else {
      console.log(`Lead ID ${lead._id} ya estaba cifrado.`);
    }
  }

  // 3. Migrar Actividades (Cifrar título y cuerpo)
  console.log('\n--- Migrando Actividades ---');
  const activities = await Activity.find({});
  console.log(`Encontrados ${activities.length} actividades.`);
  for (const act of activities) {
    let updated = false;
    const isEncrypted = (str) => str && str.includes(':') && str.split(':')[0].length === 32;

    if (act.title && !isEncrypted(act.title)) {
      act.title = encrypt(act.title);
      updated = true;
    }
    if (act.body && !isEncrypted(act.body)) {
      act.body = encrypt(act.body);
      updated = true;
    }

    if (updated) {
      await act.save();
      console.log(`Actividad ID ${act._id} migrado correctamente.`);
    } else {
      console.log(`Actividad ID ${act._id} ya estaba cifrada.`);
    }
  }

  console.log('\n¡Migración completada con éxito!');
  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('Error en la migración:', err);
  mongoose.disconnect();
});
