/**
 * 项目执行内容 / 服务增项目录过滤与默认 Tab。
 */

export const LEGACY_TAB = '__legacy__';

/** 项目内尚未归入 Sheet 的执行内容池（服务管理导入 → 仅供服务增项勾选） */
export function getProjectExecutionPool(items = []) {
  return items.filter((item) => !item.sheet_id);
}

/** 项目详情「执行内容」列表：仅已归入 Sheet 的条目（待增项池不展示） */
export function getSheetBoundItems(items = []) {
  return items.filter((item) => !!item.sheet_id);
}

/** 已提交且非「已拒绝」的目录 source_item_id，不应再出现在服务增项勾选列表 */
export function getBlockedCatalogSourceIds(projectItems = [], sheets = []) {
  const sheetStatusById = Object.fromEntries(sheets.map((s) => [s.id, s.status]));
  const locked = new Set();

  for (const item of projectItems) {
    if (item.sheet_id && item.id) {
      const sheetStatus = sheetStatusById[item.sheet_id];
      if (sheetStatus && sheetStatus !== '已拒绝') {
        locked.add(item.id);
      }
    }
    if (!item.source_item_id) continue;
    const sheetStatus = item.sheet_id ? sheetStatusById[item.sheet_id] : null;
    if (sheetStatus === '已拒绝') continue;
    locked.add(item.source_item_id);
  }

  return locked;
}

/** @deprecated 使用全量列表 + locked 状态展示，不再过滤隐藏 */
export function filterAvailableCatalog(catalog = [], projectItems = [], sheets = []) {
  const locked = getBlockedCatalogSourceIds(projectItems, sheets);
  return catalog.filter((it) => !locked.has(it.id));
}

export function isLockedCatalogItem(catalogId, projectItems = [], sheets = []) {
  return getBlockedCatalogSourceIds(projectItems, sheets).has(catalogId);
}

/** 默认展示第一条已通过的 Sheet；若无则第一条可见 Sheet；无 Sheet 时返回 null（待增项不进列表） */
export function getDefaultExecutionTab(sheets = [], _allItems = [], dismissedSheetIds = new Set()) {
  const visibleSheets = sheets.filter((s) => !dismissedSheetIds.has(s.id));
  const firstApproved = visibleSheets.find((s) => s.status === '已通过');
  if (firstApproved) return firstApproved.id;
  if (visibleSheets.length > 0) return visibleSheets[0].id;
  return null;
}

/** Sheet Tab 从左到右：按创建时间升序（新 Sheet 在右侧） */
export function sortExecutionSheetsChronologically(sheets = []) {
  return [...sheets].sort(
    (a, b) => new Date(a.created_date).getTime() - new Date(b.created_date).getTime()
  );
}

export const EXECUTION_ITEMS_PAGE_SIZE = 50;

export function paginateItems(items = [], page = 1, pageSize = EXECUTION_ITEMS_PAGE_SIZE) {
  if (items.length <= pageSize) {
    return { pageItems: items, totalPages: 1, page: 1 };
  }
  const totalPages = Math.ceil(items.length / pageSize);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    pageItems: items.slice(start, start + pageSize),
    totalPages,
    page: safePage,
  };
}

const DISMISSED_SHEETS_KEY = (projectId) => `execution-dismissed-sheets:${projectId}`;

export function loadDismissedSheetIds(projectId) {
  if (!projectId || typeof localStorage === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(DISMISSED_SHEETS_KEY(projectId));
    const ids = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(ids) ? ids : []);
  } catch {
    return new Set();
  }
}

export function saveDismissedSheetIds(projectId, ids) {
  if (!projectId || typeof localStorage === 'undefined') return;
  localStorage.setItem(DISMISSED_SHEETS_KEY(projectId), JSON.stringify([...ids]));
}
