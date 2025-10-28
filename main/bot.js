
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import Pino from 'pino';
import {
  makeWASocket,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';
import logger from './logger.js';
import { handleMessage } from './handlers.js';
import { loadSavedAuth, saveAuth } from './utils.js';

const AUTH_DIR = path.join(process.cwd(), 'main', 'auth');
if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

const log = logger;

async function startBot() {
  log.info('Starting bot...');

  // fetch WA version (optional)
  let waVersion;
  try {
    const res = await fetchLatestBaileysVersion();
    waVersion = res.version;
    log.info({ waVersion }, 'fetched WA version');
  } catch (e) {
    log.warn('could not fetch WA version, proceeding with default');
  }

  // Load auth from .env if provided, else try disk, else fresh session
  const envSession = process.env.SESSION_ID;
  let auth;
  if (envSession && envSession.trim()) {
    log.info('Loading session from .env (SESSION_ID)');
    try {
      const creds = JSON.parse(Buffer.from(envSession, 'base64').toString());
      const keyStore = makeCacheableSignalKeyStore({});
      auth = { creds, keys: keyStore };
    } catch (e) {
      log.error('Failed to parse SESSION_ID - falling back to disk QR method', e);
    }
  }

  if (!auth) {
    // try to load saved auth from disk
    const saved = loadSavedAuth();
    if (saved) {
      log.info('Loaded saved auth from disk');
      auth = saved;
    } else {
      // start fresh (no creds) and let Baileys create creds which we'll save via events
      log.info('No saved session found — starting with fresh auth (scan QR)');
      auth = { creds: undefined, keys: makeCacheableSignalKeyStore({}) };
    }
  }

  const sock = makeWASocket({
    auth,
    version: waVersion,
    printQRInTerminal: !process.env.SESSION_ID,
    logger: log
  });

  // save creds when updated
  sock.ev.on('creds.update', async (creds) => {
    try {
      saveAuth(creds);
      log.info('Saved credentials to disk');
    } catch (e) {
      log.error('Failed to save credentials', e);
    }
  });

  sock.ev.on('connection.update', (update) => {
    log.info({ update }, 'connection.update');
    const conn = update.connection;
    if (conn === 'close') {
      log.warn('connection closed — restarting bot...');
      setTimeout(() => startBot(), 2000);
    } else if (conn === 'open') {
      log.info('Connection open — bot ready');
    }
  });

  // messages
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    for (const msg of messages) {
      if (!msg.message || msg.key.remoteJid === 'status@broadcast') continue;
      if (msg.key.fromMe) continue;
      try {
        await handleMessage(sock, msg);
      } catch (err) {
        log.error('handleMessage error', err);
      }
    }
  });

  // expose sock on utils (optional)
  return sock;
}

// start
startBot().catch(err => {
  console.error('Fatal', err);
  proces
  s.exit(1);
});
