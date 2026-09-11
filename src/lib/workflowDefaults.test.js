import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildStepsFromWorkflow, INIT_WORKFLOWS, resolveWorkflowApprovalType } from './workflowDefaults.js';
import { createApprovalContext } from './approvalResolver.js';

describe('buildStepsFromWorkflow self-skip', () => {
  const paymentWf = INIT_WORKFLOWS.find((w) => w.approvalType === 'project_payment');

  it('skips project_manager node when applicant is project manager', () => {
    const ctx = createApprovalContext({
      departments: [{ name: '运营部', head: '张三', status: '启用' }],
      employees: [
        { name: '张三', department: '运营部', status: '在职' },
        { name: '李四', department: '运营部', status: '在职' },
      ],
      applicantDept: '运营部',
    });
    const steps = buildStepsFromWorkflow(paymentWf, {}, '张三', '张三', ctx);
    const pmStep = steps.find((s) => s.name === '项目负责人审批');
    assert.ok(pmStep);
    assert.equal(pmStep.skipped, true);
    assert.equal(pmStep.done, true);
    assert.equal(pmStep.actor, '张三');

    const deptStep = steps.find((s) => s.name === '部门负责人审批');
    assert.ok(deptStep);
    // 申请人是部门负责人时，部门节点也会跳过
    assert.equal(deptStep.skipped, true);
  });

  it('does not skip project_manager when applicant differs', () => {
    const ctx = createApprovalContext({
      departments: [{ name: '运营部', head: '王五', status: '启用' }],
      employees: [
        { name: '李四', department: '运营部', status: '在职' },
        { name: '王五', department: '运营部', status: '在职' },
      ],
      applicantDept: '运营部',
    });
    const steps = buildStepsFromWorkflow(paymentWf, {}, '李四', '张三', ctx);
    const pmStep = steps.find((s) => s.name === '项目负责人审批');
    assert.equal(pmStep.skipped, undefined);
    assert.equal(pmStep.done, false);
    assert.equal(pmStep.actor, '张三');
  });

  it('after self-skip, next pending actor is the real next approver', () => {
    const ctx = createApprovalContext({
      departments: [{ name: '运营部', head: '王五', status: '启用' }],
      employees: [
        { name: '张三', department: '运营部', status: '在职' },
        { name: '王五', department: '运营部', status: '在职' },
      ],
      applicantDept: '运营部',
    });
    // 申请人=项目负责人，但不是部门负责人
    const steps = buildStepsFromWorkflow(paymentWf, {}, '张三', '张三', ctx);
    const pending = steps.find((s) => !s.done && !s.skipped && !s.isCondition && !s.isCC);
    assert.equal(pending?.name, '部门负责人审批');
    assert.equal(pending?.actor, '王五');
  });
});

describe('resolveWorkflowApprovalType', () => {
  it('maps 项目立项 to project_initiation workflow key', () => {
    assert.equal(resolveWorkflowApprovalType('project_init', '项目立项'), 'project_initiation');
    assert.equal(resolveWorkflowApprovalType('project_initiation', '项目立项'), 'project_initiation');
  });
});
