// 验证审批流转通知：onApprovalChange create/update 会给当前审批人创建通知
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();
const BASE = 'http://localhost:3001';
let testApprovalId = null;

function jwtFor(name) {
  return import('node:child_process').then(({ execSync }) =>
    execSync(`node -e "import('jsonwebtoken').then(async ({default: jwt}) => console.log(jwt.sign({name:'${name}', open_id:'test-${name}'}, 'starline-oa-jwt-secret-change-in-production-2024', {expiresIn:'1h'})))"`, { encoding: 'utf8' }).trim()
  );
}

try {
  const token = await jwtFor('郑晓恩');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const steps = [
    { name: '部门经理审批', actor: '部门负责人', role: '部门经理', done: false, passed: null },
    { name: '总经理审批', actor: '总经理', role: '总经理', done: false, passed: null },
  ];

  // 1. 创建测试审批单
  const approval = await p.approval.create({
    data: {
      title: '【测试】流转通知验证', type: 'project_init', type_label: '项目立项',
      applicant: '测试申请人', dept: '综合管理', status: '待审核', cc_list: [],
      steps: JSON.stringify(steps), fields: '{}',
    },
  });
  testApprovalId = approval.id;
  console.log('1. 测试审批单已创建:', approval.id);

  // 2. invoke onApprovalChange create → 应通知第一审批人（部门经理 role 的员工）
  const r1 = await fetch(`${BASE}/api/functions/onApprovalChange`, {
    method: 'POST', headers,
    body: JSON.stringify({ event: { type: 'create', entity_id: approval.id }, data: approval }),
  });
  const j1 = await r1.json();
  console.log('2. onApprovalChange(create):', JSON.stringify(j1));

  // 3. 验证通知已创建
  const notifs = await p.notification.findMany({ where: { related_id: approval.id, type: 'approval_pending' } });
  console.log('3. 通知数量:', notifs.length, '| 接收人:', notifs.map(n => n.recipient).join(', '), '| title:', notifs[0]?.title);

  // 4. 模拟第一节点通过 → update（步骤流转到总经理）
  const newSteps = [
    { ...steps[0], done: true, passed: true },
    steps[1],
  ];
  await p.approval.update({ where: { id: approval.id }, data: { steps: JSON.stringify(newSteps), status: '审核中' } });
  const updated = await p.approval.findUnique({ where: { id: approval.id } });
  const r2 = await fetch(`${BASE}/api/functions/onApprovalChange`, {
    method: 'POST', headers,
    body: JSON.stringify({ event: { type: 'update', entity_id: approval.id }, data: updated, old_data: approval }),
  });
  const j2 = await r2.json();
  console.log('4. onApprovalChange(update):', JSON.stringify(j2));

  // 5. 验证通知流转（总经理 role 的员工应收到新通知）
  const notifs2 = await p.notification.findMany({ where: { related_id: approval.id, type: 'approval_pending' } });
  console.log('5. 流转后通知数量:', notifs2.length, '| 接收人:', notifs2.map(n => n.recipient).join(', '));

  console.log('\n✅ 审批流转通知验证通过');
} catch (e) {
  console.error('❌ 测试失败:', e.message);
} finally {
  if (testApprovalId) {
    await p.notification.deleteMany({ where: { related_id: testApprovalId } }).catch(() => {});
    await p.approval.delete({ where: { id: testApprovalId } }).catch(() => {});
  }
  await p.$disconnect();
  console.log('清理完成');
}
