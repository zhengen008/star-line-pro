import { X, Send, Pin, Eye } from 'lucide-react';

export default function NoticeDetailModal({ notice, isAdmin, currentUser, onClose, onSendFeishu }) {
  const readBy = Array.isArray(notice.read_by) ? notice.read_by : [];

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-[2rem] shadow-xl w-[640px] max-h-[85vh] flex flex-col animate-fade-in">
        <div className="flex items-start justify-between px-6 py-5 border-b border-border">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {notice.is_pinned && <Pin className="w-3.5 h-3.5 text-primary" />}
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">{notice.category}</span>
              {notice.status === '草稿' && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">草稿</span>}
            </div>
            <h2 className="text-lg font-bold">{notice.title}</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {notice.published_by} · {notice.created_date ? new Date(notice.created_date).toLocaleDateString('zh-CN') : ''}
              {notice.expires_at && ` · 有效至 ${new Date(notice.expires_at).toLocaleDateString('zh-CN')}`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-secondary rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-5">
          <div className="prose prose-sm max-w-none text-sm leading-relaxed whitespace-pre-wrap text-foreground">
            {notice.content}
          </div>
        </div>

        {isAdmin && (
          <div className="px-6 py-4 border-t border-border flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Eye className="w-3.5 h-3.5" />
              <span>{readBy.length} 人已读</span>
              {readBy.length > 0 && <span className="ml-1 text-foreground">{readBy.slice(0, 5).join('、')}{readBy.length > 5 ? `等` : ''}</span>}
            </div>
            {!notice.feishu_sent && (
              <button onClick={() => { onSendFeishu(notice); onClose(); }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl text-xs font-medium hover:bg-blue-600 transition-colors">
                <Send className="w-3 h-3" /> 推送到飞书
              </button>
            )}
            {notice.feishu_sent && <span className="text-xs text-blue-500">✓ 已推送飞书</span>}
          </div>
        )}
      </div>
    </div>
  );
}