/**
 * 项目立项提交与审批通过/拒绝后的项目状态、通知处理。
 */
import { api as defaultApi } from '@/api/client';
import { createApprovalWithSteps } from '@/lib/createApprovalWithSteps';
import { ensureAcceptancePeriods } from '@/lib/projectAcceptance';

export const INITIATION_SHEET_NAME = '立项服务内容';

/** 立项审批结果同步到随立项提交的服务内容 Sheet */
async function syncInitiationSheet(approval, sheetStatus, apiClient) {
  let sheetId = null;
  try { sheetId = JSON.parse(approval?.fields || '{}').initiation_sheet_id || null; } catch { /* ignore */ }
  if (!sheetId) return;
  await apiClient.entities.ExecutionSheet.update(sheetId, { status: sheetStatus });
}

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

  await syncInitiationSheet(approval, '已通过', apiClient);
  try {
    await ensureAcceptancePeriods({ ...project, ...updated }, apiClient);
  } catch (e) {
    console.error('ensureAcceptancePeriods failed:', e);
  }

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
  await syncInitiationSheet(approval, '已拒绝', apiClient);
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
 * 立项表单统一提交：已有待立项项目直接提交；否则先创建待立项项目再提交。
 * @param {{ project?: object, newProject?: object, formData: object, serviceItems?: object[] }} payload
 */
export async function initiateProject({
  project,
  newProject,
  formData,
  serviceItems = [],
  operatorName,
  operatorDept = '',
  apiClient = defaultApi,
}) {
  let target = project;
  if (!target) {
    target = await apiClient.entities.Project.create({ ...newProject, members: [], status: '待立项' });
    await apiClient.entities.ProjectLog.create({
      project_id: target.id,
      action: '创建项目',
      detail: `${newProject.bid_id ? '关联商务项目' : '手动填写（直签）'}创建「${newProject.name}」，合同金额¥${newProject.contract_amount}`,
      operator: operatorName,
    });
  }
  return submitProjectInitiation({ project: target, formData, serviceItems, operatorName, operatorDept, apiClient });
}

/** 立项时导入的服务内容 → 「立项服务内容」Sheet（待审核，随立项审批同步状态） */
async function createInitiationSheet(project, serviceItems, apiClient) {
  const sheet = await apiClient.entities.ExecutionSheet.create({
    project_id: project.id,
    name: INITIATION_SHEET_NAME,
    status: '待审核',
  });
  for (const item of serviceItems) {
    await apiClient.entities.ExecutionItem.create({
      seq_id: item.seq_id || null,
      content: item.content,
      detail: item.detail || null,
      unit: item.unit || null,
      quantity: item.quantity ?? null,
      init_price: item.init_price ?? null,
      init_total: item.init_total ?? null,
      budget_price: item.budget_price ?? null,
      budget_total: item.budget_total ?? null,
      project_id: project.id,
      project_name: project.name,
      sheet_id: sheet.id,
      is_service_addon: true,
    });
  }
  return sheet;
}

/**
 * 待立项项目提交立项 → 更新项目字段并置为待审批，创建立项审批单。
 * serviceItems：立项表单导入的服务内容行（parseExecutionRows 结果）。
 */
export async function submitProjectInitiation({
  project,
  formData,
  serviceItems = [],
  operatorName,
  operatorDept = '',
  apiClient = defaultApi,
}) {
  if (!project?.id) throw new Error('项目不存在');
  if (project.status !== '待立项') throw new Error('仅待立项项目可提交立项审批');

  const paymentMethod = formData.payment_method || project.payment_method || '';
  const projectUpdate = {
    contract_no: formData.contract_no || null,
    start_date: formData.start_date,
    end_date: formData.end_date,
    manager: formData.manager,
    members: formData.members || [],
    payment_method: paymentMethod || null,
    status: '待审批',
  };

  const updated = await apiClient.entities.Project.update(project.id, projectUpdate);

  const sheet = serviceItems.length > 0
    ? await createInitiationSheet(project, serviceItems, apiClient)
    : null;

  const fieldsPayload = {
    项目名称: project.name,
    客户: project.customer || '-',
    合同金额: Number(project.contract_amount) || 0,
    结算方式: paymentMethod || '-',
    合同编号: formData.contract_no || '-',
    开始时间: formData.start_date,
    结束时间: formData.end_date,
    项目负责人: formData.manager,
    项目成员: (formData.members || []).join('、') || '-',
    服务内容: sheet ? `${serviceItems.length} 条` : '-',
    ...(sheet ? { initiation_sheet_id: sheet.id } : {}),
  };

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

  if (sheet) await apiClient.entities.ExecutionSheet.update(sheet.id, { approval_id: approval.id });

  await apiClient.entities.ProjectLog.create({
    project_id: project.id,
    action: '提交立项审批',
    detail: `提交立项审批，负责人 ${formData.manager}${sheet ? `，附服务内容 ${serviceItems.length} 条` : ''}`,
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
