/**
 * 默认审批流模板与步骤构建（不含硬编码测试人员/部门）。
 */
import { createApprovalContext } from './approvalResolver.js';

export function evaluateCondition(condition, fields) {
  if (!condition) return { matched: true, branch: null };
  const ops = [
    ['>=', (a, b) => a >= b],
    ['<=', (a, b) => a <= b],
    ['>', (a, b) => a > b],
    ['<', (a, b) => a < b],
    ['==', (a, b) => String(a) === String(b)],
  ];
  for (const [op, fn] of ops) {
    if (condition.includes(op)) {
      const [fieldPart, valPart] = condition.split(op).map((s) => s.trim());
      const fieldEntry = Object.entries(fields).find(
        ([k]) => fieldPart.includes(k) || k.includes(fieldPart)
      );
      if (fieldEntry) {
        const rawVal = String(fieldEntry[1]).replace(/[^0-9.]/g, '');
        const numVal = parseFloat(rawVal);
        const threshold = parseFloat(valPart);
        if (!isNaN(numVal) && !isNaN(threshold)) {
          return { matched: fn(numVal, threshold), op, fieldVal: numVal, threshold };
        }
      }
    }
  }
  return { matched: true, branch: null };
}

const financeDeptConfig = { approverMode: 'dept_head', dept: '', approver: '', deptKeyword: '财务' };

export const INIT_WORKFLOWS = [
  {
    id: 'wf_reimbursement', name: '报销审批流', approvalType: 'reimbursement',
    nodes: [
      { id: 'n1', type: 'start', x: 50, y: 180, label: '提交报销', config: {} },
      { id: 'n2', type: 'approval', x: 220, y: 180, label: '部门负责人审批', config: { approverMode: 'applicant_dept_head', approver: '申请人所在部门负责人' } },
      { id: 'n3', type: 'condition', x: 420, y: 180, label: '金额判断', config: { condition: '报销金额 > 5000', trueLabel: '> 5000', falseLabel: '≤ 5000' } },
      { id: 'n4', type: 'approval', x: 640, y: 100, label: '财务审批', config: { ...financeDeptConfig } },
      { id: 'n5', type: 'cc', x: 640, y: 260, label: '抄送财务', config: { ccList: [] } },
      { id: 'n6', type: 'end', x: 840, y: 180, label: '完成', config: {} },
    ],
    connections: [
      { id: 'c1', from: 'n1', to: 'n2', label: '' },
      { id: 'c2', from: 'n2', to: 'n3', label: '' },
      { id: 'c3', from: 'n3', to: 'n4', label: '> 5000' },
      { id: 'c4', from: 'n3', to: 'n5', label: '≤ 5000' },
      { id: 'c5', from: 'n4', to: 'n6', label: '' },
      { id: 'c6', from: 'n5', to: 'n6', label: '' },
    ],
  },
  {
    id: 'wf_purchase', name: '采购审批流', approvalType: 'purchase',
    nodes: [
      { id: 'n1', type: 'start', x: 50, y: 180, label: '发起采购', config: {} },
      { id: 'n2', type: 'approval', x: 220, y: 180, label: '部门负责人审批', config: { approverMode: 'applicant_dept_head', approver: '申请人所在部门负责人' } },
      { id: 'n3', type: 'condition', x: 420, y: 180, label: '预算判断', config: { condition: '总价 > 10000', trueLabel: '> 10000', falseLabel: '≤ 10000' } },
      { id: 'n4', type: 'approval', x: 640, y: 100, label: '财务审批', config: { ...financeDeptConfig } },
      { id: 'n5', type: 'end', x: 840, y: 180, label: '完成', config: {} },
    ],
    connections: [
      { id: 'c1', from: 'n1', to: 'n2', label: '' },
      { id: 'c2', from: 'n2', to: 'n3', label: '' },
      { id: 'c3', from: 'n3', to: 'n4', label: '> 10000' },
      { id: 'c4', from: 'n3', to: 'n5', label: '≤ 10000' },
      { id: 'c5', from: 'n4', to: 'n5', label: '' },
    ],
  },
  {
    id: 'wf_project_payment', name: '项目付款审批流', approvalType: 'project_payment',
    nodes: [
      { id: 'n1', type: 'start', x: 50, y: 180, label: '申请付款', config: {} },
      { id: 'n2', type: 'approval', x: 220, y: 180, label: '项目负责人审批', config: { approverMode: 'project_manager', approver: '项目负责人' } },
      { id: 'n3', type: 'approval', x: 420, y: 180, label: '部门负责人审批', config: { approverMode: 'applicant_dept_head', approver: '申请人所在部门负责人' } },
      { id: 'n4', type: 'approval', x: 620, y: 180, label: '财务审批', config: { ...financeDeptConfig } },
      { id: 'n5', type: 'end', x: 820, y: 180, label: '完成', config: {} },
    ],
    connections: [
      { id: 'c1', from: 'n1', to: 'n2', label: '' },
      { id: 'c2', from: 'n2', to: 'n3', label: '' },
      { id: 'c3', from: 'n3', to: 'n4', label: '' },
      { id: 'c4', from: 'n4', to: 'n5', label: '' },
    ],
  },
  {
    id: 'wf_project_reserve', name: '备用金审批流', approvalType: 'project_reserve',
    nodes: [
      { id: 'n1', type: 'start', x: 50, y: 180, label: '申请备用金', config: {} },
      { id: 'n2', type: 'approval', x: 220, y: 180, label: '项目负责人审批', config: { approverMode: 'project_manager', approver: '项目负责人' } },
      { id: 'n3', type: 'approval', x: 420, y: 180, label: '财务审批', config: { ...financeDeptConfig } },
      { id: 'n4', type: 'end', x: 620, y: 180, label: '完成', config: {} },
    ],
    connections: [
      { id: 'c1', from: 'n1', to: 'n2', label: '' },
      { id: 'c2', from: 'n2', to: 'n3', label: '' },
      { id: 'c3', from: 'n3', to: 'n4', label: '' },
    ],
  },
  {
    id: 'wf_project_purchase', name: '项目采购审批流', approvalType: 'project_purchase',
    nodes: [
      { id: 'n1', type: 'start', x: 50, y: 180, label: '申请采购', config: {} },
      { id: 'n2', type: 'approval', x: 220, y: 180, label: '项目负责人审批', config: { approverMode: 'project_manager', approver: '项目负责人' } },
      { id: 'n3', type: 'approval', x: 420, y: 180, label: '部门负责人审批', config: { approverMode: 'applicant_dept_head', approver: '申请人所在部门负责人' } },
      { id: 'n4', type: 'end', x: 620, y: 180, label: '完成', config: {} },
    ],
    connections: [
      { id: 'c1', from: 'n1', to: 'n2', label: '' },
      { id: 'c2', from: 'n2', to: 'n3', label: '' },
      { id: 'c3', from: 'n3', to: 'n4', label: '' },
    ],
  },
  {
    id: 'wf_invoice', name: '开票审批流', approvalType: 'invoice',
    nodes: [
      { id: 'n1', type: 'start', x: 50, y: 180, label: '申请开票', config: {} },
      { id: 'n2', type: 'approval', x: 220, y: 180, label: '项目负责人审批', config: { approverMode: 'project_manager', approver: '项目负责人' } },
      { id: 'n3', type: 'approval', x: 420, y: 180, label: '财务审批', config: { ...financeDeptConfig } },
      { id: 'n4', type: 'end', x: 620, y: 180, label: '完成', config: {} },
    ],
    connections: [
      { id: 'c1', from: 'n1', to: 'n2', label: '' },
      { id: 'c2', from: 'n2', to: 'n3', label: '' },
      { id: 'c3', from: 'n3', to: 'n4', label: '' },
    ],
  },
  {
    id: 'wf_contract', name: '合同审批流', approvalType: 'contract',
    nodes: [
      { id: 'n1', type: 'start', x: 50, y: 180, label: '发起合同', config: {} },
      { id: 'n2', type: 'approval', x: 220, y: 180, label: '部门负责人审批', config: { approverMode: 'applicant_dept_head', approver: '申请人所在部门负责人' } },
      { id: 'n3', type: 'approval', x: 420, y: 180, label: '财务总监审批', config: { ...financeDeptConfig } },
      { id: 'n4', type: 'approval', x: 620, y: 180, label: '总经理审批', config: { approverMode: 'specific', approver: '', roleKeyword: '总经理' } },
      { id: 'n5', type: 'end', x: 820, y: 180, label: '生效', config: {} },
    ],
    connections: [
      { id: 'c1', from: 'n1', to: 'n2', label: '' },
      { id: 'c2', from: 'n2', to: 'n3', label: '' },
      { id: 'c3', from: 'n3', to: 'n4', label: '' },
      { id: 'c4', from: 'n4', to: 'n5', label: '' },
    ],
  },
  {
    id: 'wf_seal', name: '用章审批流', approvalType: 'seal',
    nodes: [
      { id: 'n1', type: 'start', x: 50, y: 180, label: '申请用章', config: {} },
      { id: 'n2', type: 'approval', x: 220, y: 180, label: '部门负责人审批', config: { approverMode: 'applicant_dept_head', approver: '申请人所在部门负责人' } },
      { id: 'n3', type: 'approval', x: 420, y: 180, label: '总经理审批', config: { approverMode: 'specific', approver: '', roleKeyword: '总经理' } },
      { id: 'n4', type: 'end', x: 620, y: 180, label: '完成', config: {} },
    ],
    connections: [
      { id: 'c1', from: 'n1', to: 'n2', label: '' },
      { id: 'c2', from: 'n2', to: 'n3', label: '' },
      { id: 'c3', from: 'n3', to: 'n4', label: '' },
    ],
  },
  {
    id: 'wf_project_initiation', name: '项目立项审批流', approvalType: 'project_initiation',
    nodes: [
      { id: 'n1', type: 'start', x: 50, y: 180, label: '提交立项', config: {} },
      { id: 'n2', type: 'approval', x: 220, y: 180, label: '项目负责人审批', config: { approverMode: 'project_manager', approver: '项目负责人' } },
      { id: 'n3', type: 'approval', x: 420, y: 180, label: '部门负责人审批', config: { approverMode: 'applicant_dept_head', approver: '申请人所在部门负责人' } },
      { id: 'n4', type: 'approval', x: 620, y: 180, label: '财务审批', config: { ...financeDeptConfig } },
      { id: 'n5', type: 'end', x: 820, y: 180, label: '完成', config: {} },
    ],
    connections: [
      { id: 'c1', from: 'n1', to: 'n2', label: '' },
      { id: 'c2', from: 'n2', to: 'n3', label: '' },
      { id: 'c3', from: 'n3', to: 'n4', label: '' },
      { id: 'c4', from: 'n4', to: 'n5', label: '' },
    ],
  },
  {
    id: 'wf_project_complete', name: '项目完成审批流', approvalType: 'project_complete',
    nodes: [
      { id: 'n1', type: 'start', x: 50, y: 180, label: '申请完成', config: {} },
      { id: 'n2', type: 'approval', x: 220, y: 180, label: '项目负责人审批', config: { approverMode: 'project_manager', approver: '项目负责人' } },
      { id: 'n3', type: 'approval', x: 420, y: 180, label: '部门负责人审批', config: { approverMode: 'applicant_dept_head', approver: '申请人所在部门负责人' } },
      { id: 'n4', type: 'approval', x: 620, y: 180, label: '财务审批', config: { ...financeDeptConfig } },
      { id: 'n5', type: 'end', x: 820, y: 180, label: '完成', config: {} },
    ],
    connections: [
      { id: 'c1', from: 'n1', to: 'n2', label: '' },
      { id: 'c2', from: 'n2', to: 'n3', label: '' },
      { id: 'c3', from: 'n3', to: 'n4', label: '' },
      { id: 'c4', from: 'n4', to: 'n5', label: '' },
    ],
  },
  {
    id: 'wf_project_change', name: '项目变更审批流', approvalType: 'project_change',
    nodes: [
      { id: 'n1', type: 'start', x: 50, y: 180, label: '申请变更', config: {} },
      { id: 'n2', type: 'approval', x: 220, y: 180, label: '项目负责人审批', config: { approverMode: 'project_manager', approver: '项目负责人' } },
      { id: 'n3', type: 'approval', x: 420, y: 180, label: '部门负责人审批', config: { approverMode: 'applicant_dept_head', approver: '申请人所在部门负责人' } },
      { id: 'n4', type: 'end', x: 620, y: 180, label: '完成', config: {} },
    ],
    connections: [
      { id: 'c1', from: 'n1', to: 'n2', label: '' },
      { id: 'c2', from: 'n2', to: 'n3', label: '' },
      { id: 'c3', from: 'n3', to: 'n4', label: '' },
    ],
  },
  {
    id: 'wf_project_execution_content', name: '项目执行内容审批流', approvalType: 'project_execution_content',
    nodes: [
      { id: 'n1', type: 'start', x: 50, y: 180, label: '提交执行内容', config: {} },
      { id: 'n2', type: 'approval', x: 220, y: 180, label: '项目负责人审批', config: { approverMode: 'project_manager', approver: '项目负责人' } },
      { id: 'n3', type: 'approval', x: 420, y: 180, label: '部门负责人审批', config: { approverMode: 'applicant_dept_head', approver: '申请人所在部门负责人' } },
      { id: 'n4', type: 'approval', x: 620, y: 180, label: '财务审批', config: { ...financeDeptConfig } },
      { id: 'n5', type: 'end', x: 820, y: 180, label: '完成', config: {} },
    ],
    connections: [
      { id: 'c1', from: 'n1', to: 'n2', label: '' },
      { id: 'c2', from: 'n2', to: 'n3', label: '' },
      { id: 'c3', from: 'n3', to: 'n4', label: '' },
      { id: 'c4', from: 'n4', to: 'n5', label: '' },
    ],
  },
];

function resolveDeptName(config, ctx) {
  if (config.dept) return config.dept;
  if (config.deptKeyword) return ctx.findDeptByKeyword(config.deptKeyword);
  return '';
}

function resolveSpecificApprover(config, ctx) {
  if (config.approver) return config.approver;
  if (config.roleKeyword) {
    const byRole = ctx.employees.find((e) => e.role === config.roleKeyword);
    if (byRole) return byRole.name;
    const byPosition = ctx.employees.find(
      (e) => e.position && (e.position.includes('总') || e.position.includes(config.roleKeyword))
    );
    if (byPosition) return byPosition.name;
    return config.roleKeyword;
  }
  return '';
}

/**
 * 从工作流图构建线性审批步骤。
 */
function makeApprovalStep({ nodeId, name, actor, role, applicantName }) {
  const actorName = typeof actor === 'string' ? actor.trim() : actor;
  const selfName = typeof applicantName === 'string' ? applicantName.trim() : applicantName;
  const isSelf =
    !!selfName &&
    !!actorName &&
    actorName !== '-' &&
    !PLACEHOLDER_ACTORS.has(actorName) &&
    actorName === selfName;

  if (isSelf) {
    return {
      nodeId,
      name,
      actor: actorName,
      role: role.includes('(跳过)') ? role : `${role}(跳过)`,
      done: true,
      passed: true,
      skipped: true,
    };
  }
  return {
    nodeId,
    name,
    actor: actorName || actor,
    role,
    done: false,
    passed: null,
  };
}

const PLACEHOLDER_ACTORS = new Set(['部门负责人', '财务总监', '总经理', '项目负责人', '-']);

export function buildStepsFromWorkflow(
  workflow,
  fields = {},
  applicantName = '',
  projectManager = '',
  resolverCtx = createApprovalContext()
) {
  const { nodes, connections } = workflow;
  const steps = [];
  let current = nodes.find((n) => n.type === 'start');
  const visited = new Set();
  const ctx = resolverCtx || createApprovalContext();
  const applicantDeptName = ctx.findApplicantDept(applicantName);
  const isApplicantDeptHead = ctx.isDeptHead(applicantName);

  while (current && !visited.has(current.id)) {
    visited.add(current.id);

    if (current.type === 'approval') {
      const mode = current.config.approverMode;

      if (mode === 'applicant_dept_head') {
        if (isApplicantDeptHead) {
          steps.push({
            nodeId: current.id,
            name: current.label,
            actor: applicantName,
            role: '部门负责人(跳过)',
            done: true, passed: true, skipped: true,
          });
        } else {
          const headName = ctx.resolveDeptHead(applicantDeptName) || '部门负责人';
          steps.push(makeApprovalStep({
            nodeId: current.id,
            name: current.label,
            actor: headName,
            role: '部门经理',
            applicantName,
          }));
        }
      } else if (mode === 'project_manager') {
        const actor = projectManager || '项目负责人';
        steps.push(makeApprovalStep({
          nodeId: current.id,
          name: current.label,
          actor,
          role: '项目负责人',
          applicantName,
        }));
      } else if (mode === 'dept_head') {
        const deptName = resolveDeptName(current.config, ctx);
        const headName = ctx.resolveDeptHead(deptName) || current.config.approver || '部门负责人';
        steps.push(makeApprovalStep({
          nodeId: current.id,
          name: current.label,
          actor: headName,
          role: deptName ? `${deptName}负责人` : '财务总监',
          applicantName,
        }));
      } else {
        const actor = resolveSpecificApprover(current.config, ctx) || '-';
        steps.push(makeApprovalStep({
          nodeId: current.id,
          name: current.label,
          actor,
          role: current.config.roleKeyword || '审批人',
          applicantName,
        }));
      }
    } else if (current.type === 'cc') {
      steps.push({
        nodeId: current.id,
        name: `抄送: ${(current.config.ccList || []).join(', ') || '—'}`,
        actor: '系统', role: '抄送',
        done: false, passed: null, isCC: true,
      });
    } else if (current.type === 'condition') {
      const result = evaluateCondition(current.config.condition, fields);
      const outConns = connections.filter((c) => c.from === current.id);
      const trueLabel = current.config.trueLabel || outConns[0]?.label;
      const falseLabel = current.config.falseLabel || outConns[1]?.label;
      const chosenConn = result.matched
        ? outConns.find((c) => c.label === trueLabel) || outConns[0]
        : outConns.find((c) => c.label === falseLabel) || outConns[1];

      steps.push({
        nodeId: current.id,
        name: `条件: ${current.config.condition}`,
        actor: '系统', role: '条件判断',
        done: true, passed: true, isCondition: true,
        conditionResult: result.matched ? `满足 (${trueLabel})` : `不满足 (${falseLabel})`,
      });

      if (chosenConn) {
        current = nodes.find((n) => n.id === chosenConn.to);
        continue;
      }
      break;
    }

    const nextConn = connections.find((c) => c.from === current.id);
    current = nextConn ? nodes.find((n) => n.id === nextConn.to) : null;
  }

  return steps;
}

export function resolveWorkflowApprovalType(type, typeLabel = '') {
  if (type === 'project_init') {
    if (typeLabel === '项目立项') return 'project_initiation';
    if (typeLabel === '项目完成') return 'project_complete';
    if (typeLabel === '项目变更') return 'project_change';
  }
  return type;
}
