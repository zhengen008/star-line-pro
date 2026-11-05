/**
 * ServiceItemsImporter - 立项表单内的服务内容：下载模板 / 上传 Excel 预览 / 删除单行
 */
import { useRef, useState } from 'react';
import { Download, Upload, Loader2, X } from 'lucide-react';
import { api } from '@/api/client';
import { EXECUTION_TEMPLATE_URL, EXECUTION_TEMPLATE_NAME } from '@/lib/executionTemplate';
import { formLabelClass } from '@/lib/formStyles';

const money = (v) => (v === null || v === undefined || v === '' ? '-' : `¥${Number(v).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`);

export function TemplateDownloadLink({ className = '' }) {
  return (
    <a
      href={EXECUTION_TEMPLATE_URL}
      download={EXECUTION_TEMPLATE_NAME}
      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-secondary hover:bg-border transition-colors ${className}`}
    >
      <Download className="w-3.5 h-3.5" />下载导入模板
    </a>
  );
}

export default function ServiceItemsImporter({ items, onChange }) {
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('dry_run', '1');
      const res = await api.functions.upload('importExecutionItems', fd);
      onChange(res.rows || []);
      setMessage(`已读取 ${res.rows?.length || 0} 条${res.skipped ? `，跳过 ${res.skipped} 条无内容行` : ''}`);
    } catch (err) {
      setError(err.data?.error || err.message || '解析失败');
    } finally {
      setLoading(false);
    }
  };

  const removeAt = (idx) => onChange(items.filter((_, i) => i !== idx));
  const initTotal = items.reduce((s, it) => s + (Number(it.init_total) || 0), 0);
  const budgetTotal = items.reduce((s, it) => s + (Number(it.budget_total) || 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className={formLabelClass}>服务内容（可选，随立项一起审批）</label>
        <div className="flex items-center gap-2">
          <TemplateDownloadLink />
          <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {items.length ? '重新上传' : '上传 Excel'}
          </button>
        </div>
      </div>
      {message && <p className="mt-1 text-xs text-muted-foreground">{message}</p>}
      {error && <p className="mt-1 px-3 py-2 rounded-lg text-xs bg-red-50 text-red-700">{error}</p>}
      {items.length > 0 && (
        <div className="mt-2 border border-border/50 rounded-xl overflow-hidden">
          <div className="max-h-52 overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-secondary/50 text-muted-foreground sticky top-0">
                <tr className="whitespace-nowrap">
                  <th className="px-2 py-1.5 text-left">内容</th>
                  <th className="px-2 py-1.5 text-center">单位</th>
                  <th className="px-2 py-1.5 text-center">数量</th>
                  <th className="px-2 py-1.5 text-right">立项总价</th>
                  <th className="px-2 py-1.5 text-right">预算总价</th>
                  <th className="w-6" />
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={`${it.seq_id || ''}-${i}`} className="border-t border-border/30">
                    <td className="px-2 py-1.5 max-w-[180px]">
                      <p className="truncate font-medium">{it.content}</p>
                      {it.detail && <p className="truncate text-[10px] text-muted-foreground">{it.detail}</p>}
                    </td>
                    <td className="px-2 py-1.5 text-center">{it.unit || '-'}</td>
                    <td className="px-2 py-1.5 text-center">{it.quantity ?? '-'}</td>
                    <td className="px-2 py-1.5 text-right">{money(it.init_total)}</td>
                    <td className="px-2 py-1.5 text-right">{money(it.budget_total)}</td>
                    <td className="px-1 py-1.5">
                      <button type="button" onClick={() => removeAt(i)} className="p-1 rounded hover:bg-red-50 text-red-500" title="移除">
                        <X className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-2 py-1.5 bg-secondary/30 text-[11px] text-muted-foreground flex gap-4">
            <span>共 {items.length} 条</span>
            <span>立项总价 {money(initTotal)}</span>
            <span>预算总价 {money(budgetTotal)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
