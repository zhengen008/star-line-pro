/**
 * 审批状态 → 执行内容 Sheet 状态同步（与 submit 解耦，避免循环依赖）
 */
import { api as defaultApi } from '@/api/client';

/** 审批通过/拒绝后同步 Sheet 状态 */
export async function syncExecutionSheetStatus(approval, newApprovalStatus, apiClient = defaultApi) {
  if (approval.type !== 'project_execution_content' && approval.type_label !== '项目执行内容') return;

  let sheetId = null;
  try {
    const fields = JSON.parse(approval.fields || '{}');
    sheetId = fields.sheet_id;
  } catch { /* ignore */ }
  if (!sheetId) {
    const sheets = await apiClient.entities.ExecutionSheet.filter({ approval_id: approval.id });
    if (sheets[0]) sheetId = sheets[0].id;
  }
  if (!sheetId) return;

  let sheetStatus = newApprovalStatus;
  if (newApprovalStatus === '审核中') sheetStatus = '审核中';
  if (newApprovalStatus === '已通过') sheetStatus = '已通过';
  if (newApprovalStatus === '已拒绝') sheetStatus = '已拒绝';
  if (newApprovalStatus === '待审核') sheetStatus = '待审核';

  await apiClient.entities.ExecutionSheet.update(sheetId, { status: sheetStatus });
}
