const APP_ID = process.env.FEISHU_APP_ID;
const APP_SECRET = process.env.FEISHU_APP_SECRET;
const BASE = 'https://open.feishu.cn/open-apis';

let tenantTokenCache = { token: null, expiresAt: 0 };
let appTokenCache = { token: null, expiresAt: 0 };

export async function getTenantToken() {
  if (!APP_ID || !APP_SECRET) return null;
  if (tenantTokenCache.token && Date.now() < tenantTokenCache.expiresAt) {
    return tenantTokenCache.token;
  }
  try {
    const res = await fetch(`${BASE}/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
    });
    const data = await res.json();
    if (data.code !== 0) return null;
    tenantTokenCache = {
      token: data.tenant_access_token,
      expiresAt: Date.now() + (data.expire || 7200) * 1000 - 60000,
    };
    return data.tenant_access_token;
  } catch {
    return null;
  }
}

export async function getAppAccessToken() {
  if (!APP_ID || !APP_SECRET) return null;
  if (appTokenCache.token && Date.now() < appTokenCache.expiresAt) {
    return appTokenCache.token;
  }
  const res = await fetch(`${BASE}/auth/v3/app_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(`app_access_token failed: ${data.msg}`);
  appTokenCache = {
    token: data.app_access_token,
    expiresAt: Date.now() + (data.expire || 7200) * 1000 - 60000,
  };
  return data.app_access_token;
}

export async function pushFeishuCard(token, openId, title, content, link) {
  const elements = [{ tag: 'div', text: { tag: 'lark_md', content: (content || '').slice(0, 500) } }];
  if (link) {
    elements.push({
      tag: 'action',
      actions: [{
        tag: 'button',
        text: { tag: 'plain_text', content: '查看详情' },
        type: 'primary',
        url: link,
      }],
    });
  }
  elements.push({ tag: 'note', elements: [{ tag: 'plain_text', content: '来自 Octopus 系统通知' }] });

  await fetch(`${BASE}/im/v1/messages?receive_id_type=open_id`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      receive_id: openId,
      msg_type: 'interactive',
      content: JSON.stringify({
        config: { wide_screen_mode: true },
        header: { title: { tag: 'plain_text', content: `🔔 ${title}` }, template: 'blue' },
        elements,
      }),
    }),
  });
}
