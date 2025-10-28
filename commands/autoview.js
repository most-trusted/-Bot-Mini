export default {
  name: 'autoview',
  description: 'Toggle auto view status updates (on/off)',
  execute: async (sock, msg, args) => {
    const remote = msg.key.remoteJid;
    const op = (args[0] || '').toLowerCase();
    if (!['on', 'off'].includes(op)) {
      await sock.sendMessage(remote, { text: 'Usage: !autoview on|off' });
      return;
    }
    await sock.sendMessage(remote, { text: `autoview will be set to ${op}` });
  }
};
