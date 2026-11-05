/**
 * 项目验收期次的生成 / 重建（读写 ProjectAcceptance）。
 */
import { api as defaultApi } from '@/api/client';
import { buildAcceptancePeriods } from '@/lib/acceptancePeriods';

async function createPeriods(project, apiClient) {
  const periods = buildAcceptancePeriods({
    startDate: project.start_date,
    endDate: project.end_date,
    paymentMethod: project.payment_method,
    contractAmount: project.contract_amount,
  });
  const created = [];
  for (const p of periods) {
    created.push(await apiClient.entities.ProjectAcceptance.create({
      ...p,
      project_id: project.id,
      status: '待验收',
      invoice_status: '未开票',
    }));
  }
  return created;
}

/** 项目尚无验收期次时按起止日期与结算方式生成；已有则原样返回。 */
export async function ensureAcceptancePeriods(project, apiClient = defaultApi) {
  if (!project?.id) return [];
  const existing = await apiClient.entities.ProjectAcceptance.filter({ project_id: project.id }, 'seq', 500);
  if (existing.length > 0) return existing;
  return createPeriods(project, apiClient);
}

/** 所有期次均未验收时，删除后按当前项目信息重建。 */
export async function regenerateAcceptancePeriods(project, apiClient = defaultApi) {
  const existing = await apiClient.entities.ProjectAcceptance.filter({ project_id: project.id }, 'seq', 500);
  if (existing.some((r) => r.status === '已验收')) {
    throw new Error('已有期次完成验收，不能重新生成');
  }
  for (const r of existing) await apiClient.entities.ProjectAcceptance.delete(r.id);
  return createPeriods(project, apiClient);
}
