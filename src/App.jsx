import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth, buildFeishuOAuthUrl } from '@/lib/AuthContext';
import Layout from './components/Layout';
import FeishuCallback from './pages/FeishuCallback';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Permissions from './pages/Permissions';
import WorkflowEditor from './pages/WorkflowEditor';
import ApprovalManagement from './pages/ApprovalManagement';
import DeptManagement from './pages/DeptManagement';
import GenericPage from './pages/GenericPage';
import BusinessManagement from './pages/BusinessManagement';
import BusinessStats from './pages/BusinessStats';
import ProjectManagement from './pages/ProjectManagement';
import ProjectDetail from './pages/ProjectDetail';
import ProjectStats from './pages/ProjectStats';
import NoticeCenter from './pages/NoticeCenter';
import ServiceManagement from './pages/ServiceManagement';
import { ShieldAlert } from 'lucide-react';

function LoginRequired() {
  return (
    <div className="min-h-screen bg-[#f4f5f7] dark:bg-[#14161a] flex items-center justify-center">
      <div className="text-center space-y-6">
        <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto">
          <ShieldAlert className="w-10 h-10 text-red-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">需要飞书授权登录</h1>
          <p className="text-sm text-muted-foreground max-w-sm">
            本系统仅限已授权的飞书账号登录使用，请通过飞书 OAuth 验证身份后访问。
          </p>
        </div>
        <button
          onClick={() => { window.location.href = buildFeishuOAuthUrl(); }}
          className="inline-flex items-center gap-2 px-8 py-3 bg-primary hover:bg-primary/90 text-white rounded-2xl font-medium text-sm transition-colors shadow-sm"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1 15l-4-4 1.41-1.41L11 14.17l5.59-5.59L18 10l-7 7z"/>
          </svg>
          飞书账号登录
        </button>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#f4f5f7] dark:bg-[#14161a]">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
    </div>
  );
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated, needsLogin, authError } = useAuth();

  if (isLoadingAuth) return <LoadingSpinner />;

  if (authError) {
    return (
      <div className="min-h-screen bg-[#f4f5f7] dark:bg-[#14161a] flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-600 font-medium">系统错误</p>
          <p className="text-sm text-muted-foreground">{authError.message}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-secondary rounded-xl text-sm">重试</button>
        </div>
      </div>
    );
  }

  // Callback is always accessible (needed for OAuth flow)
  const isCallbackPage = window.location.pathname.startsWith('/feishu/callback');
  if (isCallbackPage) {
    return <FeishuCallback />;
  }

  if (needsLogin || !isAuthenticated) return <LoginRequired />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/permissions" element={<Permissions />} />
        <Route path="/workflow" element={<WorkflowEditor />} />
        <Route path="/approvals" element={<ApprovalManagement />} />
        <Route path="/departments" element={<DeptManagement />} />
        <Route path="/business" element={<BusinessManagement />} />
        <Route path="/business/stats" element={<BusinessStats />} />
        <Route path="/projects" element={<ProjectManagement />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/services" element={<ServiceManagement />} />
        <Route path="/project-stats" element={<ProjectStats />} />
        <Route path="/notices" element={<NoticeCenter />} />
        <Route path="/sales" element={<GenericPage title="销售管理" />} />
        <Route path="/reports" element={<GenericPage title="报表中心" />} />
        <Route path="/settings" element={<GenericPage title="系统设置" />} />
        <Route path="/help" element={<GenericPage title="帮助中心" />} />
        <Route path="*" element={<PageNotFound />} />
      </Route>
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
