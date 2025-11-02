import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} from "@whiskeysockets/baileys";
import P from "pino";
import dotenv from "dotenv";
import fs from "fs";
import http from "http";

dotenv.config();

const logger = P({ level: process.env.LOG_LEVEL || "info" });

async function startBot() {
  logger.info("🚀 Starting PowerBot...");

  // Load or create auth session
  const { state, saveCreds } = await useMultiFileAuthState("./main/auth");

  // Fetch latest WhatsApp Web version
  const { version } = await fetchLatestBaileysVersion();
  logger.info(`✅ Using WhatsApp version: ${version}`);

  // Create socket
  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger,
    browser: [process.env.BOT_NAME || "PowerBot", "Chrome", "7.0"],
    markOnlineOnConnect: true
  });

  // Save credentials automatically
  sock.ev.on("creds.update", saveCreds);

  // === Always Online + Typing Simulation ===
  setInterval(async () => {
    try {
      await sock.sendPresenceUpdate("available");
      await sock.sendPresenceUpdate("composing");
    } catch {}
  }, 15000);

  // === Auto View Status Updates ===
  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages) {
      if (msg.key?.remoteJid?.endsWith("status@broadcast")) {
        try {
          await sock.readMessages([msg.key]);
          logger.info("👀 Auto-viewed a status update");
        } catch {}
      }
    }
  });

  // === Handle Incoming Messages ===
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg?.message || msg.key.fromMe) return;

    const sender = msg.key.remoteJid;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      "";

    // === !tagall Command ===
    if (text.startsWith("!tagall")) {
      try {
        const metadata = await sock.groupMetadata(sender);
        const participants = metadata.participants.map(p => p.id);
        const mentions = participants;

        await sock.sendMessage(sender, {
          text:
            "📢 Tagging everyone:\n\n" +
            participants.map(m => `@${m.split("@")[0]}`).join(" "),
          mentions
        });
      } catch (err) {
        logger.error("❌ Tagall error:", err);
      }
    }
  });

  // === Connection Updates & Pairing Code ===
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      logger.info("✅ Connected to WhatsApp successfully!");
    }

    if (connection === "close") {
      const reason =
        lastDisconnect?.error?.output?.statusCode ||
        lastDisconnect?.error?.message;

      logger.error("❌ Connection closed:", reason);
      if (reason !== DisconnectReason.loggedOut) {
        startBot(); // auto-reconnect
      } else {
        logger.error("🚫 Session expired. Upload new creds.json");
      }
    }

    // 🔹 Generate pairing code if not logged in
    if (update.connection === "connecting" && !update.qr) {
      try {
        const code = await sock.requestPairingCode(process.env.PHONE_NUMBER);
        logger.info(`📲 Your WhatsApp Pairing Code: ${code}`);
      } catch (err) {
        logger.error("⚠️ Failed to get pairing code:", err);
      }
    }
  });
}

startBot();

// === Keep-Alive HTTP Server for Render ===
const PORT = process.env.PORT || 10000;
http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("PowerBot is running ✅");
  })
  .listen(PORT, () => {
    console.log(`🌍 Web port active
    on ${PORT}`);
  });
