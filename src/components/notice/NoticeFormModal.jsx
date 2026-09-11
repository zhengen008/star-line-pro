import { useState } from 'react';
import { api } from '@/api/client';
import { X, Send } from 'lucide-react';

export default function NoticeFormModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    title: '', content: '', category: '公告',
    is_pinned: false, expires_at: '', status: '已发布',
  });
  const [saving, setSaving] = useState(false);

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.title || !form.content) return;
    setSaving(true);
    const stored = localStorage.getItem('feishu_user');
    const publisher = stored ? JSON.parse(stored)?.name || '' : '';
    await api.entities.Notice.create({
      ...form,
      published_by: publisher,
      read_by: [],
      feishu_sent: false,
    });
    setSaving(false);
    onCreated();
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-[2rem] shadow-xl w-[600px] max-h-[90vh] flex flex-col animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-semibold">发布通知</h3>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-auto p-6 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground">标题 *</label>
            <input value={form.title} onChange={e => f('title', e.target.value)}
              className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="请输入通知标题..." />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">内容 *</label>
            <textarea value={form.content} onChange={e => f('content', e.target.value)}
              rows={6} className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              placeholder="请输入通知内容..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">分类</label>
              <select value={form.category} onChange={e => f('category', e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer">
                {['公告', '制度', '活动', '新闻'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">状态</label>
              <select value={form.status} onChange={e => f('status', e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer">
                <option>已发布</option>
                <option>草稿</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">有效期至（选填）</label>
              <input type="date" value={form.expires_at} onChange={e => f('expires_at', e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div onClick={() => f('is_pinned', !form.is_pinned)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${form.is_pinned ? 'bg-primary' : 'bg-secondary border border-border'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.is_pinned ? 'left-5' : 'left-0.5'}`} />
                </div>
                <span className="text-sm">置顶</span>
              </label>
            </div>
          </div>
        </div>
        <div className="flex gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="flex-1 py-2.5 bg-secondary rounded-xl text-sm hover:bg-border transition-colors">取消</button>
          <button onClick={handleSubmit} disabled={!form.title || !form.content || saving}
            className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2">
            <Send className="w-3.5 h-3.5" />
            {saving ? '发布中...' : '发布'}
          </button>
        </div>
      </div>
    </div>
  );
}