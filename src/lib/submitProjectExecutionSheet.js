/**
 * 项目内从服务目录勾选执行内容，创建 Sheet 并发起审批。
 */
import { api as defaultApi } from '@/api/client';
import { createApprovalWithSteps } from '@/lib/createApprovalWithSteps';
import { syncExecutionSheetStatus } from '@/lib/submitProjectExecutionSheetSync.js';

/**
 * @param {object} opts
 * @param {object} opts.project
 * @param {string} opts.sheetName
 * @param {string[]} opts.catalogItemIds
 * @param {string} opts.applicant
 * @param {string} opts.dept
 * @param {string} opts.operatorName
 * @param {typeof defaultApi} [opts.apiClient]
 */
export async function submitProjectExecutionSheet({
  project,
  sheetName,
  catalogItemIds,
  applicant,
  dept,
  operatorName,
  apiClient = defaultApi,
}) {
  if (!sheetName?.trim()) throw new Error('请填写 Sheet 名称');
  if (!catalogItemIds?.length) throw new Error('请至少选择一条执行内容');

  const catalogItems = await Promise.all(
    catalogItemIds.map((id) => apiClient.entities.ExecutionItem.filter({ id }))
  );
  const sources = catalogItems.map((rows) => rows[0]).filter(Boolean);
  if (sources.length !== catalogItemIds.length) {
    throw new Error('部分执行内容条目不存在，请刷新后重试');
  }

  const foreign = sources.filter((s) => s.project_id && s.project_id !== project.id);
  if (foreign.length > 0) {
    throw new Error('所选执行内容不属于当前项目');
  }

  const sheet = await apiClient.entities.ExecutionSheet.create({
    project_id: project.id,
    name: sheetName.trim(),
    status: '待审核',
  });

  for (const src of sources) {
    if (src.project_id === project.id && !src.sheet_id) {
      await apiClient.entities.ExecutionItem.update(src.id, { sheet_id: sheet.id });
      continue;
    }
    await apiClient.entities.ExecutionItem.create({
      project_id: project.id,
      sheet_id: sheet.id,
      source_item_id: src.id,
      seq_id: src.seq_id,
      project_name: project.name,
      content: src.content,
      detail: src.detail,
      unit: src.unit,
      quantity: src.quantity,
      init_price: src.init_price,
      init_total: src.init_total,
      budget_price: src.budget_price,
      budget_total: src.budget_total,
      is_service_addon: true,
    });
  }

  const fieldsPayload = {
    sheet_id: sheet.id,
    sheet_name: sheetName.trim(),
    item_count: sources.length,
    条目摘要: sources.map((s) => s.content).slice(0, 5).join('、') + (sources.length > 5 ? '…' : ''),
  };

  const approval = await createApprovalWithSteps({
    title: `项目执行内容-${sheetName.trim()}`,
    type: 'project_execution_content',
    type_label: '项目执行内容',
    applicant: applicant || operatorName,
    dept: dept || '',
    fields: JSON.stringify(fieldsPayload),
    amount: sources.reduce((sum, s) => sum + (Number(s.budget_total) || Number(s.init_total) || 0), 0),
    direction: '无',
    project_id: project.id,
    project_name: project.name,
    related_project_id: project.id,
    cc_list: [],
  }, apiClient);

  await apiClient.entities.ExecutionSheet.update(sheet.id, { approval_id: approval.id });
  // 全节点自跳过时 createApprovalWithSteps 会写成「已通过」，Sheet 需同步
  await syncExecutionSheetStatus(
    { ...approval, fields: JSON.stringify(fieldsPayload) },
    approval.status,
    apiClient
  );

  const autoPassed = approval.status === '已通过';
  await apiClient.entities.ProjectLog.create({
    project_id: project.id,
    action: autoPassed ? '执行内容审批自动通过' : '提交执行内容审批',
    detail: autoPassed
      ? `Sheet「${sheetName.trim()}」共 ${sources.length} 条，审批人即申请人，已自动通过`
      : `Sheet「${sheetName.trim()}」共 ${sources.length} 条，待审批`,
    operator: operatorName,
  });

  return { sheet: { ...sheet, approval_id: approval.id, status: approval.status }, approval };
}

export { syncExecutionSheetStatus } from '@/lib/submitProjectExecutionSheetSync.js';
