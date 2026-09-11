/**
 * 供应商付款审批 — 纯函数（可 node --test）
 */

export function parseSupplierCost(raw) {
  if (raw === null || raw === undefined || raw === '') return 0;
  const n = Number(String(raw).replace(/[¥,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** 有金额且当前无进行中/已通过审批时，应自动发起付款 */
export function shouldAutoSubmitSupplierPayment({ cost, payment_status }) {
  const amount = parseSupplierCost(cost);
  if (amount <= 0) return false;
  const status = payment_status || '无付款';
  return status === '无付款' || status === '已拒绝';
}

export function canEditSupplierPaymentAmount(payment_status) {
  const status = payment_status || '无付款';
  return status === '无付款' || status === '已拒绝';
}

export function mapApprovalStatusToPaymentStatus(approvalStatus) {
  if (approvalStatus === '已付款' || approvalStatus === '已通过') return '已通过';
  if (approvalStatus === '已拒绝') return '已拒绝';
  if (approvalStatus === '审核中') return '审核中';
  if (approvalStatus === '待审核') return '待审核';
  return '无付款';
}

export function buildSupplierPaymentFields({
  supplierName,
  amount,
  remark,
  executionContent,
  supplierItemId,
  executionItemId,
}) {
  const reasonParts = [`执行内容「${executionContent || '-'}」供应商付款`];
  if (remark) reasonParts.push(String(remark));
  return {
    付款金额: amount,
    付款对象: supplierName,
    付款事由: reasonParts.join('；'),
    supplier_item_id: supplierItemId,
    execution_item_id: executionItemId,
  };
}
