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
  try {
    logger.info("🚀 Starting PowerBot...");

    // === Auth session ===
    const { state, saveCreds } = await useMultiFileAuthState("./main/auth");

    // === Fetch latest version ===
    const { version } = await fetchLatestBaileysVersion();
    logger.info("✅ Using WhatsApp version:", version);

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger,
      browser: ["PowerBot", "Chrome", "7.0"],
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: true,
      syncFullHistory: false,
      getMessage: async () => ({})
    });

    sock.ev.on("creds.update", saveCreds);

    // === Generate pairing code only if session missing ===
    if (!fs.existsSync("./main/auth/creds.json")) {
      const phoneNumber = process.env.PHONE_NUMBER;
      if (!phoneNumber) {
        logger.error("❌ PHONE_NUMBER missing in .env");
        process.exit(1);
      }

      const code = await sock.requestPairingCode(phoneNumber);
      logger.info(`📲 Your WhatsApp Pairing Code: ${code}`);
    }

    // === Auto typing + always online ===
    setInterval(async () => {
      try {
        await sock.sendPresenceUpdate("available");
        await sock.sendPresenceUpdate("composing");
      } catch (err) {}
    }, 15000);

    // === Auto view status ===
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

    // === Commands ===
    sock.ev.on("messages.upsert", async ({ messages }) => {
      const msg = messages[0];
      if (!msg?.message || msg.key.fromMe) return;

      const sender = msg.key.remoteJid;
      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        "";

      // === !tagall ===
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

    // === Connection management ===
    sock.ev.on("connection.update", async update => {
      const { connection, lastDisconnect } = update;

      if (connection === "open") {
        logger.info("✅ Connected to WhatsApp successfully!");
      } else if (connection === "close") {
        const reason =
          lastDisconnect?.error?.output?.statusCode ||
          lastDisconnect?.error?.message ||
          "";

        logger.error("❌ Connection closed:", reason);

        // Auto restart except logged out
        if (reason !== DisconnectReason.loggedOut) {
          logger.warn("♻️ Attempting auto-reconnect in 5s...");
          setTimeout(() => startBot(), 5000);
        } else {
          logger.error("🚫 Session expired. Re-pair required.");
        }
      }
    });

    // === Periodic keepalive ===
    setInterval(() => {
      if (sock.ws?.readyState !== 1) {
        logger.warn("🕓 Connection seems idle — attempting restart...");
        startBot();
      }
    }, 60000); // check every 1 min
  } catch (err) {
    logger.error("🔥 Fatal error, restarting bot:", err);
    setTimeout(() => startBot(), 5000);
  }
}

startBot();

// === HTTP keep-alive for Render ===
const PORT = process.env.PORT || 10000;
http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("PowerBot is running ✅");
  })
  .listen(PORT, () => {
    console.log(`🌍 Web port acti
                               ve on ${PORT}`);
  });
