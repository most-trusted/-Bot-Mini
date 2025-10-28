// main/utils.js
import fs from 'fs'
import pino from 'pino'

export const logger = pino({
  transport: { target: 'pino-pretty', options: { colorize: true } }
})

// Simulate typing presence
export async function setPresenceTyping(sock, jid, enabled = true) {
  try {
    await sock.sendPresenceUpdate(enabled ? 'composing' : 'paused', jid)
  } catch (e) {
    logger.error('Failed to set typing presence: ', e)
  }
}

// Ensure default feature flags exist
export function ensureDefaultFlags(config) {
  return {
    autotyping: config?.autotyping ?? true,
    alwaysOnline: config?.alwaysOnline ?? true,
    autoView: config?.autoView ?? true
  }
}

// Save JSON file safely
export function saveJSON(path, data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2))
}

// Load JSON file safely
export function loadJSON(path, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(path))
  } catch {
    return fallback
  }
}
