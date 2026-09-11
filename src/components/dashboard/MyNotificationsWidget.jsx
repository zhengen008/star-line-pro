/**
 * MyNotificationsWidget - Dashboard「我的通知」面板
 * 双 tab：
 *   待我处理：待审批的审批单 + 业务通知（审批/项目/中标待立项）
 *   系统通知：仅公告中心发布的公告（notice）/系统消息，可 × 关闭（归档）
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { Bell, ClipboardCheck, FolderKanban, Megaphone, Inbox, Award, CheckCheck, X } from 'lucide-react';

// 业务通知（进「待我处理」）
const TODO_NOTIF_TYPES = ['approval_pending', 'approval_result', 'approval_cc', 'project_status', 'bid_won'];
// 系统通知（仅公告中心发布的通知 / 系统消息）
const SYS_NOTIF_TYPES = ['notice', 'system'];

const TYPE_ICONS = {
  approval_pending: ClipboardCheck,
  approval_result: ClipboardCheck,
  approval_cc: ClipboardCheck,
  project_status: FolderKanban,
  bid_won: Award,
  notice: Megaphone,
  system: Bell,
};

const TYPE_COLORS = {
  approval_pending: 'bg-yellow-100 text-yellow-700',
  approval_result: 'bg-green-100 text-green-700',
  approval_cc: 'bg-blue-100 text-blue-700',
  project_status: 'bg-purple-100 text-purple-700',
  bid_won: 'bg-orange-100 text-orange-700',
  notice: 'bg-orange-100 text-orange-700',
  system: 'bg-gray-100 text-gray-700',
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}天前`;
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

export default function MyNotificationsWidget() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { currentUserName, currentEmployee } = useAuth();
  const [tab, setTab] = useState('todo'); // todo | notifications

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['my-notifications-widget', currentUserName],
    queryFn: () => api.entities.Notification.filter({ recipient: currentUserName, is_archived: false }, '-created_date', 50),
    enabled: !!currentUserName,
  });

  const { data: allApprovals = [] } = useQuery({
    queryKey: ['my-widget-pending-approvals'],
    queryFn: () => api.entities.Approval.filter({ status: '待审核' }, '-created_date', 100),
    refetchInterval: 60000,
  });

  const markReadMut = useMutation({
    mutationFn: (id) => api.entities.Notification.update(id, { is_read: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-notifications-widget'] }),
  });

  const archiveMut = useMutation({
    mutationFn: (id) => api.entities.Notification.update(id, { is_archived: true, is_read: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-notifications-widget'] }),
  });

  // —— 待我处理：业务通知 + 待审批审批单 ——
  const myDept = currentEmployee?.department || '';
  const myRole = currentEmployee?.role || '';

  const bizTodos = notifications
    .filter(n => TODO_NOTIF_TYPES.includes(n.type) && !n.is_archived)
    .map(n => ({
      kind: n.type,
      key: `notif-${n.id}`,
      id: n.id,
      title: n.title,
      sub: n.content || '',
      time: n.created_date,
      link: n.link || undefined,
      onClick: () => {
        markReadMut.mutate(n.id);
        if (n.link) navigate(n.link);
      },
    }));

  const approvalTodos = allApprovals
    .filter(a => {
      let steps = [];
      try { steps = JSON.parse(a.steps || '[]'); } catch {}
      const activeIdx = steps.findIndex((s, i) =>
        !s.done && !s.skipped &&
        steps.slice(0, i).filter(x => !x.skipped && !x.isCondition && !x.isCC).every(x => x.done)
      );
      if (activeIdx < 0) return false;
      const step = steps[activeIdx];
      if (!step) return false;
      return step.actor === currentUserName ||
             step.role === myRole ||
             (step.role === '部门经理' && a.dept === myDept && myRole === '部门经理');
    })
    .map(a => ({
      kind: 'approval',
      key: `appr-${a.id}`,
      title: a.title,
      sub: `${a.applicant} · ${a.type_label}${a.amount > 0 ? ` ${a.direction === '收入' ? '+' : '-'}¥${a.amount.toLocaleString()}` : ''}`,
      time: a.created_date,
      onClick: () => navigate(`/approvals?id=${a.id}`),
    }));

  const todoItems = [...bizTodos, ...approvalTodos];

  // —— 系统通知（仅公告/系统）——
  const sysNotifs = notifications.filter(n => SYS_NOTIF_TYPES.includes(n.type));
  const unreadSysCount = sysNotifs.filter(n => !n.is_read).length;

  const handleSysClick = (n) => {
    if (!n.is_read) markReadMut.mutate(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="bg-white rounded-[2rem] shadow-sm border border-border/50 flex flex-col">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-base">我的通知</h3>
          {todoItems.length + unreadSysCount > 0 && (
            <span className="min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
              {todoItems.length + unreadSysCount}
            </span>
          )}
        </div>
        <button onClick={() => navigate('/notices')} className="text-xs text-primary hover:underline">查看全部</button>
      </div>

      {/* Tabs（与待办中心一致） */}
      <div className="flex border-b border-border px-6">
        <button onClick={() => setTab('todo')}
          className={`flex-1 px-4 py-2.5 text-xs font-medium relative transition-colors ${tab === 'todo' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          待我处理 {todoItems.length > 0 && <span className="ml-1 text-red-500">({todoItems.length})</span>}
          {tab === 'todo' && <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary rounded-full" />}
        </button>
        <button onClick={() => setTab('notifications')}
          className={`flex-1 px-4 py-2.5 text-xs font-medium relative transition-colors ${tab === 'notifications' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          系统通知 {unreadSysCount > 0 && <span className="ml-1 text-red-500">({unreadSysCount})</span>}
          {tab === 'notifications' && <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary rounded-full" />}
        </button>
      </div>

      {/* Content */}
      <div className="px-3 py-3 min-h-[180px]">
        {tab === 'todo' && (
          isLoading ? (
            <div className="flex items-center justify-center py-12"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : todoItems.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <CheckCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">暂无待办事项</p>
            </div>
          ) : (
            <div className="space-y-1">
              {todoItems.slice(0, 6).map(item => {
                const Icon = item.kind === 'approval' ? ClipboardCheck : (TYPE_ICONS[item.kind] || Bell);
                const color = item.kind === 'approval' ? 'bg-yellow-100 text-yellow-700' : (TYPE_COLORS[item.kind] || TYPE_COLORS.system);
                return (
                  <button key={item.key} onClick={item.onClick}
                    className="w-full flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-secondary/50 transition-colors text-left">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{item.title}</p>
                      {item.sub && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{item.sub}</p>}
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">{timeAgo(item.time)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )
        )}

        {tab === 'notifications' && (
          isLoading ? (
            <div className="flex items-center justify-center py-12"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : sysNotifs.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <Inbox className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">暂无系统通知</p>
            </div>
          ) : (
            <div className="space-y-1">
              {sysNotifs.slice(0, 6).map(n => {
                const Icon = TYPE_ICONS[n.type] || Bell;
                const color = TYPE_COLORS[n.type] || TYPE_COLORS.system;
                return (
                  <div key={n.id}
                    className={`group flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-secondary/50 transition-colors ${!n.is_read ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''}`}>
                    <button onClick={() => handleSysClick(n)} className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
                            <span className={`text-xs truncate ${!n.is_read ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{n.title}</span>
                          </div>
                          {n.content && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{n.content}</p>}
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5">{timeAgo(n.created_date)}</p>
                        </div>
                      </div>
                    </button>
                    {/* × 关闭（归档） */}
                    <button onClick={() => archiveMut.mutate(n.id)} title="关闭"
                      className="shrink-0 p-1 rounded-md text-muted-foreground/50 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}
