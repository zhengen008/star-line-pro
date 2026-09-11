import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  projectsVisibleToUser,
  projectsEligibleForServiceImport,
  filterServiceExecutionItems,
  isServiceItemBatchDeletable,
} from './serviceManagementAccess.js';

const projects = [
  { id: '1', name: 'A', manager: '张三', members: [], is_deleted: false, status: '执行中' },
  { id: '2', name: 'B', manager: '李四', members: ['张三'], is_deleted: false, status: '完成审批中' },
  { id: '3', name: 'C', manager: '王五', members: [], is_deleted: false, status: '执行中' },
  { id: '4', name: 'D', manager: '张三', members: [], is_deleted: true, status: '执行中' },
  { id: '5', name: 'E', manager: '张三', members: [], is_deleted: false, status: '待立项' },
  { id: '6', name: 'F', manager: '张三', members: [], is_deleted: false, status: '待审批' },
];

describe('projectsVisibleToUser', () => {
  it('admin sees all non-deleted except 待立项', () => {
    const list = projectsVisibleToUser(projects, { isAdmin: true, userName: '张三' });
    assert.deepEqual(list.map((p) => p.id), ['1', '2', '3', '6']);
  });

  it('member only sees participated projects', () => {
    const list = projectsVisibleToUser(projects, { isAdmin: false, userName: '张三' });
    assert.deepEqual(list.map((p) => p.id), ['1', '2', '6']);
  });
});

describe('projectsEligibleForServiceImport', () => {
  it('only 执行中 / 完成审批中 among visible', () => {
    const list = projectsEligibleForServiceImport(projects, { isAdmin: false, userName: '张三' });
    assert.deepEqual(list.map((p) => p.id), ['1', '2']);
  });
});

describe('filterServiceExecutionItems', () => {
  const items = [
    { id: 'i1', project_id: '1', content: '印刷', sheet_id: null },
    { id: 'i2', project_id: '2', content: '搭建', sheet_id: 's1' },
    { id: 'i3', project_id: '1', content: '搭建辅材', sheet_id: null },
  ];

  it('returns all when no project filter', () => {
    assert.equal(filterServiceExecutionItems(items, { projectFilterId: '' }).length, 3);
  });

  it('filters by project and search', () => {
    const list = filterServiceExecutionItems(items, { projectFilterId: '1', search: '搭建' });
    assert.deepEqual(list.map((i) => i.id), ['i3']);
  });
});

describe('isServiceItemBatchDeletable', () => {
  it('true only when sheet_id empty', () => {
    assert.equal(isServiceItemBatchDeletable({ sheet_id: null }), true);
    assert.equal(isServiceItemBatchDeletable({ sheet_id: '' }), true);
    assert.equal(isServiceItemBatchDeletable({ sheet_id: 's1' }), false);
  });
});
