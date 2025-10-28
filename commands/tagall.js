export default {
  name: 'tagall',
  description: 'Tag all members in a group',
  execute: async (sock, msg) => {
    const remote = msg.key.remoteJid;
    if (!remote || !remote.endsWith('@g.us')) {
      await sock.sendMessage(remote, { text: 'This command works only in groups.' });
      return;
    }

    try {
      const metadata = await sock.groupMetadata(remote);
      const participants = metadata.participants || [];
      const mentions = participants.map(p => p.id);
      const text = `Attention:`;
      await sock.sendMessage(remote, { text, mentions });
    } catch (e) {
      await sock.sendMessage(remote, { text: 'Failed to tag all.' });
    }
  }
};
                             
