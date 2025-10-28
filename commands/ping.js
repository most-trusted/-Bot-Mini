export default {
  name: 'ping',
  description: 'Replies with pong',
  execute: async (sock, msg) => {
    await sock.sendMessage(msg.key.remoteJid, { text: 'pong 🏓' });
  }
};
