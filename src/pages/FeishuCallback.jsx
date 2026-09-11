import { useEffect, useState } from 'react';
import { api, setToken } from '@/api/client';

export default function FeishuCallback() {
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) { setStatus('error'); setMsg('未获取到授权码'); return; }

    api.functions.invoke('feishuAuth', { code })
      .then(res => {
        const user = res?.user;
        if (!user) throw new Error(res?.error || '获取用户信息失败');
        setToken(res.access_token);
        localStorage.setItem('feishu_user', JSON.stringify(user));
        setStatus('success');
        setTimeout(() => { window.location.href = '/'; }, 800);
      })
      .catch(e => { setStatus('error'); setMsg(e.message); });
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        {status === 'loading' && (
          <>
            <div className="w-10 h-10 border-4 border-lime-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm text-muted-foreground">正在获取飞书授权...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <span className="text-2xl">✓</span>
            </div>
            <p className="text-sm font-medium">登录成功，跳转中...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <span className="text-2xl">✗</span>
            </div>
            <p className="text-sm font-medium text-red-600">授权失败</p>
            <p className="text-xs text-muted-foreground">{msg}</p>
            <button onClick={() => window.location.href = '/'} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">返回首页</button>
          </>
        )}
      </div>
    </div>
  );
}