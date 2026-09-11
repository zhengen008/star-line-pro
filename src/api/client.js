const API_BASE = import.meta.env.VITE_API_BASE || '/api';
const TOKEN_KEY = 'oa_access_token';

export function setToken(t) {
  if (t) {
    localStorage.setItem(TOKEN_KEY, t);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

// 私有 OSS 文件地址统一转为携带 JWT 的代理地址。
// <a> / <img> / <iframe> 无法带 Authorization header，统一追加 ?token=。
// 兼容三种存储形态：
//   1. /api/files/<key>            新格式（代理）→ 追加 token
//   2. http(s)://*.aliyuncs.com/<key>  旧格式（OSS 直连，私有 bucket 会 AccessDenied）→ 转代理
//   3. 其他（如 base44.app 老链接）     原样返回
export function fileUrl(url) {
  if (!url || typeof url !== 'string') return url;
  const token = getToken();

  const aliyun = url.match(/^https?:\/\/[^/]+\.aliyuncs\.com\/(.+)$/);
  if (aliyun) {
    return token ? `/api/files/${aliyun[1]}?token=${encodeURIComponent(token)}` : `/api/files/${aliyun[1]}`;
  }

  if (url.startsWith('/api/files/')) {
    if (!token) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}token=${encodeURIComponent(token)}`;
  }

  return url;
}

async function request(path, { method = 'GET', body, formData } = {}) {
  const headers = {};
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (body && !formData) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: formData || (body ? JSON.stringify(body) : undefined),
  });

  if (!res.ok) {
    let errBody = {};
    try { errBody = await res.json(); } catch { /* ignore */ }
    const err = new Error(errBody.error || res.statusText);
    err.status = res.status;
    err.data = errBody;
    throw err;
  }

  return res.json();
}

// Build entity methods dynamically
const entityProxy = new Proxy({}, {
  get(_target, name) {
    const entityPath = `/entities/${name}`;
    return {
      list(sort = '-created_date', limit = 100, skip = 0) {
        return request(`${entityPath}?sort_by=${encodeURIComponent(sort)}&limit=${limit}&skip=${skip}`);
      },
      filter(query, sort = '-created_date', limit = 100, skip = 0) {
        const q = encodeURIComponent(JSON.stringify(query));
        return request(`${entityPath}?q=${q}&sort_by=${encodeURIComponent(sort)}&limit=${limit}&skip=${skip}`);
      },
      get(id) {
        return request(`${entityPath}/${id}`);
      },
      create(data) {
        return request(entityPath, { method: 'POST', body: data });
      },
      update(id, data) {
        return request(`${entityPath}/${id}`, { method: 'PUT', body: data });
      },
      delete(id) {
        return request(`${entityPath}/${id}`, { method: 'DELETE' });
      },
    };
  },
});

export const api = {
  entities: entityProxy,
  functions: {
    invoke(name, data = {}) {
      return request(`/functions/${name}`, { method: 'POST', body: data });
    },
    // 文件上传类函数（multipart/form-data）
    upload(name, formData) {
      return request(`/functions/${name}`, { method: 'POST', formData });
    },
  },
  integrations: {
    Core: {
      async UploadFile({ file, fileType }) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('fileType', fileType || 'other');
        const result = await request('/functions/ossUpload', { method: 'POST', formData: fd });
        return { file_url: result.file_url || result.url };
      },
    },
  },
  auth: {
    me() {
      return request('/auth/me');
    },
    logout(redirectUrl) {
      setToken(null);
      localStorage.removeItem('feishu_user');
      if (redirectUrl) {
        window.location.href = redirectUrl;
      }
    },
    redirectToLogin(url) {
      // Build Feishu OAuth URL
      const APP_ID = 'cli_a92ab6bdcdf89cc8';
      const redirect = encodeURIComponent(`${window.location.origin}/feishu/callback`);
      const feishuUrl = `https://open.feishu.cn/open-apis/authen/v1/index?app_id=${APP_ID}&redirect_uri=${redirect}&response_type=code&state=starline`;
      window.location.href = feishuUrl;
    },
  },
};
