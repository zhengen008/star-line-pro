import { getTenantToken, pushFeishuCard } from '../lib/feishu.js';

export async function sendFeishuNotification(req, res) {
  try {
    const { msg, receive_id, receive_id_type } = req.body;

    if (!msg || !receive_id) {
      return res.status(400).json({ error: 'Missing msg or receive_id' });
    }

    const token = await getTenantToken();
    if (!token) {
      return res.status(500).json({ error: 'Failed to get Feishu token' });
    }

    const idType = receive_id_type || 'open_id';

    await fetch('https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=' + idType, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receive_id,
        msg_type: 'interactive',
        content: JSON.stringify({
          config: { wide_screen_mode: true },
          header: {
            title: { tag: 'plain_text', content: '系统通知' },
            template: 'blue',
          },
          elements: [
            { tag: 'div', text: { tag: 'lark_md', content: msg.slice(0, 500) } },
            { tag: 'note', elements: [{ tag: 'plain_text', content: '来自 Octopus 系统通知' }] },
          ],
        }),
      }),
    });

    res.json({ success: true, sent: 1 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
