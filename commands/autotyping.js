export default {
  name: 'autotyping',
  description: 'Toggle auto typing presence (on/off)',
  execute: async (sock, msg, args) => {
    const remote = msg.key.remoteJid;
    const op = (args[0] || '').toLowerCase();
    if (!['on', 'off'].includes(op)) {
      await sock.sendMessage(remote, { text: 'Usage: !autotyping on|off' });
      return;
    }
    // this command is handled in handlers as in-memory toggle; we just reply
    await sock.sendMessage(remote, { text: `autotyping will be set to ${op}` });
  }
};
