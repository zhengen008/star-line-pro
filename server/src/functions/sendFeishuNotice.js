import { getTenantToken, pushFeishuCard } from '../lib/feishu.js';

const BASE = 'https://open.feishu.cn/open-apis';

async function getAllOpenIds(token) {
  const res = await fetch(`${BASE}/contact/v3/users?department_id=0&page_size=50&user_id_type=open_id`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return (data.data?.items || []).map(u => u.open_id).filter(Boolean);
}

export async function sendFeishuNotice(req, res) {
  try {
    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Missing title or content' });
    }

    const token = await getTenantToken();
    if (!token) {
      return res.status(500).json({ error: 'Failed to get Feishu token' });
    }

    const openIds = await getAllOpenIds(token);

    const results = await Promise.allSettled(
      openIds.map(id => pushFeishuCard(token, id, title, content, ''))
    );

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    res.json({ success: true, sent: succeeded, total: openIds.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
