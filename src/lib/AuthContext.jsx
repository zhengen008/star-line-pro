import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { api, getToken } from '@/api/client';

const AuthContext = createContext();

function getFeishuUser() {
  try { return JSON.parse(localStorage.getItem('feishu_user')); } catch { return null; }
}

export function buildFeishuOAuthUrl() {
  const APP_ID = 'cli_a92ab6bdcdf89cc8';
  const redirect = encodeURIComponent(`${window.location.origin}/feishu/callback`);
  return `https://open.feishu.cn/open-apis/authen/v1/index?app_id=${APP_ID}&redirect_uri=${redirect}&response_type=code&state=starline`;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const [feishuUser, setFeishuUser] = useState(() => getFeishuUser());
  const [currentEmployee, setCurrentEmployee] = useState(null);
  const [currentRole, setCurrentRole] = useState(null);
  const [isLoadingEmployee, setIsLoadingEmployee] = useState(true);

  useEffect(() => { checkAppState(); }, []);

  // Load current Employee + Role once we have a Feishu user
  useEffect(() => {
    const loadEmployeeAndRole = async () => {
      const fu = getFeishuUser();
      setFeishuUser(fu);
      if (!fu) { setIsLoadingEmployee(false); return; }
      try {
        const [employees, roles] = await Promise.all([
          api.entities.Employee.list('-created_date'),
          api.entities.Role.list('sort_order'),
        ]);
        const emp = employees.find(e => e.employee_id === fu.user_id || e.name === fu.name);
        setCurrentEmployee(emp || null);
        const role = emp ? roles.find(r => r.name === emp.role) : null;
        setCurrentRole(role || null);
      } catch (e) {
        console.error('Failed to load employee/role:', e);
      } finally {
        setIsLoadingEmployee(false);
      }
    };
    loadEmployeeAndRole();
    const onStorage = () => loadEmployeeAndRole();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const checkAppState = async () => {
    try {
      setAuthError(null);
      const token = getToken();
      if (token) {
        await checkUserAuth(token);
      } else {
        setIsLoadingAuth(false);
        setIsAuthenticated(false);
        setNeedsLogin(true);
      }
    } catch (error) {
      console.error('App state check failed:', error);
      setAuthError({ type: 'unknown', message: error.message });
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async (token) => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await api.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setNeedsLogin(false);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsAuthenticated(false);
      if (error.status === 401 || error.status === 403) {
        // Token expired or invalid — clear and require login
        localStorage.removeItem('oa_access_token');
        setNeedsLogin(true);
      } else {
        setAuthError({ type: 'unknown', message: error.message });
      }
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    setNeedsLogin(true);
    if (shouldRedirect) api.auth.logout(window.location.href);
    else api.auth.logout();
  };

  const navigateToLogin = () => {
    window.location.href = buildFeishuOAuthUrl();
  };

  const permissionsMatrix = useMemo(() => {
    if (!currentRole?.permissions) return {};
    try { return JSON.parse(currentRole.permissions); } catch { return {}; }
  }, [currentRole]);

  const can = useCallback((module, action) => {
    if (currentRole?.name === '管理员') return true;
    const acts = permissionsMatrix[module] || [];
    return acts.includes(action);
  }, [currentRole, permissionsMatrix]);

  const roleName = currentRole?.name || '';
  const isAdmin = roleName === '管理员';
  const isViewer = roleName === '查看者' || (!currentEmployee && !isLoadingEmployee);
  const isAuditor = roleName === '审核员';
  const currentUserName = feishuUser?.name || currentEmployee?.name || '未知用户';

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated, isLoadingAuth, authError,
      needsLogin, logout, navigateToLogin, checkAppState,
      feishuUser, currentUserName, currentEmployee, currentRole,
      roleName, isAdmin, isViewer, isAuditor, isLoadingEmployee,
      can, permissionsMatrix,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
