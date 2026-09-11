// Feishu login guard with silent SSO support inside Feishu client
import { useEffect, useState } from 'react';
import { api, setToken } from '@/api/client';

const APP_ID = 'cli_a92ab6bdcdf89cc8';

function getRedirectUri() {
  return `${window.location.origin}/feishu/callback`;
}

function buildFeishuOAuthUrl() {
  const redirect = encodeURIComponent(getRedirectUri());
  return `https://open.feishu.cn/open-apis/authen/v1/index?app_id=${APP_ID}&redirect_uri=${redirect}&response_type=code&state=starline`;
}

// Detect if running inside Feishu client
function isInFeishuClient() {
  return /lark|feishu/i.test(navigator.userAgent);
}

// Try silent login via Feishu JSAPI tt.requestAuthCode
async function getSilentCode() {
  return new Promise((resolve, reject) => {
    if (!window.tt || typeof window.tt.requestAuthCode !== 'function') {
      return reject(new Error('tt.requestAuthCode not available'));
    }
    window.tt.requestAuthCode({
      appId: APP_ID,
      success(res) { resolve(res.code); },
      fail(err) { reject(new Error(err.errMsg || 'requestAuthCode failed')); },
    });
  });
}

// Check and refresh token if expired
async function ensureValidToken(user) {
  if (!user.expires_at || !user.refresh_token) return user;
  // Refresh if token expires within 5 minutes
  if (Date.now() < user.expires_at - 5 * 60 * 1000) return user;
  try {
    const res = await api.functions.invoke('feishuAuth', { refresh_token: user.refresh_token });
    const refreshed = res?.user;
    if (!refreshed) throw new Error('refresh failed');
    setToken(res.access_token);
    localStorage.setItem('feishu_user', JSON.stringify(refreshed));
    return refreshed;
  } catch {
    // Refresh failed, force re-login
    localStorage.removeItem('feishu_user');
    return null;
  }
}

export default function FeishuLoginGuard({ children }) {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const stored = localStorage.getItem('feishu_user');
      if (stored) {
        try {
          const user = JSON.parse(stored);
          const validUser = await ensureValidToken(user);
          if (validUser) {
            setAuthed(true);
            return;
          }
        } catch (e) {}
      }
      
      window.location.href = buildFeishuOAuthUrl();
    };
    checkAuth();
  }, []);

  if (!authed) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sm text-muted-foreground">正在验证登录...</p>
      </div>
    );
  }

  return children;
}

export { buildFeishuOAuthUrl };