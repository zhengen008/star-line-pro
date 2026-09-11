import prisma from '../src/lib/prisma.js';
import { createApprovalContext } from '../../../src/lib/approvalResolver.js';
import { buildStepsFromWorkflow, resolveWorkflowApprovalType } from '../../../src/lib/workflowDefaults.js';

const templates = await prisma.workflowTemplate.findMany();
const departments = await prisma.department.findMany();
const employees = await prisma.employee.findMany();

const approvalType = 'project_payment';
const workflowType = resolveWorkflowApprovalType(approvalType, '付款申请');
console.log('workflowType', workflowType);

const saved = templates.find((t) => t.approval_type === workflowType);
console.log('found template', !!saved, saved?.name);

const nodes = JSON.parse(saved.nodes || '[]');
const connections = JSON.parse(saved.connections || '[]');
const ctx = createApprovalContext({
  departments,
  employees,
  applicantDept: '运营部',
});
const steps = buildStepsFromWorkflow(
  { nodes, connections },
  {},
  '孙君恩',
  '孙君恩',
  ctx
);
console.log('steps', JSON.stringify(steps, null, 2));

await prisma['$disconnect']();
