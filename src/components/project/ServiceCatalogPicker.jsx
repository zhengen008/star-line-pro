/**
 * 从服务管理目录勾选执行内容，命名 Sheet 并提交项目执行内容审批。
 * 已提交（非拒绝）的目录项仍显示，勾选且不可更改。
 */
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { submitProjectExecutionSheet } from '@/lib/submitProjectExecutionSheet';
import { getBlockedCatalogSourceIds, getProjectExecutionPool } from '@/lib/executionCatalogFilter';
import {
  formLabelClass,
  formInputClass,
  formModalShellClass,
  formModalHeaderClass,
  formModalBodyClass,
  formModalFooterClass,
  formCancelBtnClass,
  formSubmitBtnClass,
} from '@/lib/formStyles';
import { Loader2, Check, Lock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function ServiceCatalogPicker({
  project,
  sheets = [],
  open,
  onOpenChange,
}) {
  const qc = useQueryClient();
  const { currentUserName, currentEmployee } = useAuth();
  const [selected, setSelected] = useState(new Set());
  const [sheetName, setSheetName] = useState('');

  const { data: projectItems = [], isLoading } = useQuery({
    queryKey: ['execution-items', project.id],
    queryFn: () => api.entities.ExecutionItem.filter({ project_id: project.id }, 'seq_id', 1000),
    enabled: open,
  });

  const pool = useMemo(() => getProjectExecutionPool(projectItems), [projectItems]);

  const lockedIds = useMemo(
    () => getBlockedCatalogSourceIds(projectItems, sheets),
    [projectItems, sheets]
  );

  const toggle = (id) => {
    if (lockedIds.has(id)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submitMut = useMutation({
    mutationFn: () => submitProjectExecutionSheet({
      project,
      sheetName,
      catalogItemIds: [...selected],
      applicant: currentUserName,
      dept: currentEmployee?.department || '',
      operatorName: currentUserName,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['execution-sheets', project.id] });
      qc.invalidateQueries({ queryKey: ['execution-items', project.id] });
      qc.invalidateQueries({ queryKey: ['all-approvals'] });
      qc.invalidateQueries({ queryKey: ['project-logs', project.id] });
      setSelected(new Set());
      setSheetName('');
      onOpenChange(false);
    },
  });

  const fmt = (v) => (v === null || v === undefined || v === '' ? '-' : Number(v).toLocaleString('zh-CN', { maximumFractionDigits: 2 }));
  const selectableCount = selected.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${formModalShellClass} max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden`}>
        <DialogHeader className={formModalHeaderClass}>
          <DialogTitle className="font-semibold text-base">服务增项 — 选择本项目执行内容</DialogTitle>
        </DialogHeader>
        <div className={`${formModalBodyClass} space-y-4`}>
          <div>
            <label className={formLabelClass}>Sheet 名称 *</label>
            <input
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              placeholder="例如：2026-Q1增项"
              className={formInputClass}
            />
            <p className="mt-2 text-[10px] text-amber-700">勾选后提交审批；审批通过后条目归入 Sheet 并可在项目内维护供应商。</p>
            <p className="mt-1 text-[10px] text-muted-foreground">请先在「服务管理」中将 Excel 导入到本项目，再在此勾选。</p>
          </div>
          <div className="min-h-0 max-h-[50vh] overflow-y-auto -mx-1 px-1">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : pool.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-12">
                本项目暂无可选执行内容，请先在「服务管理 → 导入到项目」中导入 Excel
              </p>
            ) : (
              <div className="space-y-2">
                {pool.map((it) => {
                  const locked = lockedIds.has(it.id);
                  const checked = locked || selected.has(it.id);
                  return (
                    <label
                      key={it.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                        locked
                          ? 'border-border/40 bg-secondary/40 cursor-not-allowed opacity-80'
                          : checked
                            ? 'border-primary bg-primary/5 cursor-pointer'
                            : 'border-border/50 hover:bg-secondary/30 cursor-pointer'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={locked}
                        onChange={() => toggle(it.id)}
                        className="mt-1 shrink-0 disabled:cursor-not-allowed"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{it.content}</p>
                          {locked && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0">
                              <Lock className="w-3 h-3" />已提交
                            </span>
                          )}
                        </div>
                        {it.detail && <p className="text-xs text-muted-foreground truncate mt-0.5">{it.detail}</p>}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {it.unit || '-'} · 数量 {fmt(it.quantity)} · 预算 {it.budget_total != null ? `¥${fmt(it.budget_total)}` : '-'}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className={`${formModalFooterClass} items-center`}>
          <span className="text-xs text-muted-foreground flex-1">本次新选 {selectableCount} 条</span>
          <button type="button" onClick={() => onOpenChange(false)} className={`${formCancelBtnClass} flex-none px-6`}>取消</button>
          <button
            type="button"
            onClick={() => submitMut.mutate()}
            disabled={!sheetName.trim() || selectableCount === 0 || submitMut.isPending}
            className={`${formSubmitBtnClass} flex-none px-6 flex items-center gap-1`}
          >
            {submitMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            提交审批
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
