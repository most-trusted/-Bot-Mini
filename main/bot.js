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

const logger = P({ level: "info" });

async function startBot() {
  logger.info("🚀 Starting PowerBot...");

  // Load session
  const { state, saveCreds } = await useMultiFileAuthState("./main/auth");

  // Fetch latest WhatsApp Web version
  const { version } = await fetchLatestBaileysVersion();
  logger.info("✅ Using WhatsApp version:", version);

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger,
    browser: ["PowerBot", "Chrome", "7.0"],
    markOnlineOnConnect: true
  });

  sock.ev.on("creds.update", saveCreds);

  // === Auto typing & always online ===
  setInterval(async () => {
    try {
      await sock.sendPresenceUpdate("available");
      await sock.sendPresenceUpdate("composing");
    } catch {}
  }, 15000);

  // === Handle incoming messages & auto-view status ===
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg?.message) return;

    const jid = msg.key.remoteJid;
    const fromMe = msg.key.fromMe;

    // Auto-view status
    if (jid?.endsWith("status@broadcast")) {
      try {
        await sock.readMessages([msg.key]);
        logger.info("👀 Auto-viewed a status");
      } catch {}
      return;
    }

    // Ignore bot's own messages
    if (fromMe) return;

    // Extract message text
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.imageMessage?.caption ||
      msg.message.videoMessage?.caption ||
      "";

    const command = text.trim().split(" ")[0].toLowerCase();

    // === Commands ===

    if (command === "!ping") {
      await sock.sendMessage(jid, { text: "🏓 Pong!" });
    }

    if (command === "!tagall") {
      try {
        const metadata = await sock.groupMetadata(jid);
        const participants = metadata.participants.map(p => p.id);
        const mentions = participants;

        await sock.sendMessage(jid, {
          text:
            "📢 Tagging everyone:\n\n" +
            participants.map(u => `@${u.split("@")[0]}`).join(" "),
          mentions
        });
      } catch (err) {
        await sock.sendMessage(jid, {
          text: "❌ This command only works in groups."
        });
      }
    }
  });

  // === Connection handler ===
  sock.ev.on("connection.update", update => {
    const { connection, lastDisconnect } = update;
    if (connection === "open") {
      logger.info("✅ Connected to WhatsApp successfully!");
    } else if (connection === "close") {
      const reason =
        lastDisconnect?.error?.output?.statusCode ||
        lastDisconnect?.error?.message;
      logger.error("❌ Connection closed:", reason);
      if (reason !== DisconnectReason.loggedOut) startBot();
      else logger.error("🚫 Session expired. Upload new creds.json");
    }
  });
}

startBot();

// === Render keep-alive HTTP ===
const PORT = process.env.PORT || 10000;
http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("PowerBot is running ✅");
  })
  .listen(PORT, () => {
    console.log(`🌍 Web port active on ${PORT}`);
  });
