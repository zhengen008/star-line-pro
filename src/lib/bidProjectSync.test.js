import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPendingProjectSyncFromBid,
  shouldSyncBidToProject,
  canSubmitProjectInitiation,
  listInitiatableBids,
} from './bidProjectSync.js';

describe('bidProjectSync', () => {
  it('maps bid fields to pending project sync payload', () => {
    const payload = buildPendingProjectSyncFromBid({
      project_name: '测试项目',
      customer_name: '客户A',
      project_type: '运营',
      bid_amount: 100000,
      payment_method: '月结',
      manager: '张三',
    });
    assert.deepEqual(payload, {
      name: '测试项目',
      customer: '客户A',
      project_type: '运营',
      contract_amount: 100000,
      payment_method: '月结',
      manager: '张三',
    });
  });

  it('only syncs when project is 待立项', () => {
    assert.equal(shouldSyncBidToProject({ status: '待立项' }), true);
    assert.equal(shouldSyncBidToProject({ status: '执行中' }), false);
    assert.equal(shouldSyncBidToProject({ status: '待立项', is_deleted: true }), false);
  });

  it('initiation allowed for admin or project manager', () => {
    const p = { status: '待立项', manager: '李四' };
    assert.equal(canSubmitProjectInitiation(p, { isAdmin: true, currentUserName: '别人' }), true);
    assert.equal(canSubmitProjectInitiation(p, { isAdmin: false, currentUserName: '李四' }), true);
    assert.equal(canSubmitProjectInitiation(p, { isAdmin: false, currentUserName: '别人' }), false);
    assert.equal(canSubmitProjectInitiation({ ...p, status: '执行中' }, { isAdmin: true }), false);
  });

  it('lists won bids that are not yet initiated', () => {
    const bids = [
      { id: 'b1', result: '中标' },
      { id: 'b2', result: '中标' },
      { id: 'b3', result: '中标' },
      { id: 'b4', result: '未中标' },
      { id: 'b5', result: '中标' },
    ];
    const projects = [
      { id: 'p2', bid_id: 'b2', status: '待立项' },
      { id: 'p3', bid_id: 'b3', status: '执行中' },
      { id: 'p5', bid_id: 'b5', status: '执行中', is_deleted: true },
    ];
    const result = listInitiatableBids(bids, projects);
    assert.deepEqual(result.map((r) => [r.bid.id, r.project?.id ?? null]), [
      ['b1', null],
      ['b2', 'p2'],
      ['b5', null],
    ]);
  });
});
