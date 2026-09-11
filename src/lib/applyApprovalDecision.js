/**
 * Shared approval pass / reject / paid side-effects.
 * Used by ApprovalManagement and ProjectDetail.
 */
import { api as defaultApi } from '@/api/client';
import { syncExecutionSheetStatus } from '@/lib/submitProjectExecutionSheetSync';
import {
  finalizeProjectInitiationApproved,
  handleProjectInitiationRejected,
  isProjectInitiationApproval,
} from '@/lib/projectInitiationApproval';
import { mapApprovalStatusToPaymentStatus } from '@/lib/supplierPaymentHelpers';

/**
 * @param {object} opts
 * @param {object} opts.target - Approval record
 * @param {true|false|'paid'} opts.action
 * @param {string} opts.operatorName
 * @param {typeof defaultApi} [opts.apiClient]
 * @returns {Promise<{ updateData: object, notifMsg: string }>}
 */
export async function applyApprovalDecision({
  target,
  action,
  operatorName,
  apiClient = defaultApi,
}) {
  if (!target) throw new Error('审批单不存在');

  let newStatus;
  let notifMsg;
  let updatedSteps = null;

  if (action === 'paid') {
    newStatus = '已付款';
    notifMsg = `《${target.title}》已标记为已付款`;
  } else if (action === true || action === false) {
    const steps = (() => {
      try {
        return JSON.parse(target.steps || '[]');
      } catch {
        return [];
      }
    })();
    const now = new Date().toLocaleString('zh-CN');

    if (steps.length > 0) {
      const pendingIdx = steps.findIndex((s) => !s.done && !s.skipped && !s.isCondition && !s.isCC);
      if (pendingIdx !== -1) {
        steps[pendingIdx] = { ...steps[pendingIdx], done: true, passed: action === true, time: now };
      }
      updatedSteps = steps;

      if (action === false) {
        newStatus = '已拒绝';
        notifMsg = `《${target.title}》在第${pendingIdx + 1}步被拒绝`;
      } else {
        const allDone = steps.filter((s) => !s.skipped && !s.isCondition && !s.isCC).every((s) => s.done && s.passed);
        if (allDone) {
          newStatus = '已通过';
          notifMsg = `《${target.title}》所有节点审批通过`;
        } else {
          newStatus = '审核中';
          notifMsg = `《${target.title}》进入下一审批节点`;
        }
      }
    } else {
      newStatus = action === true ? '已通过' : '已拒绝';
      notifMsg = action === true ? `《${target.title}》已通过审批` : `《${target.title}》已拒绝`;
    }
  }

  const updateData = { status: newStatus };
  if (updatedSteps) updateData.steps = JSON.stringify(updatedSteps);
  await apiClient.entities.Approval.update(target.id, updateData);

  if (action === true && target.project_id && target.direction === '支出' && target.amount > 0) {
    const projects = await apiClient.entities.Project.filter({ id: target.project_id });
    if (projects.length > 0) {
      const proj = projects[0];
      const newRemaining = (proj.remaining_budget ?? proj.budget_cost ?? 0) - target.amount;
      await apiClient.entities.Project.update(proj.id, { remaining_budget: newRemaining });
      await apiClient.entities.ProjectLog.create({
        project_id: proj.id,
        action: '预算扣减',
        detail: `审批「${target.title}」通过，扣减¥${target.amount.toLocaleString()}，剩余预算¥${newRemaining.toLocaleString()}`,
        operator: operatorName,
      });
    }
  }

  if (action === true && target.type_label === '项目变更' && target.project_id) {
    try {
      const fields = JSON.parse(target.fields || '{}');
      const projectUpdate = {};
      Object.entries(fields).forEach(([label, val]) => {
        const newVal = String(val).includes(' → ') ? String(val).split(' → ').pop().trim() : val;
        if (label === '合同编号') projectUpdate.contract_no = newVal === '-' ? '' : newVal;
        if (label === '开始时间') projectUpdate.start_date = newVal === '-' ? '' : newVal;
        if (label === '结束时间') projectUpdate.end_date = newVal === '-' ? '' : newVal;
        if (label === '成本预算') projectUpdate.budget_cost = parseFloat(String(newVal).replace(/[¥,]/g, '')) || 0;
        if (label === '结算方式') projectUpdate.payment_method = newVal === '-' ? '' : newVal;
      });
      if (Object.keys(projectUpdate).length > 0) {
        await apiClient.entities.Project.update(target.project_id, projectUpdate);
        await apiClient.entities.ProjectLog.create({
          project_id: target.project_id,
          action: '信息变更',
          detail: `项目变更审批通过，更新字段：${Object.keys(projectUpdate).join('、')}`,
          operator: operatorName,
        });
      }
    } catch (e) {
      console.error('Failed to apply project changes', e);
    }
  }

  if (action === true && target.type_label === '项目完成' && target.project_id) {
    await apiClient.entities.Project.update(target.project_id, { status: '已完成' });
    await apiClient.entities.ProjectLog.create({
      project_id: target.project_id,
      action: '项目完成',
      detail: '项目完成审批通过，状态变更为已完成',
      operator: operatorName,
    });
  }
  if (action === false && target.type_label === '项目完成' && target.project_id) {
    await apiClient.entities.Project.update(target.project_id, { status: '执行中' });
    await apiClient.entities.ProjectLog.create({
      project_id: target.project_id,
      action: '完成审批被拒绝',
      detail: '项目完成审批被拒绝，状态恢复为执行中',
      operator: operatorName,
    });
  }

  if (isProjectInitiationApproval(target) && target.project_id) {
    if (action === true && newStatus === '已通过') {
      const projects = await apiClient.entities.Project.filter({ id: target.project_id });
      const proj = projects[0];
      if (proj) {
        await finalizeProjectInitiationApproved({
          approval: { ...target, ...updateData },
          project: proj,
          operatorName,
          apiClient,
        });
      }
    }
    if (action === false) {
      await handleProjectInitiationRejected({
        approval: target,
        projectId: target.project_id,
        operatorName,
        apiClient,
      });
    }
  }

  if (
    target.type === 'project_execution_content' ||
    target.type_label === '项目执行内容'
  ) {
    await syncExecutionSheetStatus({ ...target, ...updateData }, newStatus, apiClient);
    if (action === true && newStatus === '已通过' && target.project_id) {
      let sheetName = '';
      try { sheetName = JSON.parse(target.fields || '{}').sheet_name || ''; } catch { /* ignore */ }
      await apiClient.entities.ProjectLog.create({
        project_id: target.project_id,
        action: '执行内容审批通过',
        detail: sheetName ? `Sheet「${sheetName}」已通过审批` : '执行内容 Sheet 已通过审批',
        operator: operatorName,
      });
    }
    if (action === false && target.project_id) {
      await apiClient.entities.ProjectLog.create({
        project_id: target.project_id,
        action: '执行内容审批被拒绝',
        detail: `Sheet 审批被拒绝：${target.title}`,
        operator: operatorName,
      });
    }
  }

  if (
    (target.type === 'project_payment' || target.type_label === '付款申请') &&
    newStatus
  ) {
    try {
      const fields = JSON.parse(target.fields || '{}');
      const supplierItemId = fields.supplier_item_id;
      if (supplierItemId) {
        await apiClient.entities.SupplierItem.update(supplierItemId, {
          payment_status: mapApprovalStatusToPaymentStatus(newStatus),
          approval_id: target.id,
        });
      }
    } catch (e) {
      console.error('sync supplier payment_status failed:', e);
    }
  }

  try {
    await apiClient.functions.invoke('onApprovalChange', {
      event: { type: 'update', entity_id: target.id },
      data: { ...target, ...updateData },
      old_data: target,
    });
  } catch (e) {
    console.error('onApprovalChange failed:', e);
  }

  return { updateData, notifMsg };
}
