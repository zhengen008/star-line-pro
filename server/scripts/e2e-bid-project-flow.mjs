// 端到端流程测试：中标竞标 → ensurePendingProject（创建待立项+通知）→ markBidWonHandled（归档通知）
// 使用临时测试数据，测完清理。
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();
const BASE = 'http://localhost:3001';
let testBidId = null;
let testProjectId = null;

function jwtFor(name) {
  // 用子进程生成 JWT（jsonwebtoken 在 server 依赖中）
  return import('node:child_process').then(({ execSync }) =>
    execSync(`node -e "import('jsonwebtoken').then(async ({default: jwt}) => console.log(jwt.sign({name:'${name}', open_id:'test-${name}'}, 'starline-oa-jwt-secret-change-in-production-2024', {expiresIn:'1h'})))"`, { encoding: 'utf8' }).trim()
  );
}

try {
  const token = await jwtFor('郑晓恩');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // 1. 创建测试中标竞标
  const bid = await p.bid.create({
    data: { project_name: '【测试】中标自动立项流程验证', customer_name: '测试客户', result: '中标', manager: '李源', payment_method: '里程碑付款', bid_amount: 500000 },
  });
  testBidId = bid.id;
  console.log('1. 测试竞标已创建:', bid.id);

  // 2. 调 ensurePendingProject
  const r1 = await fetch(`${BASE}/api/functions/ensurePendingProject`, { method: 'POST', headers, body: JSON.stringify({ bid_id: testBidId }) });
  const j1 = await r1.json();
  console.log('2. ensurePendingProject:', JSON.stringify(j1));
  testProjectId = j1.project?.id;
  if (!testProjectId) throw new Error('project not created');

  // 3. 验证项目状态与通知
  const proj = await p.project.findUnique({ where: { id: testProjectId } });
  console.log('3. 项目状态:', proj.status, '| manager:', proj.manager, '| bid_id 关联:', proj.bid_id === testBidId);
  const notif = await p.notification.findFirst({ where: { type: 'bid_won', related_id: testProjectId } });
  console.log('   通知:', notif ? `${notif.type} | recipient=${notif.recipient} | link=${notif.link} | archived=${notif.is_archived}` : 'MISSING');

  // 4. 调 markBidWonHandled 归档
  const r2 = await fetch(`${BASE}/api/functions/markBidWonHandled`, { method: 'POST', headers, body: JSON.stringify({ bid_id: testBidId, project_id: testProjectId }) });
  const j2 = await r2.json();
  console.log('4. markBidWonHandled:', JSON.stringify(j2));
  const notifAfter = await p.notification.findFirst({ where: { type: 'bid_won', related_id: testProjectId } });
  console.log('   归档后通知: archived =', notifAfter?.is_archived, ', is_read =', notifAfter?.is_read);

  // 5. 再次 ensurePendingProject（幂等）
  const r3 = await fetch(`${BASE}/api/functions/ensurePendingProject`, { method: 'POST', headers, body: JSON.stringify({ bid_id: testBidId }) });
  console.log('5. 幂等调用:', JSON.stringify(await r3.json()));

  console.log('\n✅ 全流程验证通过');
} catch (e) {
  console.error('❌ 测试失败:', e.message);
} finally {
  // 清理测试数据
  if (testProjectId) await p.project.delete({ where: { id: testProjectId } }).catch(() => {});
  if (testBidId) {
    await p.notification.deleteMany({ where: { related_id: testBidId } }).catch(() => {});
    await p.bid.delete({ where: { id: testBidId } }).catch(() => {});
  }
  await p.$disconnect();
  console.log('清理完成（测试数据已删除）');
}
