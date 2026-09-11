import { getAppAccessToken } from '../lib/feishu.js';

const BASE = 'https://open.feishu.cn/open-apis';

async function getDepartments(token) {
  const res = await fetch(`${BASE}/contact/v3/departments?fetch_child=true&department_id=0`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return data.data?.items || [];
}

async function getUsers(token, departmentId = '0') {
  const res = await fetch(`${BASE}/contact/v3/users?department_id=${departmentId}&page_size=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return data.data?.items || [];
}

export async function feishuContacts(req, res) {
  try {
    const appToken = await getAppAccessToken();
    const [departments, users] = await Promise.all([
      getDepartments(appToken),
      getUsers(appToken, '0'),
    ]);
    res.json({ departments, users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
