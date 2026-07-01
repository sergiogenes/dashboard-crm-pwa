const bufToHex = (buffer: ArrayBuffer): string =>
  Array.prototype.map.call(new Uint8Array(buffer), (x: number) => ('00' + x.toString(16)).slice(-2)).join('')

const hexToBuf = (hexString: string): Uint8Array => {
  const matches = hexString.match(/.{1,2}/g)
  if (!matches) return new Uint8Array(0)
  return new Uint8Array(matches.map((byte) => parseInt(byte, 16)))
}

async function importKey(keyHex: string): Promise<CryptoKey> {
  const rawKey = hexToBuf(keyHex)
  return await window.crypto.subtle.importKey(
    'raw',
    rawKey as BufferSource,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptLocal(text: string, keyHex: string): Promise<string> {
  if (!text || !keyHex) return text
  // Evitar doble cifrado si ya contiene el prefijo de IV de 12 bytes (24 caracteres hex)
  if (text.includes(':') && text.split(':')[0].length === 24) return text

  try {
    const key = await importKey(keyHex)
    const iv = window.crypto.getRandomValues(new Uint8Array(12))
    const encoded = new TextEncoder().encode(text)
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      encoded as BufferSource
    )
    const ivHex = bufToHex(iv.buffer)
    const encryptedHex = bufToHex(encrypted)
    return `${ivHex}:${encryptedHex}`
  } catch (error) {
    console.error('[ClientCrypto] Encryption failed:', error)
    return text
  }
}

export async function decryptLocal(ciphertext: string, keyHex: string): Promise<string> {
  if (!ciphertext || !keyHex) return ciphertext
  try {
    const parts = ciphertext.split(':')
    if (parts.length !== 2 || parts[0].length !== 24) return ciphertext

    const iv = hexToBuf(parts[0])
    const encryptedText = hexToBuf(parts[1])
    const key = await importKey(keyHex)
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      encryptedText as BufferSource
    )
    return new TextDecoder().decode(decrypted)
  } catch (error) {
    console.error('[ClientCrypto] Decryption failed:', error)
    return ciphertext
  }
}

import { LocalLead, LocalActivity } from './db'

export async function decryptLead(lead: LocalLead, dbKey?: string): Promise<LocalLead> {
  if (!dbKey) return lead
  return {
    ...lead,
    firstName: await decryptLocal(lead.firstName, dbKey),
    lastName: await decryptLocal(lead.lastName, dbKey),
    email: await decryptLocal(lead.email, dbKey),
    phone: lead.phone ? await decryptLocal(lead.phone, dbKey) : undefined,
    documentId: lead.documentId ? await decryptLocal(lead.documentId, dbKey) : undefined,
  }
}

export async function encryptLead(lead: LocalLead, dbKey?: string): Promise<LocalLead> {
  if (!dbKey) return lead
  return {
    ...lead,
    firstName: await encryptLocal(lead.firstName, dbKey),
    lastName: await encryptLocal(lead.lastName, dbKey),
    email: await encryptLocal(lead.email, dbKey),
    phone: lead.phone ? await encryptLocal(lead.phone, dbKey) : undefined,
    documentId: lead.documentId ? await encryptLocal(lead.documentId, dbKey) : undefined,
  }
}

export async function decryptActivity(act: LocalActivity, dbKey?: string): Promise<LocalActivity> {
  if (!dbKey) return act
  return {
    ...act,
    title: await decryptLocal(act.title, dbKey),
    body: await decryptLocal(act.body, dbKey),
  }
}

export async function encryptActivity(act: LocalActivity, dbKey?: string): Promise<LocalActivity> {
  if (!dbKey) return act
  return {
    ...act,
    title: await encryptLocal(act.title, dbKey),
    body: await encryptLocal(act.body, dbKey),
  }
}

