/**
 * 提交审批时，从工作流模板 + 部门/员工数据构建 steps。
 */
import { api as defaultApi } from '@/api/client';
import { createApprovalContext } from './approvalResolver.js';
import {
  INIT_WORKFLOWS,
  buildStepsFromWorkflow,
  resolveWorkflowApprovalType,
} from './workflowDefaults';

function parseFields(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

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

function loadWorkflowGraph(templates, approvalType) {
  const saved = templates.find((t) => t.approval_type === approvalType);
  if (saved) {
    const nodes = parseJsonArray(saved.nodes);
    const connections = parseJsonArray(saved.connections);
    if (nodes.length > 0) return { nodes, connections };
  }
  const init = INIT_WORKFLOWS.find((w) => w.approvalType === approvalType);
  if (init) return { nodes: init.nodes, connections: init.connections };
  return null;
}

/**
 * @param {object} opts
 * @param {string} opts.approvalType
 * @param {string} [opts.typeLabel]
 * @param {object|string} [opts.fields]
 * @param {string} [opts.applicantName]
 * @param {string} [opts.applicantDept]
 * @param {string} [opts.projectManager]
 * @param {typeof defaultApi} [opts.apiClient]
 */
export async function buildApprovalStepsForSubmit({
  approvalType,
  typeLabel = '',
  fields = {},
  applicantName = '',
  applicantDept = '',
  projectManager = '',
  apiClient = defaultApi,
}) {
  const workflowType = resolveWorkflowApprovalType(approvalType, typeLabel);
  const [templates, departments, employees] = await Promise.all([
    apiClient.entities.WorkflowTemplate.list('-created_date'),
    apiClient.entities.Department.list('-created_date'),
    apiClient.entities.Employee.list('-created_date'),
  ]);

  const workflow = loadWorkflowGraph(templates, workflowType);
  if (!workflow) return [];

  const ctx = createApprovalContext({ departments, employees, applicantDept });
  return buildStepsFromWorkflow(
    workflow,
    parseFields(fields),
    applicantName,
    projectManager,
    ctx
  );
}
