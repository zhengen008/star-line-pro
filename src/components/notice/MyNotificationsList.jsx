/**
 * MyNotificationsList - 当前用户的站内通知列表
 * 用于 NoticeCenter 的「我的通知」标签页
 * 功能：分类筛选、归档、批量已读、点击跳转
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { Bell, ClipboardCheck, FolderKanban, Megaphone, CheckCheck, Archive, Inbox, Trash2, Award } from 'lucide-react';

const TYPE_META = {
  approval_pending: { label: '待审批', icon: ClipboardCheck, color: 'bg-yellow-100 text-yellow-700' },
  approval_result: { label: '审批结果', icon: ClipboardCheck, color: 'bg-green-100 text-green-700' },
  approval_cc: { label: '抄送', icon: ClipboardCheck, color: 'bg-blue-100 text-blue-700' },
  project_status: { label: '项目', icon: FolderKanban, color: 'bg-purple-100 text-purple-700' },
  bid_won: { label: '中标立项', icon: Award, color: 'bg-orange-100 text-orange-700' },
  notice: { label: '公告', icon: Megaphone, color: 'bg-orange-100 text-orange-700' },
  system: { label: '系统', icon: Bell, color: 'bg-gray-100 text-gray-700' },
};

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'unread', label: '未读' },
  { key: 'approval_pending', label: '待审批' },
  { key: 'approval_result', label: '审批结果' },
  { key: 'project_status', label: '项目' },
  { key: 'bid_won', label: '中标立项' },
  { key: 'notice', label: '公告' },
  { key: 'archived', label: '已归档' },
];

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

export default function MyNotificationsList({ currentUser }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filter, setFilter] = useState('all');

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['my-notifications-page', currentUser],
    queryFn: () => api.entities.Notification.filter({ recipient: currentUser }, '-created_date', 200),
    enabled: !!currentUser,
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }) => api.entities.Notification.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-notifications-page'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.entities.Notification.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-notifications-page'] }),
  });

  const markAllReadMut = useMutation({
    mutationFn: async () => {
      const unread = notifications.filter(n => !n.is_read && !n.is_archived);
      await Promise.all(unread.map(n => api.entities.Notification.update(n.id, { is_read: true })));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-notifications-page'] }),
  });

  const filtered = notifications.filter(n => {
    if (filter === 'archived') return n.is_archived;
    if (n.is_archived) return false;
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.is_read;
    return n.type === filter;
  });

  const unreadCount = notifications.filter(n => !n.is_read && !n.is_archived).length;

  const handleClick = (n) => {
    if (!n.is_read) updateMut.mutate({ id: n.id, payload: { is_read: true } });
    if (n.link) navigate(n.link);
  };

  return (
    <div className="space-y-4">
      {/* Filter chips + actions */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filter === f.key ? 'bg-foreground text-white' : 'bg-white text-muted-foreground hover:bg-secondary border border-border/50'}`}>
              {f.label}
              {f.key === 'unread' && unreadCount > 0 && <span className="ml-1 text-red-500">({unreadCount})</span>}
            </button>
          ))}
        </div>
        {unreadCount > 0 && filter !== 'archived' && (
          <button onClick={() => markAllReadMut.mutate()}
            className="text-xs text-primary hover:underline flex items-center gap-1">
            <CheckCheck className="w-3 h-3" />全部标记已读
          </button>
        )}
      </div>

      {isLoading && <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Inbox className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">{filter === 'archived' ? '暂无归档通知' : '暂无通知'}</p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(n => {
          const meta = TYPE_META[n.type] || TYPE_META.system;
          const Icon = meta.icon;
          return (
            <div key={n.id}
              className={`bg-white rounded-2xl p-4 border shadow-sm hover:shadow-md transition-all flex items-start gap-3 ${!n.is_read ? 'border-primary/30 bg-blue-50/20' : 'border-border/50'}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <button onClick={() => handleClick(n)} className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                  <h3 className={`text-sm truncate ${!n.is_read ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{n.title}</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${meta.color}`}>{meta.label}</span>
                  {n.priority === 'high' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">重要</span>}
                </div>
                {n.content && <p className="text-xs text-muted-foreground line-clamp-1">{n.content}</p>}
                <p className="text-[10px] text-muted-foreground/70 mt-1">{timeAgo(n.created_date)}{n.link && ' · 点击查看详情'}</p>
              </button>
              <div className="flex items-center gap-1 shrink-0">
                {!n.is_archived ? (
                  <button title="归档" onClick={() => updateMut.mutate({ id: n.id, payload: { is_archived: true, is_read: true } })}
                    className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button title="删除" onClick={() => deleteMut.mutate(n.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}