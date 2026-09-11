/**
 * Approval step / current-approver helpers.
 * Aligned with ApprovalDetailPanel mark-as-read logic.
 */

const PLACEHOLDER_ACTORS = new Set(['部门负责人', '财务总监', '总经理', '项目负责人']);

export function parseSteps(raw) {
  try {
    const steps = JSON.parse(raw || '[]');
    return Array.isArray(steps) ? steps : [];
  } catch {
    return [];
  }
}

/**
 * Index of the current pending approval step, or -1.
 * A step is active when: not done, not skipped, not condition/cc,
 * and all prior non-skipped approval steps are done.
 */
export function getActiveApprovalStepIndex(steps) {
  if (!Array.isArray(steps) || steps.length === 0) return -1;
  return steps.findIndex((s, i) =>
    !s.done &&
    !s.skipped &&
    !s.isCondition &&
    !s.isCC &&
    steps.slice(0, i).filter((x) => !x.skipped && !x.isCondition && !x.isCC).every((x) => x.done)
  );
}

/**
 * 创建审批时：若已无待办审批节点（全部自跳过/已完成），则直接视为已通过。
 */
export function resolveAutoPassStatus(steps, fallback = '待审核') {
  if (!Array.isArray(steps) || steps.length === 0) return fallback;
  const hasApprovalNodes = steps.some((s) => !s.isCondition && !s.isCC);
  if (!hasApprovalNodes) return fallback;
  return getActiveApprovalStepIndex(steps) < 0 ? '已通过' : fallback;
}

/**
 * @param {object} item - Approval entity
 * @param {{ currentUser: string, role?: string, dept?: string }} ctx
 */
export function isCurrentApprover(item, { currentUser, role = '', dept = '' } = {}) {
  if (!item) return false;
  if (item.status !== '待审核' && item.status !== '审核中') return false;

  const steps = parseSteps(item.steps);
  if (steps.length === 0) return true;

  const activeIdx = getActiveApprovalStepIndex(steps);
  if (activeIdx < 0) return false;

  const step = steps[activeIdx];
  if (
    step.actor &&
    step.actor !== '-' &&
    !PLACEHOLDER_ACTORS.has(step.actor) &&
    step.actor === currentUser
  ) {
    return true;
  }
  if (step.role && step.role === role) return true;
  if (step.role === '部门经理' && item.dept === dept && role === '部门经理') return true;
  return false;
}
