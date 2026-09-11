/**
 * 项目立项提交与审批通过/拒绝后的项目状态、通知处理。
 */
import { api as defaultApi } from '@/api/client';
import { createApprovalWithSteps } from '@/lib/createApprovalWithSteps';

/** 审批通过后通知项目负责人与成员 */
export async function notifyProjectInitiationApproved(project, manager, members, apiClient = defaultApi) {
  const recipients = [manager, ...(members || [])].filter(Boolean);
  if (recipients.length === 0) return;
  await apiClient.functions.invoke('createNotification', {
    recipients,
    type: 'project_status',
    title: `项目立项成功：${project.name}`,
    content: `项目「${project.name}」立项审批已通过，已启动执行，请关注项目进展`,
    link: `/projects/${project.id}`,
    related_id: project.id,
    priority: 'high',
  });
}

/**
 * 立项审批通过后：项目 → 执行中，通知成员，归档 bid_won 通知。
 */
export async function finalizeProjectInitiationApproved({
  approval,
  project,
  operatorName = '',
  apiClient = defaultApi,
}) {
  if (!project?.id) return project;

  const updated = await apiClient.entities.Project.update(project.id, { status: '执行中' });

  await apiClient.entities.ProjectLog.create({
    project_id: project.id,
    action: '项目立项通过',
    detail: `立项审批通过，项目启动执行（审批单：${approval?.title || approval?.id || ''}）`,
    operator: operatorName,
  });

  await notifyProjectInitiationApproved(
    updated,
    updated.manager || project.manager,
    updated.members || project.members,
    apiClient
  );

  if (project.bid_id) {
    try {
      await apiClient.functions.invoke('markBidWonHandled', {
        bid_id: project.bid_id,
        project_id: project.id,
      });
    } catch (e) {
      console.error('markBidWonHandled failed:', e);
    }
  }

  return updated;
}

/** 立项审批被拒绝：恢复为待立项，可重新提交 */
export async function handleProjectInitiationRejected({
  approval,
  projectId,
  operatorName = '',
  apiClient = defaultApi,
}) {
  if (!projectId) return;
  await apiClient.entities.Project.update(projectId, { status: '待立项' });
  await apiClient.entities.ProjectLog.create({
    project_id: projectId,
    action: '立项审批被拒绝',
    detail: `立项审批被拒绝：${approval?.title || ''}，请修改后重新提交`,
    operator: operatorName,
  });
}

export function isProjectInitiationApproval(approval) {
  if (!approval) return false;
  return approval.type === 'project_initiation'
    || approval.type_label === '项目立项'
    || (approval.type === 'project_init' && approval.type_label === '项目立项');
}

/**
 * 待立项项目提交立项 → 更新项目字段并置为待审批，创建立项审批单。
 */
export async function submitProjectInitiation({
  project,
  formData,
  operatorName,
  operatorDept = '',
  apiClient = defaultApi,
}) {
  if (!project?.id) throw new Error('项目不存在');
  if (project.status !== '待立项') throw new Error('仅待立项项目可提交立项审批');

  const fieldsPayload = {
    项目名称: project.name,
    客户: project.customer || '-',
    合同编号: formData.contract_no || '-',
    开始时间: formData.start_date,
    结束时间: formData.end_date,
    成本预算: formData.budget_cost,
    项目负责人: formData.manager,
    项目成员: (formData.members || []).join('、') || '-',
  };

  const projectUpdate = {
    contract_no: formData.contract_no || null,
    start_date: formData.start_date,
    end_date: formData.end_date,
    budget_cost: formData.budget_cost,
    remaining_budget: formData.remaining_budget ?? formData.budget_cost,
    manager: formData.manager,
    members: formData.members || [],
    status: '待审批',
  };

  const updated = await apiClient.entities.Project.update(project.id, projectUpdate);

  const approval = await createApprovalWithSteps({
    title: `项目立项-${project.name}`,
    type: 'project_initiation',
    type_label: '项目立项',
    applicant: operatorName,
    dept: operatorDept || '',
    fields: JSON.stringify(fieldsPayload),
    amount: Number(project.contract_amount) || 0,
    direction: '无',
    project_id: project.id,
    project_name: project.name,
    related_project_id: project.id,
    cc_list: [],
  }, apiClient);

  await apiClient.entities.ProjectLog.create({
    project_id: project.id,
    action: '提交立项审批',
    detail: `提交立项审批，预算¥${formData.budget_cost}，负责人 ${formData.manager}`,
    operator: operatorName,
  });

  if (approval.status === '已通过') {
    await finalizeProjectInitiationApproved({
      approval,
      project: { ...updated, bid_id: project.bid_id },
      operatorName,
      apiClient,
    });
  }

  return { project: updated, approval };
}
