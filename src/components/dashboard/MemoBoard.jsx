import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, fileUrl } from '@/api/client';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, StickyNote, Trash2, Loader2, Check } from 'lucide-react';

const NOTE_COLORS = {
  yellow: { card: 'bg-amber-50 border-amber-200 hover:border-amber-300 dark:bg-amber-950/40 dark:border-amber-800/60', dot: 'bg-amber-400' },
  pink: { card: 'bg-pink-50 border-pink-200 hover:border-pink-300 dark:bg-pink-950/40 dark:border-pink-800/60', dot: 'bg-pink-400' },
  green: { card: 'bg-emerald-50 border-emerald-200 hover:border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800/60', dot: 'bg-emerald-400' },
  blue: { card: 'bg-sky-50 border-sky-200 hover:border-sky-300 dark:bg-sky-950/40 dark:border-sky-800/60', dot: 'bg-sky-400' },
  purple: { card: 'bg-violet-50 border-violet-200 hover:border-violet-300 dark:bg-violet-950/40 dark:border-violet-800/60', dot: 'bg-violet-400' },
};
const COLOR_IDS = Object.keys(NOTE_COLORS);

function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem('feishu_user'))?.name || 'User'; } catch { return 'User'; }
}

// 保存入库前：剥离图片 src 上的 ?token=，保证库里存干净的代理路径
function cleanHtml(html) {
  if (!html || !html.includes('/api/files/')) return html;
  return html.replace(/(src=")(\/api\/files\/[^"?]*)\?[^"]*/g, '$1$2');
}

function normalizeContent(html) {
  const cleaned = cleanHtml(html);
  return cleaned && cleaned !== '<p><br></p>' ? cleaned : '';
}

// 显示用：给富文本里的图片地址追加 JWT token（<img> 无法带 header）
// 兼容 /api/files/ 代理地址与旧数据里的 OSS 直连地址（aliyuncs.com）
function decorateHtml(html) {
  if (!html) return html;
  if (!html.includes('/api/files/') && !html.includes('aliyuncs.com')) return html;
  return html.replace(/(src=")([^"]+)(")/g, (m, p1, p2, p3) => `${p1}${fileUrl(p2)}${p3}`);
}

// 从富文本 HTML 中提取图片地址列表（预览用）
function extractImages(html) {
  if (!html) return [];
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return Array.from(doc.querySelectorAll('img'))
      .map(img => img.getAttribute('src'))
      .filter(Boolean);
  } catch {
    return [];
  }
}

// 去掉 HTML 标签，得到纯文本摘要（预览用）
function stripHtml(html) {
  if (!html) return '';
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}

async function uploadImage(file) {
  try {
    const { file_url } = await api.integrations.Core.UploadFile({ file, fileType: 'other' });
    return file_url;
  } catch {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
  }
}

function insertImageAtCursor(quillRef, url) {
  const editor = quillRef.current?.getEditor();
  if (!editor) return;
  let range = editor.getSelection();
  if (!range || range.length > 0) {
    const length = editor.getLength();
    range = { index: length - 1, length: 0 };
  }
  editor.insertEmbed(range.index, 'image', fileUrl(url));
  editor.setSelection(range.index + 1);
}

function MemoEditor({ memo, onSave, onColorChange, onDelete }) {
  const [draft, setDraft] = useState(() => decorateHtml(memo.content || ''));
  const [color, setColor] = useState(memo.color || 'yellow');
  const [saveStatus, setSaveStatus] = useState('saved'); // saved | saving
  const quillRef = useRef(null);
  const fileInputRef = useRef(null);
  const saveTimer = useRef(null);
  const draftRef = useRef(decorateHtml(memo.content || ''));
  // 上次成功保存的内容（用于判断是否真的发生变化，避免重复/无效保存）
  const lastSavedRef = useRef(normalizeContent(memo.content || ''));

  // 切换颜色：本地即时反馈 + 乐观更新到卡片
  const handleColor = (c) => {
    setColor(c);
    onColorChange(memo.id, c);
  };

  const doSave = async (content) => {
    const next = normalizeContent(content);
    // 内容相对上次保存无变化时不发请求（避免频繁无效保存）
    if (next === lastSavedRef.current) {
      setSaveStatus('saved');
      return;
    }
    setSaveStatus('saving');
    try {
      await onSave(memo.id, { content: next });
      lastSavedRef.current = next;
      setSaveStatus('saved');
    } catch {
      setSaveStatus('saved');
    }
  };

  const scheduleSave = (value) => {
    // 必须同步受控 value：react-quill 重渲染时会用 value 重置编辑器，
    // 若 value 不跟随输入更新，保存/切色等触发的重渲染会清掉新输入的内容
    setDraft(value);
    draftRef.current = value;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSave(value), 800);
  };

  // 关闭弹窗时兜底保存未落库的内容（只保存相对上次保存有变化的）
  useEffect(() => () => {
    clearTimeout(saveTimer.current);
    const content = normalizeContent(draftRef.current);
    if (content !== lastSavedRef.current) {
      onSave(memo.id, { content });
    }
  }, []);

  useEffect(() => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;
    const root = editor.root;
    const onPaste = async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const images = Array.from(items).filter(it => it.type.startsWith('image/'));
      if (images.length === 0) return;
      e.preventDefault();
      e.stopPropagation();
      for (const item of images) {
        const file = item.getAsFile();
        if (!file) continue;
        const url = await uploadImage(file);
        insertImageAtCursor(quillRef, url);
      }
    };
    root.addEventListener('paste', onPaste, true);
    return () => root.removeEventListener('paste', onPaste, true);
  }, []);

  const handleFilePick = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    for (const file of files) {
      const url = await uploadImage(file);
      insertImageAtCursor(quillRef, url);
    }
  };

  // 必须保持对象引用稳定：react-quill 会深度比较 modules，引用变化会销毁重建编辑器
  const modules = useMemo(() => ({
    toolbar: {
      container: [
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['image', 'clean'],
      ],
      handlers: { image: () => fileInputRef.current?.click() },
    },
  }), []);

  return (
    <>
      {/* 可滚动编辑区 */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-border/50 overflow-hidden">
          <ReactQuill
            ref={quillRef}
            theme="snow"
            value={draft}
            onChange={scheduleSave}
            modules={modules}
            placeholder="写点什么… 支持直接粘贴截图"
            className="[&_.ql-toolbar]:border-border/50 [&_.ql-container]:border-0 [&_.ql-editor]:min-h-[220px] [&_.ql-editor]:text-sm [&_.ql-editor_img]:max-w-full [&_.ql-editor_img]:rounded-lg"
          />
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFilePick} />
      </div>

      {/* 固定底部操作栏 */}
      <DialogFooter className="shrink-0 flex-row items-center justify-between gap-3 border-t border-border/50 bg-background px-6 py-4 sm:space-x-0">
        <div className="flex items-center gap-1.5">
          {COLOR_IDS.map(c => (
            <button
              key={c}
              type="button"
              title={c}
              onClick={() => handleColor(c)}
              className={`w-6 h-6 rounded-full ${NOTE_COLORS[c].dot} transition-transform hover:scale-110 ${color === c ? 'ring-2 ring-offset-2 ring-foreground/60' : ''}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {saveStatus === 'saving' ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Check className="w-3 h-3 text-green-500" />
            )}
            已自动保存
          </span>
          <button
            type="button"
            onClick={() => onDelete(memo.id)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            删除
          </button>
        </div>
      </DialogFooter>
    </>
  );
}

export default function MemoBoard() {
  const qc = useQueryClient();
  const owner = getCurrentUser();
  const [editing, setEditing] = useState(null);

  const memosKey = ['memos', owner];

  const { data: memos = [], isLoading } = useQuery({
    queryKey: memosKey,
    queryFn: () => api.entities.Memo.filter({ owner }, '-updated_date', 200),
  });

  const createMut = useMutation({
    mutationFn: (color) => api.entities.Memo.create({ owner, content: '', color }),
    onSuccess: (memo) => {
      qc.invalidateQueries({ queryKey: memosKey });
      setEditing(memo);
    },
  });

  // 乐观更新：保存后立即回显到卡片，失败自动回滚
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => api.entities.Memo.update(id, data),
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: memosKey });
      const prev = qc.getQueryData(memosKey);
      qc.setQueryData(memosKey, old => (old || []).map(m => m.id === id ? { ...m, ...data } : m));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(memosKey, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: memosKey });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.entities.Memo.delete(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: memosKey });
      const prev = qc.getQueryData(memosKey);
      qc.setQueryData(memosKey, old => (old || []).filter(m => m.id !== id));
      return { prev };
    },
    onSuccess: () => setEditing(null),
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(memosKey, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: memosKey });
    },
  });

  const handleSave = async (id, data) => {
    await updateMut.mutateAsync({ id, data });
  };

  return (
    <div className="bg-white dark:bg-[#1f2229] rounded-[2rem] p-6 shadow-sm border border-border/50">
      <div className="flex items-center justify-between mb-4 pr-8">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-base">备忘录</h3>
          <span className="text-xs text-muted-foreground">{memos.length} 条</span>
        </div>
        <button
          onClick={() => createMut.mutate('yellow')}
          disabled={createMut.isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-full text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {createMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          新建便签
        </button>
      </div>

      {isLoading ? (
        <div className="h-40 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : memos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
          <StickyNote className="w-10 h-10 opacity-20 mb-3" />
          <p className="text-xs mb-3">还没有便签，记录一条灵感吧</p>
          <button
            onClick={() => createMut.mutate('yellow')}
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-border rounded-full text-xs font-medium hover:bg-secondary transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            新建便签
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {memos.map(m => {
            const color = NOTE_COLORS[m.color] || NOTE_COLORS.yellow;
            const images = extractImages(m.content);
            const textPreview = stripHtml(m.content);
            const hasContent = !!textPreview || images.length > 0;
            return (
              <button
                key={m.id}
                onClick={() => setEditing(m)}
                className={`relative text-left rounded-2xl border p-4 min-h-[140px] flex flex-col transition-all hover:-translate-y-0.5 hover:shadow-md ${color.card}`}
              >
                {hasContent ? (
                  <div className="flex flex-col gap-2">
                    {/* 文本摘要 */}
                    {textPreview && (
                      <p className="text-xs leading-relaxed line-clamp-3 break-words">{textPreview}</p>
                    )}
                    {/* 图片缩略图：横排摆放 */}
                    {images.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {images.map((src, i) => (
                          <img
                            key={i}
                            src={fileUrl(src)}
                            alt=""
                            className="w-16 h-16 object-cover rounded-lg border border-border/50 bg-white/60 dark:bg-black/20"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">空白便签，点击编辑</p>
                )}
                <div className="mt-auto pt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{m.updated_date ? new Date(m.updated_date).toLocaleDateString('zh-CN') : ''}</span>
                  <span className={`w-2 h-2 rounded-full ${color.dot}`} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="shrink-0 px-6 pt-5 pb-3 border-b border-border/50">
            <DialogTitle>编辑便签</DialogTitle>
          </DialogHeader>
          {editing && (
            <MemoEditor
              key={editing.id}
              memo={editing}
              onSave={handleSave}
              onColorChange={(id, color) => updateMut.mutate({ id, data: { color } })}
              onDelete={(id) => deleteMut.mutate(id)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
