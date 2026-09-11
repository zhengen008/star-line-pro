import prisma from '../lib/prisma.js';

async function createNotifications(recipients, payload) {
  const unique = Array.from(new Set(recipients.filter(Boolean)));
  for (const name of unique) {
    await prisma.notification.create({
      data: {
        recipient: name,
        type: 'project_status',
        title: payload.title,
        content: payload.content || '',
        link: payload.link || '',
        related_id: payload.related_id || '',
        priority: payload.priority || 'normal',
        is_read: false,
        is_archived: false,
        feishu_sent: false,
      },
    });
  }
}

export async function onProjectChange(req, res) {
  try {
    const { event, data, old_data } = req.body;
    if (!data) return res.json({ ok: true });

    const link = `/projects?id=${event.entity_id}`;

    const recipients = [data.manager, ...(Array.isArray(data.members) ? data.members : [])];

    if (event.type === 'create') {
      await createNotifications(recipients, {
        title: `新项目已立项申请：${data.name}`,
        content: `项目「${data.name}」已提交立项申请，状态：${data.status}`,
        link,
        related_id: event.entity_id,
      });
      return res.json({ ok: true, notified: recipients.length });
    }

    if (event.type === 'update' && old_data && data.status !== old_data.status) {
      const isImportant = ['已立项', '已完成', '已归档'].includes(data.status);
      await createNotifications(recipients, {
        title: `项目状态更新：${data.name}`,
        content: `状态由「${old_data.status}」变更为「${data.status}」`,
        link,
        related_id: event.entity_id,
        priority: isImportant ? 'high' : 'normal',
      });
      return res.json({ ok: true, status_changed: true });
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
