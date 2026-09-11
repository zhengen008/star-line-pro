import prisma from '../lib/prisma.js';
import { getTenantToken } from '../lib/feishu.js';

const BASE = 'https://open.feishu.cn/open-apis';

async function pushFeishuCardLocal(token, openId, title, content, link) {
  const elements = [{ tag: 'div', text: { tag: 'lark_md', content: (content || '').slice(0, 500) } }];
  if (link) {
    elements.push({
      tag: 'action',
      actions: [{ tag: 'button', text: { tag: 'plain_text', content: '查看详情' }, type: 'primary', url: link }],
    });
  }
  elements.push({ tag: 'note', elements: [{ tag: 'plain_text', content: '来自 Octopus 系统通知' }] });
  const res = await fetch(`${BASE}/im/v1/messages?receive_id_type=open_id`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      receive_id: openId,
      msg_type: 'interactive',
      content: JSON.stringify({
        config: { wide_screen_mode: true },
        header: { title: { tag: 'plain_text', content: `📢 ${title}` }, template: 'blue' },
        elements,
      }),
    }),
  });
  return res.ok;
}

export async function onNoticePublish(req, res) {
  try {
    const { event, data, old_data } = req.body;
    if (!data || data.status !== '已发布') {
      return res.json({ ok: true, skipped: 'not published' });
    }

    const isNewlyPublished = event.type === 'create' ||
      (event.type === 'update' && old_data && old_data.status !== '已发布');
    if (!isNewlyPublished) {
      return res.json({ ok: true, skipped: 'no status change' });
    }

    const employees = await prisma.employee.findMany({
      where: { status: '在职' },
      orderBy: { created_date: 'desc' },
    });

    const link = '/notices';
    const origin = req.headers.origin || '';
    const plainContent = (data.content || '').replace(/<[^>]+>/g, '').slice(0, 200);

    const feishuToken = await getTenantToken();
    let feishuPushed = 0;

    for (const emp of employees) {
      const openId = emp.employee_id || '';
      const rec = await prisma.notification.create({
        data: {
          recipient: emp.name,
          recipient_open_id: openId,
          type: 'notice',
          title: `新通知：${data.title}`,
          content: plainContent,
          link,
          related_id: event.entity_id,
          priority: data.is_pinned ? 'high' : 'normal',
          is_read: false,
          is_archived: false,
          feishu_sent: false,
        },
      });

      if (feishuToken && openId) {
        try {
          const linkUrl = `${origin}${link}`;
          const ok = await pushFeishuCardLocal(feishuToken, openId, data.title, plainContent, linkUrl);
          if (ok) {
            await prisma.notification.update({
              where: { id: rec.id },
              data: { feishu_sent: true },
            });
            feishuPushed++;
          }
        } catch { /* ignore individual failure */ }
      }
    }

    if (feishuPushed > 0) {
      await prisma.notice.update({
        where: { id: event.entity_id },
        data: { feishu_sent: true },
      });
    }

    res.json({ ok: true, notified: employees.length, feishu_pushed: feishuPushed });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
