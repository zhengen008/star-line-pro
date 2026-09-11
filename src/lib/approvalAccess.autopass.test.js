import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAutoPassStatus, getActiveApprovalStepIndex } from './approvalAccess.js';

describe('resolveAutoPassStatus', () => {
  it('returns 已通过 when every approval node is self-skipped', () => {
    const steps = [
      { name: 'Boss审批', actor: '郑晓恩', done: true, passed: true, skipped: true },
    ];
    assert.equal(getActiveApprovalStepIndex(steps), -1);
    assert.equal(resolveAutoPassStatus(steps), '已通过');
  });

  it('returns 已通过 when all approval nodes are done/skipped mix with none pending', () => {
    const steps = [
      { name: 'A', done: true, passed: true, skipped: true },
      { name: 'B', done: true, passed: true, skipped: true },
      { name: '抄送', isCC: true, done: false },
    ];
    assert.equal(resolveAutoPassStatus(steps), '已通过');
  });

  it('keeps 待审核 when a pending approval node remains', () => {
    const steps = [
      { name: 'A', done: true, passed: true, skipped: true },
      { name: 'B', actor: '李四', done: false, passed: null },
    ];
    assert.equal(resolveAutoPassStatus(steps, '待审核'), '待审核');
  });

  it('keeps fallback when steps empty', () => {
    assert.equal(resolveAutoPassStatus([], '待审核'), '待审核');
  });
});
