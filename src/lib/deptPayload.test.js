import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toDepartmentWritePayload } from './deptPayload.js';

describe('toDepartmentWritePayload', () => {
  it('strips computed_count and id so update payload is Prisma-safe', () => {
    const payload = toDepartmentWritePayload({
      id: 'abc',
      name: '技术部',
      code: 'TECH',
      head: '张三',
      status: '启用',
      computed_count: 12,
      created_date: '2026-01-01',
      updated_date: '2026-01-02',
    });
    assert.deepEqual(payload, {
      name: '技术部',
      code: 'TECH',
      head: '张三',
      status: '启用',
    });
    assert.equal('computed_count' in payload, false);
    assert.equal('id' in payload, false);
  });

  it('normalizes empty optional strings to null', () => {
    const payload = toDepartmentWritePayload({ name: ' 财务部 ', code: '', head: '' });
    assert.equal(payload.name, '财务部');
    assert.equal(payload.code, null);
    assert.equal(payload.head, null);
  });
});
