import { createApprovalContext } from '../src/lib/approvalResolver.js';
import { buildStepsFromWorkflow, INIT_WORKFLOWS, resolveWorkflowApprovalType } from '../src/lib/workflowDefaults.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Use prisma from server via dynamic path
import prisma from '../server/src/lib/prisma.js';

const templates = await prisma.workflowTemplate.findMany();
const departments = await prisma.department.findMany();
const employees = await prisma.employee.findMany();

const approvalType = 'project_payment';
const workflowType = resolveWorkflowApprovalType(approvalType, '付款申请');
console.log('workflowType', workflowType);
console.log('templates approval_types', templates.map(t => t.approval_type));

const saved = templates.find((t) => t.approval_type === workflowType);
let workflow;
if (saved) {
  try {
    const nodes = JSON.parse(saved.nodes || '[]');
    const connections = JSON.parse(saved.connections || '[]');
    console.log('parsed nodes', nodes.length, 'conns', connections.length);
    if (nodes.length > 0) workflow = { nodes, connections };
  } catch (e) {
    console.log('parse error', e.message);
  }
}
if (!workflow) {
  const init = INIT_WORKFLOWS.find((w) => w.approvalType === workflowType);
  workflow = init ? { nodes: init.nodes, connections: init.connections } : null;
  console.log('using INIT', !!init);
}

const ctx = createApprovalContext({ departments, employees, applicantDept: '' });
const steps = buildStepsFromWorkflow(workflow, {}, '孙君恩', '孙君恩', ctx);
console.log('steps count', steps.length);
console.log(JSON.stringify(steps, null, 2));

await prisma['$disconnect']();
