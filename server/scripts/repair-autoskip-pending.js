/**
 * 修复：全部节点已自跳过但仍为「待审核」的审批，并同步 ExecutionSheet。
 */
import prisma from '../src/lib/prisma.js';

function parseSteps(raw) {
  try {
    const s = JSON.parse(raw || '[]');
    return Array.isArray(s) ? s : [];
  } catch {
    return [];
  }
}

function shouldAutoPass(steps) {
  if (!steps.length) return false;
  const approvalSteps = steps.filter((s) => !s.isCondition && !s.isCC);
  if (!approvalSteps.length) return false;
  return approvalSteps.every((s) => s.done && (s.passed || s.skipped));
}

const stuck = await prisma.approval.findMany({
  where: { status: { in: ['待审核', '审核中'] } },
});

let fixed = 0;
for (const a of stuck) {
  const steps = parseSteps(a.steps);
  if (!shouldAutoPass(steps)) continue;

  await prisma.approval.update({
    where: { id: a.id },
    data: { status: '已通过' },
  });

  let sheetId = null;
  try {
    sheetId = JSON.parse(a.fields || '{}').sheet_id || null;
  } catch { /* ignore */ }

  if (!sheetId && a.type === 'project_execution_content') {
    const sheets = await prisma.executionSheet.findMany({ where: { approval_id: a.id } });
    sheetId = sheets[0]?.id || null;
  }

  if (sheetId) {
    await prisma.executionSheet.update({
      where: { id: sheetId },
      data: { status: '已通过' },
    });
  }

  fixed += 1;
  console.log('fixed', a.id, a.title, sheetId ? `sheet=${sheetId}` : 'no-sheet');
}

console.log(JSON.stringify({ scanned: stuck.length, fixed }, null, 2));
await prisma['$disconnect']();
