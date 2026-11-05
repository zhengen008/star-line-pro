/**
 * AcceptanceSection - 项目详情 · 验收与回款（按结算方式生成的期次，逐期登记验收 / 开票 / 回款）
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, RefreshCw, Loader2, X } from 'lucide-react';
import { api } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { ensureAcceptancePeriods, regenerateAcceptancePeriods } from '@/lib/projectAcceptance';
import { resolveAcceptanceCycle } from '@/lib/acceptancePeriods';
import { cn } from '@/lib/utils';
import {
  formModalOverlayClass,
  formModalPanelClass,
  formModalHeaderClass,
  formModalBodyClass,
  formModalFooterClass,
  formLabelClass,
  formInputClass,
  formSelectClass,
  formTextareaClass,
  formCancelBtnClass,
  formSubmitBtnClass,
} from '@/lib/formStyles';

const CYCLE_LABEL = { month: '按月验收', quarter: '按季验收', half: '按半年验收', year: '按年验收', once: '项目结束一次验收' };

const money = (v) => (v === null || v === undefined || v === '' ? '-' : `¥${Number(v).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`);
const numOrNull = (v) => (v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));
const today = () => new Date().toLocaleDateString('sv-SE');

function RegisterDialog({ row, project, onClose }) {
  const qc = useQueryClient();
  const { currentUserName } = useAuth();
  const [form, setForm] = useState({
    status: row.status || '待验收',
    accepted_amount: row.accepted_amount ?? row.planned_amount ?? '',
    accepted_date: row.accepted_date || '',
    invoice_status: row.invoice_status || '未开票',
    invoice_amount: row.invoice_amount ?? '',
    invoice_date: row.invoice_date || '',
    received_amount: row.received_amount ?? '',
    received_date: row.received_date || '',
    remark: row.remark || '',
  });
  const f = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const setStatus = (v) => setForm((p) => ({ ...p, status: v, accepted_date: v === '已验收' && !p.accepted_date ? today() : p.accepted_date }));
  const setInvoiceStatus = (v) => setForm((p) => ({
    ...p,
    invoice_status: v,
    invoice_amount: v === '已开票' && p.invoice_amount === '' ? p.accepted_amount : p.invoice_amount,
    invoice_date: v === '已开票' && !p.invoice_date ? today() : p.invoice_date,
  }));

  const saveMut = useMutation({
    mutationFn: async () => {
      const data = {
        status: form.status,
        accepted_amount: form.status === '已验收' ? numOrNull(form.accepted_amount) : null,
        accepted_date: form.status === '已验收' ? form.accepted_date || null : null,
        invoice_status: form.invoice_status,
        invoice_amount: form.invoice_status === '已开票' ? numOrNull(form.invoice_amount) : null,
        invoice_date: form.invoice_status === '已开票' ? form.invoice_date || null : null,
        received_amount: numOrNull(form.received_amount),
        received_date: form.received_date || null,
        remark: form.remark || null,
      };
      await api.entities.ProjectAcceptance.update(row.id, data);
      await api.entities.ProjectLog.create({
        project_id: project.id,
        action: '验收登记',
        detail: `「${row.period_label}」${data.status}${data.accepted_amount != null ? ` ${money(data.accepted_amount)}` : ''}；${data.invoice_status}${data.invoice_amount != null ? ` ${money(data.invoice_amount)}` : ''}；回款 ${money(data.received_amount ?? 0)}`,
        operator: currentUserName,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-acceptances', project.id] });
      qc.invalidateQueries({ queryKey: ['all-acceptances'] });
      qc.invalidateQueries({ queryKey: ['project-logs', project.id] });
      onClose();
    },
  });

  return (
    <div className={formModalOverlayClass}>
      <div className={formModalPanelClass}>
        <div className={formModalHeaderClass}>
          <div>
            <h3 className="font-semibold">验收登记 · {row.period_label}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{row.period_start} ~ {row.period_end} · 预计 {money(row.planned_amount)}</p>
          </div>
          <button type="button" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className={formModalBodyClass}>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={formLabelClass}>验收状态</label>
              <select value={form.status} onChange={(e) => setStatus(e.target.value)} className={formSelectClass}>
                <option>待验收</option>
                <option>已验收</option>
              </select>
            </div>
            <div>
              <label className={formLabelClass}>验收金额（元）</label>
              <input type="number" value={form.accepted_amount} disabled={form.status !== '已验收'}
                onChange={(e) => f('accepted_amount', e.target.value)} className={cn(formInputClass, 'disabled:opacity-50')} />
            </div>
            <div>
              <label className={formLabelClass}>验收日期</label>
              <input type="date" value={form.accepted_date} disabled={form.status !== '已验收'}
                onChange={(e) => f('accepted_date', e.target.value)} className={cn(formInputClass, 'disabled:opacity-50')} />
            </div>
            <div>
              <label className={formLabelClass}>发票</label>
              <select value={form.invoice_status} onChange={(e) => setInvoiceStatus(e.target.value)} className={formSelectClass}>
                <option>未开票</option>
                <option>已开票</option>
              </select>
            </div>
            <div>
              <label className={formLabelClass}>开票金额（元）</label>
              <input type="number" value={form.invoice_amount} disabled={form.invoice_status !== '已开票'}
                onChange={(e) => f('invoice_amount', e.target.value)} className={cn(formInputClass, 'disabled:opacity-50')} />
            </div>
            <div>
              <label className={formLabelClass}>开票日期</label>
              <input type="date" value={form.invoice_date} disabled={form.invoice_status !== '已开票'}
                onChange={(e) => f('invoice_date', e.target.value)} className={cn(formInputClass, 'disabled:opacity-50')} />
            </div>
            <div className="col-span-2">
              <label className={formLabelClass}>已回款金额（元）</label>
              <input type="number" value={form.received_amount} onChange={(e) => f('received_amount', e.target.value)} className={formInputClass} />
            </div>
            <div>
              <label className={formLabelClass}>回款日期</label>
              <input type="date" value={form.received_date} onChange={(e) => f('received_date', e.target.value)} className={formInputClass} />
            </div>
          </div>
          <div>
            <label className={formLabelClass}>备注</label>
            <textarea rows={2} value={form.remark} onChange={(e) => f('remark', e.target.value)} className={formTextareaClass} />
          </div>
          {saveMut.error && (
            <div className="px-3 py-2 rounded-lg text-xs bg-red-50 text-red-700">{saveMut.error.data?.error || saveMut.error.message}</div>
          )}
        </div>
        <div className={formModalFooterClass}>
          <button type="button" onClick={onClose} className={formCancelBtnClass}>取消</button>
          <button type="button" onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className={formSubmitBtnClass}>
            {saveMut.isPending ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AcceptanceSection({ project, acceptances, canManage }) {
  const qc = useQueryClient();
  const { currentUserName } = useAuth();
  const [editing, setEditing] = useState(null);
  const hasAccepted = acceptances.some((r) => r.status === '已验收');
  const hasDates = !!project.start_date && !!project.end_date;

  const generateMut = useMutation({
    mutationFn: async (regenerate) => {
      const rows = regenerate
        ? await regenerateAcceptancePeriods(project)
        : await ensureAcceptancePeriods(project);
      await api.entities.ProjectLog.create({
        project_id: project.id,
        action: regenerate ? '重新生成验收计划' : '生成验收计划',
        detail: `按「${project.payment_method || '一次验收'}」生成 ${rows.length} 期`,
        operator: currentUserName,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-acceptances', project.id] });
      qc.invalidateQueries({ queryKey: ['all-acceptances'] });
      qc.invalidateQueries({ queryKey: ['project-logs', project.id] });
    },
  });

  return (
    <div className="bg-white rounded-2xl border border-border/50 p-5">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">验收与回款</h3>
          <span className="text-xs text-muted-foreground">
            结算方式：{project.payment_method || '-'} · {CYCLE_LABEL[resolveAcceptanceCycle(project.payment_method)]}
          </span>
        </div>
        {canManage && acceptances.length > 0 && !hasAccepted && (
          <button type="button" onClick={() => { if (confirm('将按当前起止时间与结算方式重新生成验收期次，确定？')) generateMut.mutate(true); }}
            disabled={generateMut.isPending}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs bg-secondary hover:bg-border disabled:opacity-50">
            <RefreshCw className="w-3.5 h-3.5" />重新生成
          </button>
        )}
      </div>

      {generateMut.error && (
        <div className="mb-3 px-3 py-2 rounded-lg text-xs bg-red-50 text-red-700">{generateMut.error.message}</div>
      )}

      {acceptances.length === 0 ? (
        <div className="text-center py-8 text-xs text-muted-foreground space-y-3">
          <p>{hasDates ? '尚未生成验收期次' : '项目未设置起止时间，无法生成验收期次'}</p>
          {canManage && hasDates && (
            <button type="button" onClick={() => generateMut.mutate(false)} disabled={generateMut.isPending}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-primary text-white text-xs font-medium disabled:opacity-50">
              {generateMut.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}生成验收计划
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] text-muted-foreground border-b border-border/40 whitespace-nowrap">
                <th className="py-2 text-left">期次</th>
                <th className="py-2 text-left">区间</th>
                <th className="py-2 text-right">预计金额</th>
                <th className="py-2 text-center">验收</th>
                <th className="py-2 text-right">验收金额</th>
                <th className="py-2 text-center">发票</th>
                <th className="py-2 text-right">开票金额</th>
                <th className="py-2 text-right">回款金额</th>
                <th className="py-2 text-left pl-3">备注</th>
              </tr>
            </thead>
            <tbody>
              {acceptances.map((r) => (
                <tr key={r.id} onClick={() => canManage && setEditing(r)}
                  className={cn('border-b border-border/30', canManage && 'hover:bg-secondary/20 cursor-pointer')}>
                  <td className="py-2 font-medium whitespace-nowrap">{r.period_label}</td>
                  <td className="py-2 text-muted-foreground whitespace-nowrap">{r.period_start} ~ {r.period_end}</td>
                  <td className="py-2 text-right">{money(r.planned_amount)}</td>
                  <td className="py-2 text-center">
                    <span className={cn('px-1.5 py-0.5 rounded-full text-[10px]', r.status === '已验收' ? 'bg-blue-100 text-blue-700' : 'bg-secondary text-muted-foreground')}>{r.status}</span>
                  </td>
                  <td className="py-2 text-right font-medium">{r.status === '已验收' ? money(r.accepted_amount) : '-'}</td>
                  <td className="py-2 text-center">
                    <span className={cn('px-1.5 py-0.5 rounded-full text-[10px]', r.invoice_status === '已开票' ? 'bg-green-100 text-green-700' : 'bg-secondary text-muted-foreground')}>{r.invoice_status}</span>
                  </td>
                  <td className="py-2 text-right">{r.invoice_status === '已开票' ? money(r.invoice_amount) : '-'}</td>
                  <td className="py-2 text-right font-medium text-green-700">{money(r.received_amount)}</td>
                  <td className="py-2 pl-3 max-w-[160px] truncate text-muted-foreground" title={r.remark || ''}>{r.remark || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {canManage && <p className="mt-2 text-[10px] text-muted-foreground">点击任一期次登记验收、开票与回款</p>}
        </div>
      )}

      {editing && <RegisterDialog row={editing} project={project} onClose={() => setEditing(null)} />}
    </div>
  );
}
