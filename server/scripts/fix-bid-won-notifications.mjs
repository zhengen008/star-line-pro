import { PrismaClient } from '@prisma/client';

// 1. 删除「项目立项审批流」工作流模板（立项已改为免审批）
// 2. 修复历史数据：将「项目状态非待立项」项目的 bid_won（中标待立项）通知归档
const p = new PrismaClient();
try {
  const tpl = await p.workflowTemplate.deleteMany({ where: { name: '项目立项审批流' } });
  console.log('删除立项审批流模板:', tpl.count, '条');

  const projects = await p.project.findMany({ where: { NOT: { status: '待立项' } }, select: { id: true, name: true, status: true } });
  const ids = projects.map(x => x.id);
  console.log('非待立项项目:', projects.length, '个');
  projects.forEach(x => console.log(`  - ${x.name} [${x.status}]`));

  if (ids.length > 0) {
    const r = await p.notification.updateMany({
      where: { type: 'bid_won', related_id: { in: ids }, is_archived: false },
      data: { is_read: true, is_archived: true },
    });
    console.log('归档 bid_won 通知:', r.count, '条');
  }

  // 复查剩余未归档 bid_won 通知
  const left = await p.notification.findMany({ where: { type: 'bid_won', is_archived: false }, select: { recipient: true, title: true, related_id: true } });
  console.log('剩余未归档 bid_won 通知:', left.length);
  left.forEach(n => console.log(`  - ${n.recipient} | ${n.title} | related=${n.related_id}`));
} catch (e) {
  console.error('ERROR:', e.message);
}
await p.$disconnect();
