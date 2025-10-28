export default {
  name: 'alwaysonline',
  description: 'Toggle always online (on/off)',
  execute: async (sock, msg, args) => {
    const remote = msg.key.remoteJid;
    const op = (args[0] || '').toLowerCase();
    if (!['on', 'off'].includes(op)) {
      await sock.sendMessage(remote, { text: 'Usage: !alwaysonline on|off' });
      return;
    }
    // actual toggle handled in handlers in-memory
    await sock.sendMessage(remote, { text: `alwaysonline will be set to ${op}` });
  }
};
