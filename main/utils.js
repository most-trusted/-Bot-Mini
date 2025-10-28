import fs from 'fs';
import path from 'path';
import logger from './logger.js';

const AUTH_PATH = path.join(process.cwd(), 'main', 'auth', 'creds.json');
const log = logger;

// Save only creds object to disk (simple)
export function saveAuth(creds) {
  try {
    fs.mkdirSync(path.dirname(AUTH_PATH), { recursive: true });
    fs.writeFileSync(AUTH_PATH, JSON.stringify(creds, null, 2), 'utf8');
  } catch (e) {
    log.error('saveAuth error', e);
    throw e;
  }
}

// Load saved creds if present
export function loadSavedAuth() {
  try {
    if (!fs.existsSync(AUTH_PATH)) return null;
    const raw = fs.readFileSync(AUTH_PATH, 'utf8');
    const creds = JSON.parse(raw);
    // keys will be in-memory cacheable store; return creds only
    return { creds, keys: undefined };
  } catch (e) {
    log.error('loadSavedAuth error', e);
    return null;
  }
}

// presence typing helper
export async function setPresenceTyping(sock, jid, on = true) {
  try {
    // v7 uses presence updates — sending "composing" or "available"
    await sockPresence(sock, jid, on ? 'composing' : 'available');
  } catch (e) {
    log.warn('setPresenceTyping failed', e);
  }
}

// helper to send presence-type if supported
async function sockPresence(sock, jid, what) {
  // method names may vary across versions; try sendPresenceUpdate or updatePresence
  if (typeof sock.sendPresenceUpdate === 'function') {
    await sock.sendPresenceUpdate(what, jid);
  } else if (typeof sock.presenceSubscribe === 'function') {
    // fallback: try sending presence via presenceSubscribe (best-effort)
    try { await sock.presenceSubscribe(jid); } catch {}

}
}
