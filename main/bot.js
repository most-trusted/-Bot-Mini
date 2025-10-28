// main/bot.js
import makeWASocket, { useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore, initAuthCreds } from "@whiskeysockets/baileys"
import { Boom } from "@hapi/boom"
import dotenv from "dotenv"
import logger from "./logger.js"
import fs from "fs"
import path from "path"

dotenv.config()

async function loadMegaSession(sessionString) {
  try {
    const decoded = JSON.parse(Buffer.from(sessionString, "base64").toString("utf8"))
    if (!decoded.creds || !decoded.keys) throw new Error("Invalid session format")

    const authDir = path.join(process.cwd(), "main", "auth")
    if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true })

    // Save creds + keys
    fs.writeFileSync(path.join(authDir, "creds.json"), JSON.stringify(decoded.creds, null, 2))
    fs.writeFileSync(path.join(authDir, "keys.json"), JSON.stringify(decoded.keys, null, 2))
    return true
  } catch (e) {
    logger.error("❌ Failed to load Mega session:", e.message)
    return false
  }
}

async function startBot() {
  logger.info("Starting bot...")

  // Load session from .env if available
  const session = process.env.SESSION_ID
  if (session && session.length > 10) {
    logger.info("🧩 Loading session from .env (Mega style)")
    await loadMegaSession(session)
  } else {
    logger.warn("⚠️ No SESSION_ID found, fallback to QR method")
  }

  const { state, saveCreds } = await useMultiFileAuthState("./main/auth")

  const sock = makeWASocket({
    auth: {
      creds: state.creds ?? initAuthCreds(),
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    printQRInTerminal: !session,
    browser: ["PowerBot", "Chrome", "7.0"],
    logger,
  })

  sock.ev.on("creds.update", saveCreds)

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update
    if (connection === "close") {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode
      if (reason !== DisconnectReason.loggedOut) {
        logger.warn("Reconnecting...")
        startBot()
      } else {
        logger.error("Logged out. Please update SESSION_ID.")
      }
    } else if (connection === "open") {
      logger.info("🟢 Bot connected successfully")
    }
  })
}

startBot()
