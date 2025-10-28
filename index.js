import express from 'express';
import fetch from 'node-fetch';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import { makeWASocket, DisconnectReason, useSingleFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 3000;

// session file (auto created on first pairing)
const { state, saveState } = useSingleFileAuthState('./session.json');

let sock;

// Function to start the bot
async function startBot() {
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Using Baileys v${version.join('.')}, Latest: ${isLatest}`);

  sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: state,
    browser: ['Bot-Mini', 'Chrome', '10.0']
  });

  // Always online + fake typing
  setInterval(() => {
    if (sock?.user) {
      sock.sendPresenceUpdate('available');
      sock.sendPresenceUpdate('composing');
    }
  }, 15000);

  // Auto save auth
  sock.ev.on('creds.update', saveState);

  // Connection updates
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('Scan this QR to link your WhatsApp:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const shouldReconnect =
        (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Connection closed. Reconnecting...', shouldReconnect);
      if (shouldReconnect) startBot();
    } else if (connection === 'open') {
      console.log('✅ Bot-Mini connected successfully.');
    }
  });

  // Simple reply to test
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

    if (text.startsWith('+ping')) {
      await sock.sendMessage(from, { text: '🏓 Pong! Bot-Mini is online.' });
    }

    if (text.startsWith('+song ')) {
      const query = text.slice(6).trim();
      await sock.sendMessage(from, { text: `🎵 Downloading *${query}* ... please wait.` });
      // You can integrate a downloader API here later
    }
  });
}

// Start Express server
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Code generator endpoint
app.get('/code', async (req, res) => {
  const number = req.query.number;
  if (!number) return res.status(400).json({ error: 'Missing number' });

  // Just a simulated generator for now
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  console.log(`Code generated for ${number}: ${code}`);
  res.json({ number, code });
});

// Default route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`🚀 Bot-Mini server running on port ${port}`);
  startBot();
});
