import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers
} from "@whiskeysockets/baileys";

import pino from "pino";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

const PREFIX = process.env.PREFIX || "!";
const PORT = process.env.PORT || 10000;
const PHONE_NUMBER = process.env.PHONE_NUMBER;
const BOT_NAME = process.env.BOT_NAME || "PowerBot";

// Auto behaviors
const AUTO_TYPING = true;
const ALWAYS_ONLINE = true;
const AUTO_READ = true;

// ===============================
// ⚙️ Start Bot
// ===============================
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./session");
  const { version } = await fetchLatestBaileysVersion();

  console.log(`✅ Using WhatsApp Version: ${version.join(".")}`);

  const sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: Browsers.macOS("Chrome"),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
    },
    generateHighQualityLinkPreview: true,
    syncFullHistory: false,
    markOnlineOnConnect: true,
  });

  // ===============================
  // 🔌 Handle Connection Events
  // ===============================
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (connection === "open") {
      console.log(`🚀 ${BOT_NAME} connected successfully!`);
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log("❌ Connection closed. Reconnecting:", shouldReconnect);
      if (shouldReconnect) startBot();
    }

    // Generate pairing code if no session
    if (!sock.authState.creds.registered && PHONE_NUMBER) {
      const code = await sock.requestPairingCode(PHONE_NUMBER);
      console.log(`📲 Your WhatsApp Pairing Code: ${code}`);
    }
  });

  // ===============================
  // 💬 Handle Messages
  // ===============================
  sock.ev.on("messages.upsert", async ({ messages }) => {
    try {
      const m = messages[0];
      if (!m.message || m.key.fromMe) return;

      const from = m.key.remoteJid;
      const isGroup = from.endsWith("@g.us");
      const sender = isGroup
        ? m.key.participant
        : from;

      const textMessage =
        m.message.conversation ||
        m.message.extendedTextMessage?.text ||
        "";

      if (!textMessage.startsWith(PREFIX)) {
        if (AUTO_READ) await sock.readMessages([m.key]);
        if (AUTO_TYPING) await sock.sendPresenceUpdate("composing", from);
        if (ALWAYS_ONLINE) await sock.sendPresenceUpdate("available", from);
        return;
      }

      const command = textMessage.slice(PREFIX.length).trim().split(" ")[0].toLowerCase();

      switch (command) {
        // ===============================
        // 📢 Tag All
        // ===============================
        case "tagall":
          if (!isGroup) return sock.sendMessage(from, { text: "❌ Command only works in groups." });

          const groupMetadata = await sock.groupMetadata(from);
          const participants = groupMetadata.participants;
          const mentionIds = participants.map((p) => p.id);
          const mentionText = participants.map((p) => `@${p.id.split("@")[0]}`).join(" ");

          await sock.sendMessage(from, {
            text: `📢 *Tagging Everyone:*\n\n${mentionText}`,
            mentions: mentionIds,
          });
          break;

        // ===============================
        // 🔰 Help
        // ===============================
        case "help":
          await sock.sendMessage(from, {
            text: `🤖 *${BOT_NAME} Commands*\n\n` +
                  `!tagall - Tag everyone in group\n` +
                  `Auto Typing: ON\nAlways Online: ON\nAuto View: ON`
          });
          break;

        default:
          await sock.sendMessage(from, { text: "❌ Unknown command. Use !help" });
          break;
      }
    } catch (err) {
      console.error("Message handler error:", err);
    }
  });

  sock.ev.on("creds.update", saveC
reds);
}

startBot();
