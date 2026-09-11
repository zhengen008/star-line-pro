/**
 * 服务管理：项目可见范围、导入目标、列表过滤、批量删除规则。
 */
import { userParticipatesInProject } from './projectAccess.js';

/** 普通用户看自己参与的项目；管理员看全部（排除已删、待立项） */
export function projectsVisibleToUser(projects = [], { isAdmin, userName } = {}) {
  const list = Array.isArray(projects) ? projects : [];
  return list.filter((p) => {
    if (!p || p.is_deleted) return false;
    if (p.status === '待立项') return false;
    if (isAdmin) return true;
    return userParticipatesInProject(p, userName);
  });
}

/** 可导入执行内容的项目：可见 + 执行中/完成审批中 */
export function projectsEligibleForServiceImport(projects = [], opts = {}) {
  return projectsVisibleToUser(projects, opts).filter((p) =>
    ['执行中', '完成审批中'].includes(p.status)
  );
}

/** 列表过滤：可选项目 + 搜索 */
export function filterServiceExecutionItems(items = [], { projectFilterId = '', search = '' } = {}) {
  const q = String(search || '').trim();
  return items.filter((it) => {
    if (projectFilterId && it.project_id !== projectFilterId) return false;
    if (!q) return true;
    return (
      it.content?.includes(q) ||
      it.detail?.includes(q) ||
      it.seq_id?.includes(q) ||
      it.project_name?.includes(q)
    );
  });
}

/** 仅尚未归入 Sheet 的条目可批量删除 */
export function isServiceItemBatchDeletable(item) {
  return !item?.sheet_id;
}
