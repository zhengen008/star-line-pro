import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { userParticipatesInProject, eligibleProjectsForApproval } from './projectAccess.js';

describe('userParticipatesInProject', () => {
  it('true when user is manager', () => {
    assert.equal(userParticipatesInProject({ manager: '张三', members: [] }, '张三'), true);
  });

  it('true when user is in members', () => {
    assert.equal(userParticipatesInProject({ manager: '李四', members: ['张三'] }, '张三'), true);
  });

  it('false when neither', () => {
    assert.equal(userParticipatesInProject({ manager: '李四', members: ['王五'] }, '张三'), false);
  });
});

describe('eligibleProjectsForApproval', () => {
  const projects = [
    { id: '1', name: 'A', manager: '张三', members: [], is_deleted: false, status: '执行中' },
    { id: '2', name: 'B', manager: '李四', members: ['张三'], is_deleted: false, status: '执行中' },
    { id: '3', name: 'C', manager: '王五', members: [], is_deleted: false, status: '执行中' },
    { id: '4', name: 'D', manager: '张三', members: [], is_deleted: true, status: '执行中' },
    { id: '5', name: 'E', manager: '张三', members: [], is_deleted: false, status: '待立项' },
  ];

  it('admin sees all non-deleted', () => {
    const list = eligibleProjectsForApproval(projects, { isAdmin: true, userName: '张三' });
    assert.deepEqual(list.map(p => p.id), ['1', '2', '3']);
  });

  it('member sees only participated non-deleted', () => {
    const list = eligibleProjectsForApproval(projects, { isAdmin: false, userName: '张三' });
    assert.deepEqual(list.map(p => p.id), ['1', '2']);
  });

  it('excludes 待立项 projects', () => {
    const list = eligibleProjectsForApproval(projects, { isAdmin: true, userName: '张三' });
    assert.equal(list.some((p) => p.status === '待立项'), false);
  });
});
