/**
 * 审批人解析：部门负责人等从 departments / employees 表读取。
 */

export function buildDeptHeadMap(departments = []) {
  const map = {};
  departments
    .filter((d) => d.status !== '停用' && d.name)
    .forEach((d) => {
      map[d.name] = d.head || '';
    });
  return map;
}

export function findEmployeeDepartment(applicantName, employees = [], fallbackDept = '') {
  if (fallbackDept) return fallbackDept;
  const emp = employees.find((e) => e.name === applicantName && e.status !== '离职');
  return emp?.department || '';
}

export function isDepartmentHead(name, departments = []) {
  if (!name) return false;
  return departments.some((d) => d.status !== '停用' && d.head === name);
}

/** 按名称关键字匹配部门（如财务） */
export function findDeptByKeyword(departments = [], keyword = '') {
  if (!keyword) return '';
  const match = departments.find(
    (d) => d.status !== '停用' && d.name && d.name.includes(keyword)
  );
  return match?.name || '';
}

export function createApprovalContext({
  departments = [],
  employees = [],
  applicantDept = '',
} = {}) {
  const activeDepts = departments.filter((d) => d.status !== '停用');
  const activeEmployees = employees.filter((e) => e.status !== '离职');
  const deptHeadMap = buildDeptHeadMap(activeDepts);

  return {
    departments: activeDepts,
    employees: activeEmployees,
    deptHeadMap,
    applicantDept,
    resolveDeptHead(deptName) {
      return deptName ? deptHeadMap[deptName] || '' : '';
    },
    findApplicantDept(applicantName) {
      return findEmployeeDepartment(applicantName, activeEmployees, applicantDept);
    },
    isDeptHead(name) {
      return isDepartmentHead(name, activeDepts);
    },
    findDeptByKeyword(keyword) {
      return findDeptByKeyword(activeDepts, keyword);
    },
  };
}
