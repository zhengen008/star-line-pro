import jwt from 'jsonwebtoken';
import { getAppAccessToken } from '../lib/feishu.js';

const BASE = 'https://open.feishu.cn/open-apis';

async function fetchUserInfo(userToken) {
  const res = await fetch(`${BASE}/authen/v1/user_info`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(data.msg);
  return data.data;
}

export async function feishuAuth(req, res) {
  try {
    const body = req.body;
    const appToken = await getAppAccessToken();

    let userToken, refreshToken, expiresIn;

    if (body.refresh_token) {
      const refreshRes = await fetch(`${BASE}/authen/v1/refresh_access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${appToken}` },
        body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: body.refresh_token }),
      });
      const refreshData = await refreshRes.json();
      if (refreshData.code !== 0) {
        return res.status(400).json({ error: refreshData.msg });
      }
      userToken = refreshData.data.access_token;
      refreshToken = refreshData.data.refresh_token;
      expiresIn = refreshData.data.expires_in;
    } else if (body.code) {
      const tokenRes = await fetch(`${BASE}/authen/v1/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${appToken}` },
        body: JSON.stringify({ grant_type: 'authorization_code', code: body.code }),
      });
      const tokenData = await tokenRes.json();
      if (tokenData.code !== 0) {
        return res.status(400).json({ error: tokenData.msg });
      }
      userToken = tokenData.data.access_token;
      refreshToken = tokenData.data.refresh_token;
      expiresIn = tokenData.data.expires_in;
    } else {
      return res.status(400).json({ error: 'Missing code or refresh_token' });
    }

    const u = await fetchUserInfo(userToken);
    const expiresAt = Date.now() + (expiresIn || 7200) * 1000;

    const user = {
      open_id: u.open_id,
      union_id: u.union_id,
      name: u.name,
      en_name: u.en_name,
      email: u.email,
      mobile: u.mobile,
      avatar_url: u.avatar_url,
      department_ids: u.department_ids || [],
      employee_no: u.employee_no,
      job_title: u.job_title,
      user_access_token: userToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
    };

    const access_token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ user, access_token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
