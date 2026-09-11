// 测试 Excel 导入执行内容：生成 xlsx → 调 importExecutionItems → 验证 → 清理
import { PrismaClient } from '@prisma/client';
import XLSX from 'xlsx';
import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync, readFileSync } from 'node:fs';

const p = new PrismaClient();
const BASE = 'http://localhost:3001';
let testItemIds = [];

const jwt = execSync(`node -e "import('jsonwebtoken').then(async ({default: jwt}) => console.log(jwt.sign({name:'郑晓恩', open_id:'test-admin'}, 'starline-oa-jwt-secret-change-in-production-2024', {expiresIn:'1h'})))"`, { encoding: 'utf8' }).trim();

try {
  const project = await p.project.findFirst({ where: { status: '执行中' }, orderBy: { created_date: 'desc' } });
  if (!project) throw new Error('no project');
  console.log('测试项目:', project.id, project.name);

  // 1. 生成测试 Excel（含所有目标列 + 供应商列）
  const rows = [
    { '序号ID': '1', '项目名称': project.name, '内容': '活动策划执行', '详细说明': '包含方案设计与现场执行', '单位': '项', '数量': 2, '立项金额单价（含税）': 50000, '立项金额总价（含税）': 100000, '预算金额单价（含税）': 45000, '预算金额总价（含税）': 90000, '供应商': 'XX传媒' },
    { '序号ID': '2', '项目名称': project.name, '内容': '物料制作', '详细说明': '展台搭建物料', '单位': '批', '数量': 1, '立项金额单价（含税）': 30000, '立项金额总价（含税）': 30000, '预算金额单价（含税）': 28000, '预算金额总价（含税）': 28000, '供应商': 'YY工厂' },
    { '序号ID': '', '项目名称': '', '内容': '', '详细说明': '', '单位': '', '数量': '', '立项金额单价（含税）': '', '立项金额总价（含税）': '', '预算金额单价（含税）': '', '预算金额总价（含税）': '', '供应商': '' },
  ];
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '执行内容');
  const filePath = `${process.env.TEMP || '/tmp'}/test-execution.xlsx`;
  XLSX.writeFile(wb, filePath);

  // 2. 调用导入接口
  const form = new FormData();
  form.append('file', new Blob([readFileSync(filePath)]), 'test-execution.xlsx');
  form.append('project_id', project.id);
  const res = await fetch(`${BASE}/api/functions/importExecutionItems`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });
  const j = await res.json();
  console.log('导入结果:', JSON.stringify(j));

  // 3. 验证数据库
  const items = await p.executionItem.findMany({ where: { project_id: project.id }, orderBy: { created_date: 'desc' }, take: 5 });
  const fresh = items.filter(i => i.content === '活动策划执行' || i.content === '物料制作');
  testItemIds = fresh.map(i => i.id);
  console.log('导入执行内容:');
  fresh.forEach(i => console.log(`  - ${i.seq_id} | ${i.content} | 数量=${i.quantity} | 立项总价=${i.init_total} | 预算总价=${i.budget_total}`));

  // 4. 供应商列不应被导入
  const supplierCount = await p.supplierItem.count({ where: { execution_item_id: { in: testItemIds } } });
  console.log('供应商记录数（应为0，供应商由用户手动添加）:', supplierCount);

  if (fresh.length >= 2 && supplierCount === 0) {
    console.log('\n✅ Excel 导入验证通过');
  } else {
    console.log('\n❌ 验证失败');
  }
  unlinkSync(filePath);
} catch (e) {
  console.error('❌ 测试失败:', e.message);
} finally {
  if (testItemIds.length > 0) {
    await p.supplierItem.deleteMany({ where: { execution_item_id: { in: testItemIds } } }).catch(() => {});
    await p.executionItem.deleteMany({ where: { id: { in: testItemIds } } }).catch(() => {});
  }
  await p.$disconnect();
  console.log('清理完成');
}
