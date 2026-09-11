/**
 * TodoCenter - 顶部待办中心下拉
 * 聚合：
 *   1. 待我处理：待审批的审批单 + 业务通知（审批/项目/中标待立项）
 *   2. 系统通知：仅公告中心发布的公告（notice）/系统消息，可 × 关闭（归档）
 * 提供：分组展示、快速跳转、一键全部已读、未读总数徽章。
 */
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { Bell, ClipboardCheck, FolderKanban, Megaphone, CheckCheck, X, Inbox, Award } from 'lucide-react';

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

export default function TodoCenter() {
  const { currentUserName, currentEmployee } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('todo'); // todo | notifications
  const ref = useRef(null);
  const prevUnreadRef = useRef(null); // null = 尚未完成首次加载，不自动展开

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 我的未读通知
  const { data: notifications = [], isFetched: notifFetched } = useQuery({
    queryKey: ['my-notifications', currentUserName],
    queryFn: () => api.entities.Notification.filter(
      { recipient: currentUserName, is_archived: false },
      '-created_date',
      50
    ),
    enabled: !!currentUserName,
    refetchInterval: 60000, // 每分钟刷新
  });

  // 待我审批的审批单
  const { data: allApprovals = [], isFetched: apprFetched } = useQuery({
    queryKey: ['pending-approvals-for-me'],
    queryFn: () => api.entities.Approval.filter({ status: '待审核' }, '-created_date', 100),
    refetchInterval: 60000,
  });

  // 当前用户的角色 / 部门，用于审批匹配
  const myDept = currentEmployee?.department || '';
  const myRole = currentEmployee?.role || '';

  // —— 待我处理 ——
  // 业务通知：审批/项目/中标待立项（只要未归档就持续显示，点击已读不影响）
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
      isRead: !!n.is_read,
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
      link: `/approvals?id=${a.id}`,
      isRead: false,
    }));

  const pendingForMe = [...bizTodos, ...approvalTodos];

  // —— 系统通知（仅公告/系统）——
  const sysNotifs = notifications.filter(n => SYS_NOTIF_TYPES.includes(n.type));
  const unreadSysCount = sysNotifs.filter(n => !n.is_read).length;
  const unreadTodoCount = pendingForMe.filter(i => !i.isRead).length;
  const totalUnread = unreadTodoCount + unreadSysCount;

  // 仅当未读数增加时自动展开（数据就绪后的首次快照不弹）
  useEffect(() => {
    if (!notifFetched || !apprFetched) return;
    if (prevUnreadRef.current === null) {
      prevUnreadRef.current = totalUnread;
      return;
    }
    if (totalUnread > prevUnreadRef.current) {
      setOpen(true);
      setTab(unreadTodoCount > 0 ? 'todo' : 'notifications');
    }
    prevUnreadRef.current = totalUnread;
  }, [totalUnread, unreadTodoCount, notifFetched, apprFetched]);

  const markReadMut = useMutation({
    mutationFn: async (id) => api.entities.Notification.update(id, { is_read: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-notifications'] }),
  });

  const archiveMut = useMutation({
    mutationFn: (id) => api.entities.Notification.update(id, { is_archived: true, is_read: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-notifications'] }),
  });

  const markAllReadMut = useMutation({
    mutationFn: async () => {
      await Promise.all(unreadSysCount > 0 ? sysNotifs.filter(n => !n.is_read).map(n => api.entities.Notification.update(n.id, { is_read: true })) : []);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-notifications'] }),
  });

  const handleClickNotif = (n) => {
    if (!n.is_read) markReadMut.mutate(n.id);
    if (n.link) {
      setOpen(false);
      navigate(n.link);
    }
  };

  const handleClickTodo = (item) => {
    setOpen(false);
    if (item.kind === 'approval') {
      navigate(item.link || '/approvals');
      return;
    }
    // 业务通知：标记已读 + 跳转
    markReadMut.mutate(item.id);
    if (item.link) navigate(item.link);
    else navigate('/notices');
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-full hover:bg-white text-muted-foreground transition-colors shadow-sm border border-border/20">
        <Bell className="w-4 h-4" />
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-[#f4f5f7]">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[400px] bg-white rounded-2xl shadow-xl border border-border/50 overflow-hidden z-50 animate-fade-in">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Inbox className="w-4 h-4 text-foreground" />
              <span className="text-sm font-semibold">待办中心</span>
              {totalUnread > 0 && <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full font-medium">{totalUnread}</span>}
            </div>
            <button onClick={() => setOpen(false)} className="p-1 hover:bg-secondary rounded-lg">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border">
            <button onClick={() => setTab('todo')}
              className={`flex-1 px-4 py-2.5 text-xs font-medium relative transition-colors ${tab === 'todo' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              待我处理 {pendingForMe.length > 0 && <span className="ml-1 text-red-500">({pendingForMe.length})</span>}
              {tab === 'todo' && <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary rounded-full" />}
            </button>
            <button onClick={() => setTab('notifications')}
              className={`flex-1 px-4 py-2.5 text-xs font-medium relative transition-colors ${tab === 'notifications' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              系统通知 {unreadSysCount > 0 && <span className="ml-1 text-red-500">({unreadSysCount})</span>}
              {tab === 'notifications' && <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary rounded-full" />}
            </button>
          </div>

          {/* Content */}
          <div className="max-h-[400px] overflow-auto">
            {tab === 'todo' && (
              <>
                {pendingForMe.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <CheckCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">暂无待办事项</p>
                  </div>
                ) : (
                  <div className="py-1">
                    {pendingForMe.map(item => {
                      const Icon = item.kind === 'approval' ? ClipboardCheck : (TYPE_ICONS[item.kind] || Bell);
                      const color = item.kind === 'approval' ? 'bg-yellow-100 text-yellow-700' : (TYPE_COLORS[item.kind] || TYPE_COLORS.system);
                      return (
                        <button key={item.key} onClick={() => handleClickTodo(item)}
                          className="w-full px-4 py-3 hover:bg-secondary/50 transition-colors text-left border-b border-border/30 last:border-b-0">
                          <div className="flex items-start gap-2.5">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                {!item.isRead && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
                                <p className={`text-xs truncate ${!item.isRead ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{item.title}</p>
                              </div>
                              {item.sub && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{item.sub}</p>}
                              <p className="text-[10px] text-muted-foreground/70 mt-0.5">{timeAgo(item.time)}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {tab === 'notifications' && (
              <>
                {sysNotifs.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">暂无系统通知</p>
                  </div>
                ) : (
                  <div className="py-1">
                    {sysNotifs.slice(0, 30).map(n => {
                      const Icon = TYPE_ICONS[n.type] || Bell;
                      const color = TYPE_COLORS[n.type] || TYPE_COLORS.system;
                      return (
                        <div key={n.id} className="group flex items-center gap-1 w-full px-4 py-3 hover:bg-secondary/50 transition-colors text-left border-b border-border/30 last:border-b-0">
                          <button onClick={() => handleClickNotif(n)} className="flex-1 min-w-0 flex items-start gap-2.5 text-left">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
                                <p className={`text-xs truncate ${!n.is_read ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{n.title}</p>
                              </div>
                              {n.content && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{n.content}</p>}
                              <p className="text-[10px] text-muted-foreground/70 mt-0.5">{timeAgo(n.created_date)}</p>
                            </div>
                          </button>
                          <button onClick={() => archiveMut.mutate(n.id)} title="关闭"
                            className="shrink-0 p-1 rounded-md text-muted-foreground/40 hover:text-red-500 hover:bg-red-50 transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-border flex items-center justify-between bg-secondary/20">
            {tab === 'notifications' && unreadSysCount > 0 ? (
              <button onClick={() => markAllReadMut.mutate()}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                <CheckCheck className="w-3 h-3" />全部标记已读
              </button>
            ) : <span />}
            <button onClick={() => { setOpen(false); navigate('/notices'); }}
              className="text-xs text-primary font-medium hover:underline">
              查看全部 →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
