import axios from 'axios';

export default {
  name: 'ai',
  description: 'Ask OpenAI Chat (requires OPENAI_API_KEY)',
  execute: async (sock, msg, args) => {
    const remote = msg.key.remoteJid;
    const question = args.join(' ');
    if (!question) return await sock.sendMessage(remote, { text: 'Ask something: !ai how are you' });

    try {
      const resp = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: question }]
      }, {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
      });
      const answer = resp.data.choices?.[0]?.message?.content ?? 'No response';
      await sock.sendMessage(remote, { text: answer });
    } catch (e) {
      await sock.sendMessage(remote, { text: 'AI request failed.' });
    }
  }
};
