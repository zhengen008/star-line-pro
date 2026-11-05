/**
 * 供应商成本 → 自动发起项目付款申请（project_payment）
 */
import { api as defaultApi } from '@/api/client';
import { createApprovalWithSteps } from '@/lib/createApprovalWithSteps';
import {
  parseSupplierCost,
  mapApprovalStatusToPaymentStatus,
  buildSupplierPaymentFields,
} from '@/lib/supplierPaymentHelpers';

export {
  parseSupplierCost,
  shouldAutoSubmitSupplierPayment,
  canEditSupplierPaymentAmount,
  mapApprovalStatusToPaymentStatus,
  buildSupplierPaymentFields,
} from '@/lib/supplierPaymentHelpers';

/**
 * 创建付款审批并回写供应商付款状态。
 */
export async function submitSupplierPaymentApproval({
  project,
  executionItem,
  supplierItem,
  applicant,
  dept = '',
  apiClient = defaultApi,
}) {
  const amount = parseSupplierCost(supplierItem.cost_detail);
  if (amount <= 0) {
    return { approval: null, supplier: supplierItem };
  }

  const fields = buildSupplierPaymentFields({
    supplierName: supplierItem.supplier_name,
    amount,
    remark: supplierItem.remark,
    executionContent: executionItem?.content || '',
    supplierItemId: supplierItem.id,
    executionItemId: executionItem?.id || supplierItem.execution_item_id,
  });

  const approval = await createApprovalWithSteps({
    title: `付款申请-${supplierItem.supplier_name}`,
    type: 'project_payment',
    type_label: '付款申请',
    applicant: applicant || '',
    dept: dept || '',
    fields: JSON.stringify(fields),
    amount,
    direction: '支出',
    project_id: project.id,
    project_name: project.name,
    related_project_id: project.id,
    cc_list: [],
  }, apiClient);

  const paymentStatus = mapApprovalStatusToPaymentStatus(approval.status);
  const updatedSupplier = await apiClient.entities.SupplierItem.update(supplierItem.id, {
    approval_id: approval.id,
    payment_status: paymentStatus,
  });

  return { approval, supplier: updatedSupplier };
}
