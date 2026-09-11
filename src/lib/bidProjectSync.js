/**
 * 竞标 ↔ 待立项项目 字段同步与立项权限。
 */

/** 竞标商务字段 → 待立项项目可写字段（不含起止时间/成员/预算） */
export function buildPendingProjectSyncFromBid(bid = {}) {
  return {
    name: bid.project_name || '',
    customer: bid.customer_name || '待定',
    project_type: bid.project_type || '',
    contract_amount: bid.bid_amount ?? null,
    payment_method: bid.payment_method || '里程碑付款',
    manager: bid.manager || '',
  };
}

export function shouldSyncBidToProject(project) {
  return !!project && project.status === '待立项' && !project.is_deleted;
}

/**
 * 负责人（一级）或管理员可提交立项。
 * @param {object} project
 * @param {{ isAdmin?: boolean, currentUserName?: string }} ctx
 */
export function canSubmitProjectInitiation(project, { isAdmin = false, currentUserName = '' } = {}) {
  if (!project || project.status !== '待立项' || project.is_deleted) return false;
  if (isAdmin) return true;
  if (currentUserName && project.manager === currentUserName) return true;
  return false;
}
