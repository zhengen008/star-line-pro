import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getBlockedCatalogSourceIds,
  isLockedCatalogItem,
  getDefaultExecutionTab,
  sortExecutionSheetsChronologically,
  paginateItems,
  loadDismissedSheetIds,
  saveDismissedSheetIds,
  EXECUTION_ITEMS_PAGE_SIZE,
} from './executionCatalogFilter.js';

describe('executionCatalogFilter', () => {
  it('blocks catalog ids from non-rejected sheets', () => {
    const blocked = getBlockedCatalogSourceIds(
      [
        { id: 'i1', source_item_id: 'cat1', sheet_id: 's1' },
        { id: 'i2', source_item_id: 'cat2', sheet_id: 's2' },
      ],
      [
        { id: 's1', status: '已通过' },
        { id: 's2', status: '已拒绝' },
      ]
    );
    assert.deepEqual([...blocked].sort(), ['cat1', 'i1']);
  });

  it('getProjectExecutionPool returns items without sheet_id', async () => {
    const { getProjectExecutionPool } = await import('./executionCatalogFilter.js');
    const pool = getProjectExecutionPool([
      { id: 'a', sheet_id: null },
      { id: 'b', sheet_id: 's1' },
    ]);
    assert.deepEqual(pool.map((i) => i.id), ['a']);
  });

  it('isLockedCatalogItem identifies submitted non-rejected items', () => {
    assert.equal(
      isLockedCatalogItem(
        'cat1',
        [{ source_item_id: 'cat1', sheet_id: 's1' }],
        [{ id: 's1', status: '已通过' }]
      ),
      true
    );
    assert.equal(
      isLockedCatalogItem(
        'cat2',
        [{ source_item_id: 'cat2', sheet_id: 's2' }],
        [{ id: 's2', status: '已拒绝' }]
      ),
      false
    );
  });

  it('getDefaultExecutionTab prefers first approved sheet', () => {
    const tab = getDefaultExecutionTab(
      [
        { id: 's-pending', status: '待审核' },
        { id: 's-approved', status: '已通过' },
      ],
      []
    );
    assert.equal(tab, 's-approved');
  });

  it('getDefaultExecutionTab ignores pending pool items without sheets', () => {
    // 服务管理导入的待增项不应形成「历史导入」Tab
    assert.equal(getDefaultExecutionTab([], [{ sheet_id: null }]), null);
  });

  it('getSheetBoundItems excludes pending pool (no sheet_id)', async () => {
    const { getSheetBoundItems } = await import('./executionCatalogFilter.js');
    const list = getSheetBoundItems([
      { id: 'a', sheet_id: null },
      { id: 'b', sheet_id: 's1' },
    ]);
    assert.deepEqual(list.map((i) => i.id), ['b']);
  });

  it('sortExecutionSheetsChronologically orders oldest first', () => {
    const sorted = sortExecutionSheetsChronologically([
      { id: 'b', created_date: '2026-01-02T00:00:00Z' },
      { id: 'a', created_date: '2026-01-01T00:00:00Z' },
    ]);
    assert.deepEqual(sorted.map((s) => s.id), ['a', 'b']);
  });

  it('paginateItems returns slices when over page size', () => {
    const items = Array.from({ length: 55 }, (_, i) => ({ id: String(i) }));
    const p1 = paginateItems(items, 1, 50);
    assert.equal(p1.pageItems.length, 50);
    assert.equal(p1.totalPages, 2);
    const p2 = paginateItems(items, 2, 50);
    assert.equal(p2.pageItems.length, 5);
  });

  it('getDefaultExecutionTab skips dismissed sheets', () => {
    const tab = getDefaultExecutionTab(
      [
        { id: 's-rejected', status: '已拒绝' },
        { id: 's-approved', status: '已通过' },
      ],
      [],
      new Set(['s-rejected'])
    );
    assert.equal(tab, 's-approved');
  });
});
