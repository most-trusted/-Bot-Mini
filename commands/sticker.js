import fs from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

export default {
  name: 'sticker',
  description: 'Convert sent image to sticker (send image with caption "!sticker")',
  execute: async (sock, msg) => {
    const remote = msg.key.remoteJid;
    try {
      const m = msg.message;
      // if the incoming message is an image (either imageMessage or extended with image)
      const isImage = !!m.imageMessage || !!m.documentMessage;
      if (!isImage) {
        await sock.sendMessage(remote, { text: 'Send an image with caption !sticker' });
        return;
      }

      // download stream
      const stream = await downloadContentFromMessage(m.imageMessage ?? m.documentMessage, 'image');
      let buffer = Buffer.alloc(0);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

      const tmpFile = path.join(tmpdir(), `sticker-${Date.now()}.webp`);
      fs.writeFileSync(tmpFile, buffer);

      await sock.sendMessage(remote, { sticker: { url: tmpFile } }, { quoted: msg });
      // optionally remove temp file
      try { fs.unlinkSync(tmpFile); } catch {}
    } catch (e) {
      await sock.sendMessage(remote, { text: 'Failed to create sticker.' });
    }
  
}
};
