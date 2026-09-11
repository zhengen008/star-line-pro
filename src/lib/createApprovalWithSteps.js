/**
 * 创建审批单：自动构建 steps + 写入 + 通知。
 * 所有发起审批入口应走此函数，避免 steps 为空。
 */
import { api as defaultApi } from '@/api/client';
import { buildApprovalStepsForSubmit } from '@/lib/buildApprovalSteps';
import { resolveAutoPassStatus } from '@/lib/approvalAccess';

/**
 * @param {object} data - 审批创建 payload（含 type / applicant / project_id 等）
 * @param {typeof defaultApi} [apiClient]
 */
export async function createApprovalWithSteps(data, apiClient = defaultApi) {
  let projectManager = '';
  if (data.project_id) {
    const projects = await apiClient.entities.Project.filter({ id: data.project_id });
    projectManager = projects[0]?.manager || '';
  }

  const steps = await buildApprovalStepsForSubmit({
    approvalType: data.type,
    typeLabel: data.type_label,
    fields: data.fields,
    applicantName: data.applicant,
    applicantDept: data.dept,
    projectManager,
    apiClient,
  });

  const status = resolveAutoPassStatus(steps, data.status || '待审核');

  const approval = await apiClient.entities.Approval.create({
    ...data,
    status,
    steps: JSON.stringify(steps),
  });

  try {
    await apiClient.functions.invoke('onApprovalChange', {
      event: { type: 'create', entity_id: approval.id },
      data: approval,
    });
  } catch (e) {
    console.error('onApprovalChange failed:', e);
  }

  return approval;
}
