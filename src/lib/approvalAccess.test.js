import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getActiveApprovalStepIndex, isCurrentApprover } from './approvalAccess.js';

describe('getActiveApprovalStepIndex', () => {
  it('returns first pending approval step', () => {
    const steps = [
      { name: 'A', done: true, passed: true },
      { name: 'B', done: false, passed: null },
      { name: 'C', done: false, passed: null },
    ];
    assert.equal(getActiveApprovalStepIndex(steps), 1);
  });

  it('skips skipped and cc steps', () => {
    const steps = [
      { name: 'A', skipped: true },
      { name: 'CC', isCC: true, done: false },
      { name: 'B', done: false },
    ];
    assert.equal(getActiveApprovalStepIndex(steps), 2);
  });
});

describe('isCurrentApprover', () => {
  it('false when status is final', () => {
    assert.equal(isCurrentApprover({ status: '已通过', steps: '[]' }, { currentUser: '张三' }), false);
  });

  it('true when no steps and pending', () => {
    assert.equal(
      isCurrentApprover({ status: '待审核', steps: '[]' }, { currentUser: '张三', role: '普通员工', dept: '综合' }),
      true
    );
  });

  it('true when actor matches current user', () => {
    const item = {
      status: '审核中',
      steps: JSON.stringify([
        { name: '部门经理审批', actor: '张三', role: '部门经理', done: false, passed: null },
      ]),
    };
    assert.equal(isCurrentApprover(item, { currentUser: '张三', role: '普通员工', dept: '综合' }), true);
  });

  it('false when placeholder actor and role mismatch', () => {
    const item = {
      status: '待审核',
      dept: '综合管理',
      steps: JSON.stringify([
        { name: '部门经理审批', actor: '部门负责人', role: '部门经理', done: false, passed: null },
      ]),
    };
    assert.equal(isCurrentApprover(item, { currentUser: '张三', role: '普通员工', dept: '综合管理' }), false);
  });

  it('true when dept manager role matches', () => {
    const item = {
      status: '待审核',
      dept: '综合管理',
      steps: JSON.stringify([
        { name: '部门经理审批', actor: '部门负责人', role: '部门经理', done: false, passed: null },
      ]),
    };
    assert.equal(isCurrentApprover(item, { currentUser: '李四', role: '部门经理', dept: '综合管理' }), true);
  });
});
