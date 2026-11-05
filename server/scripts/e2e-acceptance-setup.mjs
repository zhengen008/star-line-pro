// 验收 / 统一立项走查准备：创建【测试】中标竞标（季付）并生成待立项项目，输出管理员 JWT 与 feishu_user。
// 用法：node scripts/e2e-acceptance-setup.mjs        清理：node scripts/e2e-acceptance-setup.mjs --cleanup
// 切换审批人：node scripts/e2e-acceptance-setup.mjs --token 姓名
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const p = new PrismaClient();
const TAG = '【测试】验收立项走查';
const signFor = (emp) => jwt.sign({ name: emp.name, open_id: `test-${emp.employee_id}` }, process.env.JWT_SECRET, { expiresIn: '2h' });

try {
  const tokenIdx = process.argv.indexOf('--token');
  if (tokenIdx > 0) {
    const emp = await p.employee.findFirst({ where: { name: process.argv[tokenIdx + 1] } });
    if (!emp) throw new Error('employee not found');
    console.log(JSON.stringify({ name: emp.name, employee_id: emp.employee_id, token: signFor(emp) }));
  } else if (process.argv.includes('--cleanup')) {
    const projects = await p.project.findMany({ where: { name: { startsWith: TAG } } });
    const ids = projects.map((x) => x.id);
    const approvals = await p.approval.findMany({ where: { project_id: { in: ids } }, select: { id: true } });
    const notes = await p.notification.deleteMany({
      where: {
        OR: [
          { related_id: { in: [...ids, ...approvals.map((a) => a.id)] } },
          { title: { contains: TAG } },
          { content: { contains: TAG } },
        ],
      },
    });
    await p.approval.deleteMany({ where: { project_id: { in: ids } } });
    await p.project.deleteMany({ where: { id: { in: ids } } });
    const bids = await p.bid.deleteMany({ where: { project_name: { startsWith: TAG } } });
    console.log(`cleaned projects=${ids.length} approvals=${approvals.length} notifications=${notes.count} bids=${bids.count}`);
  } else {
    const admin = await p.employee.findFirst({ where: { role: '管理员', status: '在职' } });
    if (!admin) throw new Error('no admin employee');
    const bid = await p.bid.create({
      data: {
        project_name: `${TAG}-季付`, customer_name: '测试客户', result: '中标', bid_form: '客户指定',
        manager: admin.name, payment_method: '季付', bid_amount: 400000,
      },
    });
    const project = await p.project.create({
      data: {
        bid_id: bid.id, name: bid.project_name, customer: bid.customer_name, project_type: '',
        contract_amount: 400000, payment_method: '季付', manager: admin.name, members: [], status: '待立项',
      },
    });
    console.log(JSON.stringify({ admin: admin.name, employee_id: admin.employee_id, bid: bid.id, project: project.id, token: signFor(admin) }));
  }
} finally {
  await p.$disconnect();
}
