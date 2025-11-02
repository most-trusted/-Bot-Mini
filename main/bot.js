import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} from "@whiskeysockets/baileys";
import P from "pino";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const logger = P({ level: "info" });

async function startBot() {
  logger.info("🚀 Starting PowerBot...");

  // Load session from ./main/auth
  const { state, saveCreds } = await useMultiFileAuthState("./main/auth");

  // Fetch latest WhatsApp Web version
  const { version } = await fetchLatestBaileysVersion();
  logger.info("✅ Using WhatsApp version:", version);

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false, // no QR, using creds.json
    logger,
    browser: ["PowerBot", "Chrome", "7.0"],
    markOnlineOnConnect: true
  });

  sock.ev.on("creds.update", saveCreds);

  // Auto-typing and always online every 15 s
  setInterval(async () => {
    try {
      await sock.sendPresenceUpdate("available");
      await sock.sendPresenceUpdate("composing");
    } catch {}
  }, 15000);

  // Auto-view status updates
  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages) {
      if (msg.key?.remoteJid?.endsWith("status@broadcast")) {
        try {
          await sock.readMessages([msg.key]);
          logger.info("👀 Auto-viewed a status");
        } catch {}
      }
    }
  });

  // Handle incoming messages
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg?.message || msg.key.fromMe) return;

    const sender = msg.key.remoteJid;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      "";

    // === !tagall command ===
    if (text.startsWith("!tagall")) {
      try {
        const metadata = await sock.groupMetadata(sender);
        const participants = metadata.participants.map(p => p.id);
        const mentions = participants;

        await sock.sendMessage(sender, {
          text: "📢 Tagging everyone:\n\n" + participants.map(m => `@${m.split("@")[0]}`).join(" "),
          mentions
        });
      } catch (err) {
        logger.error("❌ Tagall error:", err);
      }
    }
  });

  // Connection management
  sock.ev.on("connection.update", update => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      logger.info("✅ Connected to WhatsApp successfully!");
    } else if (connection === "close") {
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
  });
}

startBot();
