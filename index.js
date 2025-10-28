
import express from 'express';
import { makeWASocket, DisconnectReason, useSingleFileAuthState, fetchLatestBaileysVersion, makeInMemoryStore } from '@whiskeysockets/baileys';
import qrcode from 'qrcode';
import fs from 'fs-extra';
import path from 'path';
import bodyParser from 'body-parser';

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const SESSIONS_DIR = path.join(process.cwd(), 'sessions');
fs.ensureDirSync(SESSIONS_DIR);

app.use(express.static('public'));

// Utility to persist session files
const saveSession = async (sessionId, state) => {
  const file = path.join(SESSIONS_DIR, `${sessionId}.json`);
  await fs.writeJson(file, state, { spaces: 2 });
};

const loadSessionIfExists = (sessionId) => {
  const file = path.join(SESSIONS_DIR, `${sessionId}.json`);
  if (fs.existsSync(file)) return fs.readJsonSync(file);
  return null;
};

// Active bot instances map: sessionId -> { sock }
const activeBots = new Map();

// Create and start a bot instance from an auth state (in-file state)
async function startBot(sessionId, authState) {
  if (activeBots.has(sessionId)) return activeBots.get(sessionId);

  // create store (optional)
  const store = makeInMemoryStore({});

  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 2326, 10] }));

  const sock = makeWASocket({
    version,
    printQRInTerminal: false,
    auth: authState,
  });

  // basic event listeners
  sock.ev.on('messages.upsert', async (m) => {
    // simple command handler: !song <youtube-url>
    try {
      const message = m.messages && m.messages[0];
      if (!message || !message.message) return;
      const key = message.key;
      const text = (message.message.conversation || message.message.extendedTextMessage?.text || '').trim();
      if (!text) return;
      if (text.startsWith('!ping')) {
        await sock.sendMessage(key.remoteJid, { text: 'Pong!' }, { quoted: message });
      }
      if (text.startsWith('!song ')) {
        const url = text.split(' ')[1];
        await sock.sendMessage(key.remoteJid, { text: `Downloading song from: ${url}\n(placeholder — implement downloader in your repo)` }, { quoted: message });
      }
    } catch (e) {
      console.error('message handler error', e);
    }
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'open') {
      console.log(`${sessionId} connected`);
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.message;
      console.log(`${sessionId} disconnected`, code);
      activeBots.delete(sessionId);
    }
  });

  // persist credentials periodically
  sock.ev.on('creds.update', async () => {
    try {
      await saveSession(sessionId, sock.authState);
    } catch (e) { console.error('saveSession error', e); }
  });

  activeBots.set(sessionId, { sock, store });
  return { sock, store };
}

// Endpoint: generate a pairing code for a temporary session
app.get('/code', async (req, res) => {
  try {
    const number = req.query.number || 'unknown';
    const sessionId = `session-${Date.now()}`;

    // Use single-file temporary auth state in memory
    const authState = useSingleFileAuthState ? null : null; // placeholder — we'll use in-memory with save/load

    // Create a temporary socket to generate QR / pairing
    const sock = makeWASocket({ printQRInTerminal: false, auth: undefined });

    let returned = false;

    const onUpdate = async (update) => {
      // some baileys builds return a .qr or .connection.update with qr string
      try {
        if (update.qr) {
          const qr = update.qr;
          // We return URL-safe code (the raw QR string) plus a base64 image
          const imgData = await qrcode.toDataURL(qr);
          if (!returned) {
            returned = true;
            res.json({ ok: true, sessionId, code: qr, qrcodeDataUrl: imgData, hint: 'Copy this code and use it in your WhatsApp phone to pair' });
            // close the temporary socket
            sock.ev.removeListener('connection.update', onUpdate);
            try { sock.end(); } catch (e) { /* ignore */ }
          }
        }
        // when connection becomes 'open' we can persist the session
        if (update.connection === 'open') {
          // store session
          const authCreds = sock.authState;
          await saveSession(sessionId, authCreds);
          // start persistent bot using saved creds
          await startBot(sessionId, authCreds);
        }
      } catch (e) {
        console.error('onUpdate error', e);
      }
    };

    sock.ev.on('connection.update', onUpdate);

    // safety timeout
    setTimeout(() => {
      if (!returned) {
        returned = true;
        res.json({ ok: false, error: 'Timeout generating code' });
        try { sock.end(); } catch (e) { }
      }
    }, 20000);

  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'server error' });
  }
});

// Endpoint to check status of saved sessions
app.get('/sessions', (req, res) => {
  const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));
  res.json({ sessions: files });
});

app.listen(PORT, () => console.log(`Bot-Mini listening on port ${PORT}`));

