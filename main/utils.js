// main/utils.js
import fs from 'fs'
import path from 'path'
import pino from 'pino'

export const logger = pino({
  transport: { target: 'pino-pretty', options: { colorize: true } }
})

// === PRESENCE CONTROL ===
export async function setPresenceTyping(sock, jid, enabled = true) {
  try {
    await sock.sendPresenceUpdate(enabled ? 'composing' : 'paused', jid)
  } catch (e) {
    logger.error('Failed to set typing presence:', e)
  }
}

// === FEATURE FLAGS ===
export function ensureDefaultFlags(config) {
  return {
    autotyping: config?.autotyping ?? true,
    alwaysOnline: config?.alwaysOnline ?? true,
    autoView: config?.autoView ?? true
  }
}

// === FILE HELPERS ===
export function saveJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
}

export function loadJSON(filePath, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath))
  } catch {
    return fallback
  }
}

// === AUTH HANDLERS ===
const AUTH_DIR = path.join(process.cwd(), 'main', 'auth')

export function loadSavedAuth() {
  const credsPath = path.join(AUTH_DIR, 'creds.json')
  const keysPath = path.join(AUTH_DIR, 'keys.json')

  if (fs.existsSync(credsPath) && fs.existsSync(keysPath)) {
    const creds = JSON.parse(fs.readFileSync(credsPath))
    const keys = JSON.parse(fs.readFileSync(keysPath))
    return { creds, keys }
  }
  return null
}

export function saveAuth(creds, keys) {
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true })
  fs.writeFileSync(path.join(AUTH_DIR, 'creds.json'), JSON.stringify(creds, null, 2))
  fs.writeFileSync(path.join(AUTH_DIR, 'keys.json'), JSON.stringify(keys, null, 2))
}
