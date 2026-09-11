import prisma from '../lib/prisma.js';
import { getTenantToken } from '../lib/feishu.js';

const BASE = 'https://open.feishu.cn/open-apis';

async function fetchAuthorizedScopes(token) {
  const department_ids = [];
  const user_ids = [];
  let pageToken = '';
  do {
    const url = `${BASE}/contact/v3/scopes?user_id_type=user_id&department_id_type=open_department_id&page_size=50${pageToken ? `&page_token=${pageToken}` : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.code !== 0) break;
    if (data.data?.department_ids) department_ids.push(...data.data.department_ids);
    if (data.data?.user_ids) user_ids.push(...data.data.user_ids);
    pageToken = data.data?.page_token || '';
  } while (pageToken);
  return { department_ids, user_ids };
}

async function fetchDepartments(token, openDeptId) {
  const url = `${BASE}/contact/v3/departments?fetch_child=true&department_id_type=open_department_id&department_id=${openDeptId}&page_size=50`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  return data.data?.items || [];
}

async function fetchUsers(token, openDeptId) {
  const all = [];
  let pageToken = '';
  do {
    const url = `${BASE}/contact/v3/users?department_id_type=open_department_id&department_id=${openDeptId}&page_size=50${pageToken ? `&page_token=${pageToken}` : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.code !== 0) break;
    (data.data?.items || []).forEach(u => all.push(u));
    pageToken = data.data?.page_token || '';
  } while (pageToken);
  return all;
}

export async function syncFeishuOrg(req, res) {
  try {
    const token = await getTenantToken();
    if (!token) {
      return res.status(500).json({ error: 'Failed to get Feishu tenant token' });
    }

    const scopes = await fetchAuthorizedScopes(token);
    const authorizedDeptIds = scopes.department_ids;
    const authorizedUserIds = scopes.user_ids;

    // Sync departments
    const feishuDeptsMap = new Map();
    for (const openDeptId of authorizedDeptIds) {
      const items = await fetchDepartments(token, openDeptId);
      items.forEach(d => feishuDeptsMap.set(d.open_department_id, d));
      if (!feishuDeptsMap.has(openDeptId)) {
        const selfRes = await fetch(`${BASE}/contact/v3/departments/${openDeptId}?department_id_type=open_department_id`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const selfData = await selfRes.json();
        if (selfData.data?.department) {
          const d = selfData.data.department;
          feishuDeptsMap.set(d.open_department_id, d);
        }
      }
    }
    const feishuDepts = Array.from(feishuDeptsMap.values());
    const deptResults = { created: 0, updated: 0, total: feishuDepts.length };

    const allDepts = await prisma.department.findMany({ orderBy: { created_date: 'desc' } });

    for (const d of feishuDepts) {
      const existing = allDepts.find(e => e.feishu_dept_id === d.open_department_id);
      const payload = {
        name: d.name,
        code: d.department_id || d.open_department_id,
        feishu_dept_id: d.open_department_id,
        parent_dept_id: d.parent_department_id || '',
        member_count: d.member_count || 0,
        status: d.status?.is_deleted ? '停用' : '启用',
      };
      if (existing) {
        await prisma.department.update({ where: { id: existing.id }, data: payload });
        deptResults.updated++;
      } else {
        await prisma.department.create({ data: payload });
        deptResults.created++;
      }
    }

    // Sync users
    const userMap = new Map();
    for (const d of feishuDepts) {
      const deptUsers = await fetchUsers(token, d.open_department_id);
      deptUsers.forEach(u => userMap.set(u.user_id, u));
    }
    for (const uid of authorizedUserIds) {
      if (!userMap.has(uid)) {
        const uRes = await fetch(`${BASE}/contact/v3/users/${uid}?user_id_type=user_id&department_id_type=open_department_id`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const uData = await uRes.json();
        if (uData.data?.user) {
          const u = uData.data.user;
          userMap.set(u.user_id, u);
        }
      }
    }

    const feishuUsers = Array.from(userMap.values());
    const empResults = { created: 0, updated: 0, total: feishuUsers.length };

    const allEmployees = await prisma.employee.findMany({ orderBy: { created_date: 'desc' } });

    for (const u of feishuUsers) {
      const existing = allEmployees.find(e => e.employee_id === u.user_id);

      const deptId = u.department_ids?.[0] || '';
      const matchedDept = feishuDepts.find(d => d.open_department_id === deptId || d.department_id === deptId);
      const deptName = matchedDept?.name || '未分配';

      const payload = {
        employee_id: u.user_id,
        name: u.name,
        email: u.email || '',
        department: deptName,
        position: u.job_title || '',
        employment_type: '全职',
        status: u.status === 4 ? '离职' : '在职',
        role: '普通员工',
        join_date: u.join_time ? new Date(u.join_time * 1000).toISOString().split('T')[0] : '',
      };

      if (existing) {
        await prisma.employee.update({
          where: { id: existing.id },
          data: { ...payload, role: existing.role },
        });
        empResults.updated++;
      } else {
        await prisma.employee.create({ data: payload });
        empResults.created++;
      }
    }

    res.json({ success: true, departments: deptResults, employees: empResults });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
