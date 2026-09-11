/**
 * 修复 steps 为空的付款审批：按当前工作流重算 steps，并通知下一审批人。
 */
import prisma from '../src/lib/prisma.js';
import { createApprovalContext } from '../../src/lib/approvalResolver.js';
import { buildStepsFromWorkflow, resolveWorkflowApprovalType } from '../../src/lib/workflowDefaults.js';
import { getActiveApprovalStepIndex } from '../../src/lib/approvalAccess.js';

function parseJsonArray(raw, fallback = []) {
  if (Array.isArray(raw)) return raw;
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

const approvals = await prisma.approval.findMany({
  where: {
    status: { in: ['待审核', '审核中'] },
    OR: [{ steps: null }, { steps: '' }, { steps: '[]' }],
  },
  orderBy: { created_date: 'desc' },
});

console.log('empty-step pending approvals:', approvals.length);

const templates = await prisma.workflowTemplate.findMany();
const departments = await prisma.department.findMany();
const employees = await prisma.employee.findMany();

for (const a of approvals) {
  const workflowType = resolveWorkflowApprovalType(a.type, a.type_label || '');
  const saved = templates.find((t) => t.approval_type === workflowType);
  let workflow = null;
  if (saved) {
    const nodes = parseJsonArray(saved.nodes);
    const connections = parseJsonArray(saved.connections);
    if (nodes.length) workflow = { nodes, connections };
  }
  if (!workflow) {
    console.log('skip (no workflow)', a.id, a.title, a.type);
    continue;
  }

  let projectManager = '';
  if (a.project_id) {
    const p = await prisma.project.findUnique({ where: { id: a.project_id } });
    projectManager = p?.manager || '';
  }

  const ctx = createApprovalContext({
    departments,
    employees,
    applicantDept: a.dept || '',
  });
  const steps = buildStepsFromWorkflow(
    workflow,
    {},
    a.applicant || '',
    projectManager,
    ctx
  );
  const activeIdx = getActiveApprovalStepIndex(steps);
  const hasApprovalNodes = steps.some((s) => !s.isCondition && !s.isCC);
  const status = hasApprovalNodes && activeIdx < 0 ? '已通过' : a.status;

  await prisma.approval.update({
    where: { id: a.id },
    data: { steps: JSON.stringify(steps), status },
  });

  const next = activeIdx >= 0 ? steps[activeIdx] : null;
  console.log('fixed', a.title, {
    applicant: a.applicant,
    projectManager,
    status,
    next: next ? `${next.name}/${next.actor}` : null,
    skipped: steps.filter((s) => s.skipped).map((s) => s.name),
  });

  // 通知下一审批人
  if (next?.actor && next.actor !== a.applicant) {
    await prisma.notification.create({
      data: {
        recipient: next.actor,
        type: 'approval_pending',
        title: `待你审批：${a.title}`,
        content: `${a.applicant || ''} 提交了「${a.type_label || a.type}」（流程已修复并流转）`,
        link: `/approvals?id=${a.id}`,
        related_id: a.id,
        priority: 'high',
        is_read: false,
        is_archived: false,
        feishu_sent: false,
      },
    });
    console.log('  notified', next.actor);
  }
}

await prisma['$disconnect']();
