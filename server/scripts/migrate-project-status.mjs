import { PrismaClient } from '@prisma/client';

// 迁移：删除项目中间状态（待立项/立项审批中/已立项）→ 统一改为「执行中」
// 归档历史 bid_won（中标待立项）通知（该通知类型已废弃）
const p = new PrismaClient();
try {
  const r = await p.project.updateMany({
    where: { status: { in: ['待立项', '立项审批中', '已立项'] } },
    data: { status: '执行中' },
  });
  console.log('项目状态迁移:', r.count, '条 → 执行中');

  const n = await p.notification.updateMany({
    where: { type: 'bid_won', is_archived: false },
    data: { is_read: true, is_archived: true },
  });
  console.log('归档 bid_won 通知:', n.count, '条');

  const statuses = await p.project.groupBy({ by: ['status'], _count: true });
  console.log('当前项目状态分布:', statuses.map(s => `${s.status}:${s._count}`).join(', '));
} catch (e) {
  console.error('ERROR:', e.message);
}
await p.$disconnect();
