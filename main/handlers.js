import { commands } from '../commands/index.js';
import { PREFIX, DEFAULTS } from './config.js';
import logger from './logger.js';
import { setPresenceTyping, ensureDefaultFlags } from './utils.js';

const log = logger;

// in-memory toggles (per run). Default ON according to spec.
const toggles = {
  autotyping: DEFAULTS.autotyping,
  alwaysonline: DEFAULTS.alwaysonline,
  autoview: DEFAULTS.autoview
};

export async function handleMessage(sock, msg) {
  const remote = msg.key.remoteJid;
  const msgContent = msg.message;
  const text = msgContent?.conversation ?? msgContent?.extendedTextMessage?.text;
  if (!text) return;

  // If autotyping enabled, send composing presence for a short time before processing
  if (toggles.autotyping) {
    try { await setPresenceTyping(sock, remote, true); } catch (e) { log.warn('autotyping failed', e); }
  }

  if (!text.startsWith(PREFIX)) {
    // if presence typing was turned on, clear it
    if (toggles.autotyping) {
      try { await setPresenceTyping(sock, remote, false); } catch {}
    }
    return;
  }

  const parts = text.slice(PREFIX.length).trim().split(/\s+/);
  const cmdName = parts.shift().toLowerCase();
  const args = parts;

  // check for toggle commands that should change runtime toggles locally
  if (cmdName === 'autotyping' || cmdName === 'alwaysonline' || cmdName === 'autoview') {
    const onoff = args[0]?.toLowerCase();
    const val = (onoff === 'on');
    if (cmdName === 'autotyping') toggles.autotyping = val;
    if (cmdName === 'alwaysonline') toggles.alwaysonline = val;
    if (cmdName === 'autoview') toggles.autoview = val;
    await sock.sendMessage(remote, { text: `✅ ${cmdName} set to ${val ? 'ON' : 'OFF'}` });
    return;
  }

  // find command
  const cmd = commands.find(c => c.name === cmdName);
  if (!cmd) {
    await sock.sendMessage(remote, { text: '❌ Unknown command.' });
    return;
  }

  try {
    await cmd.execute(sock, msg, args);
    log.info(`Executed command ${cmdName}`);
  } catch (err) {
    log.error(`Error executing ${cmdName}`, err);
    await sock.sendMessage(remote, { text: '⚠️ An error occurred running that command.' });
  }

  if (toggles.autotyping) {
    try { await setPresenceTyping(sock, remote, false); } catch {}
  }
  }
    
