import { useState, useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { LayoutDashboard, Users, Shield, GitBranch, Settings, ChevronDown, Building2, ClipboardCheck, Briefcase, FolderKanban, PieChart, Megaphone, Menu, Sun, Moon, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';
import TodoCenter from './TodoCenter';
import { buildFeishuOAuthUrl } from '@/lib/AuthContext';

const NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  {
    label: '系统管理', icon: Settings, children: [
      { label: '员工管理', icon: Users, path: '/employees' },
      { label: '部门管理', icon: Building2, path: '/departments' },
      { label: '权限与角色', icon: Shield, path: '/permissions' },
    ]
  },
  {
    label: '商务管理', icon: Briefcase, children: [
      { label: '竞标管理', icon: Briefcase, path: '/business' },
      { label: '商务统计', icon: LayoutDashboard, path: '/business/stats' },
    ]
  },
  {
    label: '业务管理', icon: FolderKanban, children: [
      { label: '项目管理', icon: FolderKanban, path: '/projects' },
      { label: '服务管理', icon: ListChecks, path: '/services' },
      { label: '项目统计', icon: PieChart, path: '/project-stats' },
    ]
  },
  { label: '审批中心', icon: ClipboardCheck, path: '/approvals' },
  { label: '审批流程', icon: GitBranch, path: '/workflow' },
  { label: '通知中心', icon: Megaphone, path: '/notices' },
];

function NavItem({ item, collapsed }) {
  const location = useLocation();
  const fullUrl = location.pathname + location.search;
  const isChildActive = item.children?.some(c => {
    if (c.path.includes('?')) return fullUrl === c.path;
    return location.pathname === c.path || (c.path !== '/' && location.pathname.startsWith(c.path));
  });
  const [open, setOpen] = useState(isChildActive);

  const ItemIcon = item.icon;
  if (item.children) {
    return (
      <div title={collapsed ? item.label : undefined}>
        <button
          onClick={() => setOpen(v => !v)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
            isChildActive ? "text-foreground bg-secondary" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            collapsed && "justify-center px-0"
          )}
        >
          <ItemIcon className="w-4 h-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left line-clamp-1">{item.label}</span>
              <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", open && "rotate-180")} />
            </>
          )}
        </button>
        {open && !collapsed && (
          <div className="mt-0.5 ml-3 pl-3 border-l border-border flex flex-col gap-0.5 overflow-hidden">
            {item.children.map(child => {
              const ChildIcon = child.icon;
              return (
                <Link
                  key={child.path}
                  to={child.path}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                    (child.path.includes('?') ? fullUrl === child.path : location.pathname === child.path)
                      ? "bg-primary text-white"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <ChildIcon className="w-3.5 h-3.5 shrink-0" />
                  <span className="line-clamp-1">{child.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const active = item.path?.includes('?')
    ? fullUrl === item.path
    : (location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path)));
  return (
    <Link
      to={item.path}
      title={collapsed ? item.label : undefined}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
        active ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
        collapsed && "justify-center px-0"
      )}
    >
      <ItemIcon className="w-4 h-4 shrink-0" />
      {!collapsed && <span className="line-clamp-1">{item.label}</span>}
    </Link>
  );
}

export default function Layout() {
  const [feishuUser, setFeishuUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isDark, setIsDark] = useState(false);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  useEffect(() => {
    const stored = localStorage.getItem('feishu_user');
    if (stored) { try { setFeishuUser(JSON.parse(stored)); } catch {} }
  }, []);

  const handleLogout = () => { localStorage.removeItem('feishu_user'); localStorage.removeItem('oa_access_token'); window.location.reload(); };

  const displayName = feishuUser?.name || '未登录';
  const avatarLetter = feishuUser?.name ? feishuUser.name[0]?.toUpperCase() : '?';

  return (
    <div className="h-screen overflow-hidden bg-[#f4f5f7] dark:bg-[#14161a] flex p-4 gap-6 font-inter transition-colors duration-300">
      <aside className={cn(
        "bg-white dark:bg-[#1f2229] rounded-[2rem] flex flex-col py-6 shrink-0 self-stretch h-full shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-border/30 transition-all duration-300 overflow-hidden",
        sidebarOpen ? "w-64 px-4" : "w-20 px-2"
      )}>
        <div className={cn("flex items-center mb-10 shrink-0 transition-all overflow-hidden", sidebarOpen ? "px-3" : "justify-center px-0")}>
          {sidebarOpen ? (
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center shadow-md shrink-0">
                <span className="text-white font-bold text-lg">OC</span>
              </div>
              <div className="leading-tight">
                <span className="block font-bold text-base tracking-tight">Octopus</span>
                <span className="block text-[10px] text-muted-foreground">Starline OA</span>
              </div>
            </div>
          ) : (
            <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center shadow-md shrink-0">
              <span className="text-white font-bold text-lg">OC</span>
            </div>
          )}
        </div>
        <nav className="flex flex-col gap-1.5 flex-1 min-h-0 overflow-y-auto">
          {NAV.map((item, i) => <NavItem key={i} item={item} collapsed={!sidebarOpen} />)}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full transition-all duration-300">
        <header className="bg-transparent mb-6 px-2 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-full hover:bg-white dark:hover:bg-slate-800 text-muted-foreground transition-colors shadow-sm border border-border/20">
              <Menu className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-white dark:hover:bg-slate-800 text-muted-foreground transition-colors shadow-sm border border-border/20">
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <TodoCenter />
            <div className="w-px h-5 bg-border/60"></div>
            {feishuUser ? (
              <>
                {feishuUser.avatar_url
                  ? <img src={feishuUser.avatar_url} className="w-9 h-9 rounded-full object-cover shadow-sm" alt={displayName} />
                  : <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-sm font-semibold text-white shadow-sm">{avatarLetter}</div>
                }
                <div className="hidden md:block leading-tight">
                  <span className="text-sm font-semibold block">{displayName}</span>
                </div>
                <button onClick={handleLogout} className="text-xs text-muted-foreground hover:text-red-500 transition-colors px-3 py-1.5 rounded-full hover:bg-white border border-border/50">退出</button>
              </>
            ) : (
              <button
                onClick={() => { window.location.href = buildFeishuOAuthUrl(); }}
                className="text-xs font-medium px-3 py-1.5 rounded-full bg-primary hover:bg-primary/90 text-white transition-colors shadow-sm"
              >
                登录
              </button>
            )}
          </div>
        </header>
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden pr-2 pb-4">
          <div className="flex-1 min-h-0 animate-fade-in overflow-y-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}