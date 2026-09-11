import prisma from '../lib/prisma.js';
import { getTenantToken, pushFeishuCard } from '../lib/feishu.js';

export async function createNotification(req, res) {
  try {
    const {
      recipients = [],
      type,
      title,
      content = '',
      link = '',
      related_id = '',
      priority = 'normal',
      push_feishu = true,
    } = req.body;

    if (!type || !title || recipients.length === 0) {
      return res.status(400).json({ error: 'Missing type/title/recipients' });
    }

    const normalized = recipients.map(r => typeof r === 'string' ? { name: r } : r).filter(r => r.name);

    const created = [];
    for (const r of normalized) {
      const rec = await prisma.notification.create({
        data: {
          recipient: r.name,
          recipient_open_id: r.open_id || '',
          type,
          title,
          content,
          link,
          related_id,
          priority,
          is_read: false,
          is_archived: false,
          feishu_sent: false,
        },
      });
      created.push(rec);
    }

    let feishuPushed = 0;
    if (push_feishu) {
      try {
        const token = await getTenantToken();
        const allEmployees = await prisma.employee.findMany();
        const empByName = {};
        allEmployees.forEach(e => { empByName[e.name] = e; });

        const origin = req.headers.origin || '';
        const linkUrl = link ? (link.startsWith('http') ? link : `${origin}${link}`) : '';

        for (const r of normalized) {
          const openId = r.open_id || empByName[r.name]?.employee_id;
          if (!openId) continue;
          try {
            await pushFeishuCard(token, openId, title, content, linkUrl);
            feishuPushed++;
          } catch { /* ignore individual failure */ }
        }

        for (const rec of created) {
          if (rec.recipient_open_id || empByName[rec.recipient]) {
            await prisma.notification.update({
              where: { id: rec.id },
              data: { feishu_sent: true },
            });
          }
        }
      } catch { /* Feishu push failure doesn't affect notification creation */ }
    }

    res.json({ success: true, created: created.length, feishu_pushed: feishuPushed });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
