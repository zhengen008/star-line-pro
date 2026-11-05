import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import XLSX from 'xlsx';
import { parseExecutionRows } from './executionRows.js';

const here = dirname(fileURLToPath(import.meta.url));

function bufferFromRows(rows) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'S1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

describe('parseExecutionRows', () => {
  it('parses the shipped import template', () => {
    const buf = readFileSync(resolve(here, '../../../public/templates/execution-items-template.xlsx'));
    const { rows, skipped, total } = parseExecutionRows(buf);
    assert.equal(total, 2);
    assert.equal(skipped, 0);
    assert.deepEqual(rows[0], {
      seq_id: '1',
      project_name: '示例项目（可与实际项目名不同，导入时以所选项目为准）',
      content: '活动策划执行',
      detail: '包含方案设计、物料准备与现场执行',
      unit: '项',
      quantity: 2,
      init_price: 50000,
      init_total: 100000,
      budget_price: 45000,
      budget_total: 90000,
    });
  });

  it('skips rows without content and strips currency formatting', () => {
    const { rows, skipped } = parseExecutionRows(bufferFromRows([
      { '内容': '', '数量': 1 },
      { '序号': 7, '内容': '物料', '立项金额总价（含税）': '¥1,200' },
    ]));
    assert.equal(skipped, 1);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].seq_id, '7');
    assert.equal(rows[0].init_total, 1200);
    assert.equal(rows[0].quantity, null);
  });

  it('throws a readable error for an empty sheet', () => {
    assert.throws(() => parseExecutionRows(bufferFromRows([])), /没有数据行/);
  });
});
