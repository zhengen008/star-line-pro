import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Bell, Pin, Plus, Trash2, Send, Eye, X, Megaphone, BookOpen, Zap, Newspaper, CheckCheck, Inbox } from 'lucide-react';
import NoticeFormModal from '../components/notice/NoticeFormModal';
import NoticeDetailModal from '../components/notice/NoticeDetailModal';
import MyNotificationsList from '../components/notice/MyNotificationsList';

const CATEGORY_ICONS = {
  公告: Megaphone,
  制度: BookOpen,
  活动: Zap,
  新闻: Newspaper,
};

const CATEGORY_COLORS = {
  公告: 'bg-blue-100 text-blue-700',
  制度: 'bg-purple-100 text-purple-700',
  活动: 'bg-orange-100 text-orange-700',
  新闻: 'bg-green-100 text-green-700',
};

// Determine admin from feishu_user or api user
function useIsAdmin() {
  const stored = localStorage.getItem('feishu_user');
  if (stored) {
    try { const u = JSON.parse(stored); return !!u; } catch {}
  }
  return false;
}

export default function NoticeCenter() {
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();
  const [filterCat, setFilterCat] = useState('全部');
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState(null);
  const [topTab, setTopTab] = useState('my'); // my | broadcast

  const { data: notices = [], isLoading } = useQuery({
    queryKey: ['notices'],
    queryFn: () => api.entities.Notice.list('-created_date'),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.entities.Notice.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notices'] }),
  });

  const sendFeishuMut = useMutation({
    mutationFn: async (notice) => {
      await api.functions.invoke('sendFeishuNotice', { notice_id: notice.id, title: notice.title, content: notice.content });
      return api.entities.Notice.update(notice.id, { feishu_sent: true });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notices'] }),
  });

  const markReadMut = useMutation({
    mutationFn: async (notice) => {
      const stored = localStorage.getItem('feishu_user');
      const me = stored ? JSON.parse(stored)?.name : 'User';
      const readBy = Array.isArray(notice.read_by) ? notice.read_by : [];
      if (readBy.includes(me)) return;
      return api.entities.Notice.update(notice.id, { read_by: [...readBy, me] });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notices'] }),
  });

  const currentUser = (() => {
    const stored = localStorage.getItem('feishu_user');
    if (stored) { try { return JSON.parse(stored)?.name || 'User'; } catch {} }
    return 'User';
  })();

  const cats = ['全部', '公告', '制度', '活动', '新闻'];
  const now = new Date();

  const filtered = notices.filter(n => {
    if (n.status !== '已发布') return isAdmin;
    if (n.expires_at && new Date(n.expires_at) < now) return isAdmin;
    if (filterCat !== '全部' && n.category !== filterCat) return false;
    return true;
  });

  const pinned = filtered.filter(n => n.is_pinned);
  const normal = filtered.filter(n => !n.is_pinned);

  const handleOpen = (notice) => {
    setDetail(notice);
    markReadMut.mutate(notice);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">通知中心</h1>
          <p className="text-sm text-muted-foreground mt-0.5">我的待办通知 与 公司公告</p>
        </div>
        {isAdmin && topTab === 'broadcast' && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-2xl text-sm font-medium hover:opacity-90 transition-opacity shadow-sm">
            <Plus className="w-4 h-4" /> 发布通知
          </button>
        )}
      </div>

      {/* Top tabs */}
      <div className="flex gap-1 border-b border-border">
        <button onClick={() => setTopTab('my')}
          className={`px-4 py-2 text-sm font-medium relative transition-colors flex items-center gap-1.5 ${topTab === 'my' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          <Inbox className="w-4 h-4" /> 我的通知
          {topTab === 'my' && <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />}
        </button>
        <button onClick={() => setTopTab('broadcast')}
          className={`px-4 py-2 text-sm font-medium relative transition-colors flex items-center gap-1.5 ${topTab === 'broadcast' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          <Megaphone className="w-4 h-4" /> 公司公告
          {topTab === 'broadcast' && <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />}
        </button>
      </div>

      {topTab === 'my' && <MyNotificationsList currentUser={currentUser} />}

      {topTab === 'broadcast' && <>
      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        {cats.map(c => (
          <button key={c} onClick={() => setFilterCat(c)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filterCat === c ? 'bg-foreground text-white' : 'bg-white text-muted-foreground hover:bg-secondary border border-border/50'}`}>
            {c}
          </button>
        ))}
      </div>

      {isLoading && <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}

      {/* Pinned */}
      {pinned.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Pin className="w-3 h-3" /> 置顶
          </p>
          {pinned.map(n => <NoticeRow key={n.id} notice={n} isAdmin={isAdmin} currentUser={currentUser} onOpen={handleOpen} onDelete={deleteMut.mutate} onSendFeishu={sendFeishuMut.mutate} pinned />)}
        </div>
      )}

      {/* Normal */}
      {normal.length > 0 && (
        <div className="space-y-3">
          {normal.map(n => <NoticeRow key={n.id} notice={n} isAdmin={isAdmin} currentUser={currentUser} onOpen={handleOpen} onDelete={deleteMut.mutate} onSendFeishu={sendFeishuMut.mutate} />)}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <Bell className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">暂无通知</p>
        </div>
      )}
      </>}

      {showForm && <NoticeFormModal onClose={() => setShowForm(false)} onCreated={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ['notices'] }); }} />}
      {detail && <NoticeDetailModal notice={detail} isAdmin={isAdmin} currentUser={currentUser} onClose={() => setDetail(null)} onSendFeishu={sendFeishuMut.mutate} />}
    </div>
  );
}

function NoticeRow({ notice, isAdmin, currentUser, onOpen, onDelete, onSendFeishu, pinned }) {
  const CatIcon = CATEGORY_ICONS[notice.category] || Bell;
  const catColor = CATEGORY_COLORS[notice.category] || 'bg-gray-100 text-gray-700';
  const readBy = Array.isArray(notice.read_by) ? notice.read_by : [];
  const isRead = readBy.includes(currentUser);
  const isExpired = notice.expires_at && new Date(notice.expires_at) < new Date();

  return (
    <div onClick={() => onOpen(notice)}
      className={`bg-white rounded-2xl p-5 border shadow-sm hover:shadow-md transition-all cursor-pointer flex items-start gap-4 ${pinned ? 'border-primary/30 bg-primary/5' : 'border-border/50'} ${isExpired ? 'opacity-60' : ''}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${catColor}`}>
        <CatIcon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {!isRead && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
          <h3 className={`font-semibold text-sm truncate ${!isRead ? 'text-foreground' : 'text-muted-foreground'}`}>{notice.title}</h3>
          {notice.is_pinned && <Pin className="w-3 h-3 text-primary shrink-0" />}
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${catColor}`}>{notice.category}</span>
          {notice.status === '草稿' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">草稿</span>}
          {isExpired && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">已过期</span>}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-1">{notice.content?.replace(/<[^>]+>/g, '')}</p>
        <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
          <span>{notice.published_by}</span>
          <span>·</span>
          <span>{notice.created_date ? new Date(notice.created_date).toLocaleDateString('zh-CN') : ''}</span>
          {notice.expires_at && <><span>·</span><span>有效至 {new Date(notice.expires_at).toLocaleDateString('zh-CN')}</span></>}
          {isAdmin && <><span>·</span><Eye className="w-3 h-3" /><span>{readBy.length} 已读</span></>}
          {notice.feishu_sent && <><span>·</span><span className="text-blue-500">已推送飞书</span></>}
        </div>
      </div>
      {isAdmin && (
        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          {!notice.feishu_sent && (
            <button title="推送到飞书" onClick={() => onSendFeishu(notice)}
              className="p-2 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors">
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
          <button title="删除" onClick={() => onDelete(notice.id)}
            className="p-2 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}