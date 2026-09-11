/**
 * Project participation helpers for approval project pickers.
 */

export function userParticipatesInProject(project, userName) {
  if (!project || !userName) return false;
  if (project.manager === userName) return true;
  const members = Array.isArray(project.members) ? project.members : [];
  return members.includes(userName);
}

/**
 * @param {Array} projects
 * @param {{ isAdmin: boolean, userName: string }} opts
 */
export function eligibleProjectsForApproval(projects, { isAdmin, userName }) {
  const list = Array.isArray(projects) ? projects : [];
  return list.filter((p) => {
    if (p?.is_deleted) return false;
    if (p?.status === '待立项') return false;
    if (isAdmin) return true;
    return userParticipatesInProject(p, userName);
  });
}
