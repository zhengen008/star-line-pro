import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSupplierCost,
  shouldAutoSubmitSupplierPayment,
  canEditSupplierPaymentAmount,
  mapApprovalStatusToPaymentStatus,
  buildSupplierPaymentFields,
} from './supplierPaymentHelpers.js';

describe('submitSupplierPaymentApproval helpers', () => {
  it('parseSupplierCost reads numeric cost', () => {
    assert.equal(parseSupplierCost('1200.5'), 1200.5);
    assert.equal(parseSupplierCost(''), 0);
    assert.equal(parseSupplierCost(null), 0);
  });

  it('shouldAutoSubmit when cost>0 and no active approval', () => {
    assert.equal(shouldAutoSubmitSupplierPayment({ cost: 100, payment_status: '无付款' }), true);
    assert.equal(shouldAutoSubmitSupplierPayment({ cost: 100, payment_status: '已拒绝' }), true);
    assert.equal(shouldAutoSubmitSupplierPayment({ cost: 0, payment_status: '无付款' }), false);
    assert.equal(shouldAutoSubmitSupplierPayment({ cost: 100, payment_status: '待审核' }), false);
    assert.equal(shouldAutoSubmitSupplierPayment({ cost: 100, payment_status: '已通过' }), false);
  });

  it('canEditSupplierPaymentAmount locked while pending/passed', () => {
    assert.equal(canEditSupplierPaymentAmount('待审核'), false);
    assert.equal(canEditSupplierPaymentAmount('审核中'), false);
    assert.equal(canEditSupplierPaymentAmount('已通过'), false);
    assert.equal(canEditSupplierPaymentAmount('已拒绝'), true);
    assert.equal(canEditSupplierPaymentAmount('无付款'), true);
  });

  it('mapApprovalStatusToPaymentStatus', () => {
    assert.equal(mapApprovalStatusToPaymentStatus('已付款'), '已通过');
    assert.equal(mapApprovalStatusToPaymentStatus('已通过'), '已通过');
    assert.equal(mapApprovalStatusToPaymentStatus('已拒绝'), '已拒绝');
    assert.equal(mapApprovalStatusToPaymentStatus('审核中'), '审核中');
    assert.equal(mapApprovalStatusToPaymentStatus('待审核'), '待审核');
  });

  it('buildSupplierPaymentFields includes linkage ids', () => {
    const fields = buildSupplierPaymentFields({
      supplierName: '某某传媒',
      amount: 5000,
      remark: '活动投放',
      executionContent: '发布贴文3条',
      supplierItemId: 'sup1',
      executionItemId: 'ei1',
    });
    assert.equal(fields['付款对象'], '某某传媒');
    assert.equal(fields['付款金额'], 5000);
    assert.equal(fields.supplier_item_id, 'sup1');
    assert.equal(fields.execution_item_id, 'ei1');
    assert.match(fields['付款事由'], /发布贴文3条/);
  });
});
