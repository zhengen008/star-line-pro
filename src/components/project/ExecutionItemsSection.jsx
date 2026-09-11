/**
 * ExecutionItemsSection - 项目执行内容（按 Sheet 分 Tab，已通过 Sheet 可维护供应商）
 */
import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, fileUrl } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { UserPlus, FileText, Building2, X, Check, Plus, Loader2, Maximize2, Minimize2, ChevronLeft, ChevronRight, Pencil, Paperclip } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import OssUpload from '../OssUpload';
import ServiceCatalogPicker from './ServiceCatalogPicker';
import {
  getDefaultExecutionTab,
  sortExecutionSheetsChronologically,
  paginateItems,
  loadDismissedSheetIds,
  saveDismissedSheetIds,
  EXECUTION_ITEMS_PAGE_SIZE,
} from '@/lib/executionCatalogFilter';
import {
  shouldAutoSubmitSupplierPayment,
  canEditSupplierPaymentAmount,
  submitSupplierPaymentApproval,
} from '@/lib/submitSupplierPaymentApproval';
import { cn } from '@/lib/utils';
import {
  formLabelClass,
  formInputClass,
  formTextareaClass,
  formModalShellClass,
  formModalHeaderClass,
  formModalBodyClass,
  formModalFooterClass,
  formCancelBtnClass,
  formSubmitBtnClass,
} from '@/lib/formStyles';

const SHEET_STATUS_STYLE = {
  '待审核': 'bg-yellow-100 text-yellow-700',
  '审核中': 'bg-blue-100 text-blue-700',
  '已通过': 'bg-green-100 text-green-700',
  '已拒绝': 'bg-red-100 text-red-700',
};

const PAYMENT_STATUS_STYLE = {
  '无付款': 'bg-secondary text-muted-foreground',
  '待审核': 'bg-yellow-100 text-yellow-700',
  '审核中': 'bg-blue-100 text-blue-700',
  '已通过': 'bg-green-100 text-green-700',
  '已拒绝': 'bg-red-100 text-red-700',
};

function SupplierDialogHeader({ title, subtitle }) {
  return (
    <DialogHeader className={`${formModalHeaderClass} min-w-0 overflow-hidden pr-12`}>
      <DialogTitle className="font-semibold text-base text-left min-w-0 w-full space-y-1">
        <span className="block truncate">{title}</span>
        {subtitle ? (
          <span className="block text-xs font-normal text-muted-foreground truncate" title={subtitle}>
            {subtitle}
          </span>
        ) : null}
      </DialogTitle>
    </DialogHeader>
  );
}

function parseSupplierFiles(raw) {
  try {
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function SupplierForm({ project, executionItem, supplier = null, onDone, onCancel }) {
  const qc = useQueryClient();
  const { currentUserName, currentEmployee } = useAuth();
  const isEdit = !!supplier?.id;
  const amountLocked = isEdit && !canEditSupplierPaymentAmount(supplier?.payment_status);
  const [name, setName] = useState(supplier?.supplier_name || '');
  const [cost, setCost] = useState(
    supplier?.cost_detail != null && supplier?.cost_detail !== '' ? String(supplier.cost_detail) : ''
  );
  const [remark, setRemark] = useState(supplier?.remark || '');
  const [contractFiles, setContractFiles] = useState(() => parseSupplierFiles(supplier?.contract_file));
  const [invoiceFiles, setInvoiceFiles] = useState(() => parseSupplierFiles(supplier?.invoice_file));
  const [error, setError] = useState('');

  const saveMut = useMutation({
    mutationFn: async () => {
      setError('');
      const data = {
        execution_item_id: executionItem.id,
        supplier_name: name.trim(),
        cost_detail: amountLocked ? (supplier.cost_detail ?? null) : (cost || null),
        remark: remark || null,
        contract_file: contractFiles.length ? JSON.stringify(contractFiles) : null,
        invoice_file: invoiceFiles.length ? JSON.stringify(invoiceFiles) : null,
      };
      if (!isEdit) data.payment_status = '无付款';

      let saved;
      if (isEdit) saved = await api.entities.SupplierItem.update(supplier.id, data);
      else saved = await api.entities.SupplierItem.create(data);

      const merged = { ...supplier, ...saved, ...data, id: saved.id };
      if (
        shouldAutoSubmitSupplierPayment({
          cost: merged.cost_detail,
          payment_status: isEdit ? (supplier.payment_status || '无付款') : '无付款',
        })
      ) {
        const { approval } = await submitSupplierPaymentApproval({
          project,
          executionItem,
          supplierItem: merged,
          applicant: currentUserName,
          dept: currentEmployee?.department || '',
        });
        return { approval };
      }
      return { approval: null };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplier-items-project'] });
      qc.invalidateQueries({ queryKey: ['all-approvals'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      onDone();
    },
    onError: (e) => setError(e?.data?.error || e?.message || '保存失败'),
  });

  return (
    <>
      <div className={formModalBodyClass}>
        <div className="space-y-4">
          <div>
            <label className={formLabelClass}>供应商名称 *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={formInputClass} disabled={amountLocked} />
          </div>
          <div>
            <label className={formLabelClass}>
              成本金额（元）{amountLocked ? '（审批中/已通过不可改）' : ' — 填写后将自动发起付款审批'}
            </label>
            <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} className={formInputClass} disabled={amountLocked} />
          </div>
          <div>
            <label className={formLabelClass}>备注</label>
            <textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={2} className={formTextareaClass} />
          </div>
          <div>
            <label className={formLabelClass}>合同归档{isEdit ? '' : '（可稍后上传）'}</label>
            <div className="mt-1">
              <OssUpload fileType="contract" value={contractFiles} onChange={setContractFiles} multiple label="上传合同文件" />
            </div>
          </div>
          <div>
            <label className={formLabelClass}>发票归档{isEdit ? '' : '（可稍后上传）'}</label>
            <div className="mt-1">
              <OssUpload fileType="invoice" value={invoiceFiles} onChange={setInvoiceFiles} multiple label="上传发票文件" />
            </div>
          </div>
          {error && <div className="px-3 py-2 rounded-lg text-xs bg-red-50 text-red-700">{error}</div>}
        </div>
      </div>
      <div className={formModalFooterClass}>
        <button type="button" onClick={onCancel || onDone} className={formCancelBtnClass}>取消</button>
        <button type="button" onClick={() => saveMut.mutate()} disabled={!name.trim() || saveMut.isPending}
          className={`${formSubmitBtnClass} flex items-center justify-center gap-1`}>
          {saveMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          保存
        </button>
      </div>
    </>
  );
}

function SupplierListDialog({ item, suppliers, canManage, onAdd, onEdit, onClose }) {
  const qc = useQueryClient();
  const deleteSupplierMut = useMutation({
    mutationFn: (id) => api.entities.SupplierItem.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplier-items-project'] }),
  });
  const money = (v) => (v === null || v === undefined || v === '' ? '-' : `¥${Number(v).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`${formModalShellClass} max-w-xl max-h-[80vh] flex flex-col gap-0 p-0 overflow-hidden`}>
        <SupplierDialogHeader title="供应商明细" subtitle={item.content} />
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-2 bg-white">
          {suppliers.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-xs">暂无供应商</div>
          ) : suppliers.map((s) => {
            const contracts = parseSupplierFiles(s.contract_file);
            const invoices = parseSupplierFiles(s.invoice_file);
            return (
              <div key={s.id} className="rounded-xl border border-border/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <p className="text-sm font-medium truncate">{s.supplier_name}</p>
                      {s.cost_detail != null && s.cost_detail !== '' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-600">成本 {money(s.cost_detail)}</span>
                      )}
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded', PAYMENT_STATUS_STYLE[s.payment_status || '无付款'] || PAYMENT_STATUS_STYLE['无付款'])}>
                        {s.payment_status || '无付款'}
                      </span>
                    </div>
                    {s.remark && <p className="text-xs text-muted-foreground mt-1 truncate" title={s.remark}>备注：{s.remark}</p>}
                    <div className="flex flex-wrap gap-2 mt-2 text-[10px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Paperclip className="w-3 h-3" />合同 {contracts.length} 个
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Paperclip className="w-3 h-3" />发票 {invoices.length} 个
                      </span>
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        title="编辑 / 上传合同发票"
                        onClick={() => onEdit?.(s)}
                        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => { if (confirm('确定删除？')) deleteSupplierMut.mutate(s.id); }}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {canManage && (
          <div className={formModalFooterClass}>
            <button type="button" onClick={onAdd} className={`${formSubmitBtnClass} flex items-center justify-center gap-1.5`}>
              <UserPlus className="w-3.5 h-3.5" />添加供应商
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ExecutionItemRow({ item, suppliers, canManageSuppliers, project }) {
  const [showList, setShowList] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const fmt = (v) => (v === null || v === undefined || v === '' ? '-' : Number(v).toLocaleString('zh-CN', { maximumFractionDigits: 2 }));
  const money = (v) => (v === null || v === undefined || v === '' ? '-' : `¥${Number(v).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`);
  const totalCost = suppliers.reduce((s, x) => s + (Number(x.cost_detail) || 0), 0);

  const openCreate = () => {
    setEditingSupplier(null);
    setShowForm(true);
  };

  const openEdit = (supplier) => {
    setEditingSupplier(supplier);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingSupplier(null);
  };

  return (
    <>
      <tr onClick={() => canManageSuppliers && setShowList(true)}
        className={`border-b border-border/30 transition-colors ${canManageSuppliers ? 'hover:bg-secondary/20 cursor-pointer' : ''}`}>
        <td className="py-2 w-10 text-xs text-muted-foreground">{item.seq_id || '-'}</td>
        <td className="py-2 max-w-[180px]">
          <p className="text-xs font-medium truncate">{item.content}</p>
          {item.detail && <p className="text-[10px] text-muted-foreground truncate">{item.detail}</p>}
        </td>
        <td className="py-2 w-12 text-center text-xs">{item.unit || '-'}</td>
        <td className="py-2 w-14 text-center text-xs">{fmt(item.quantity)}</td>
        <td className="py-2 w-20 text-right text-xs">{money(item.init_price)}</td>
        <td className="py-2 w-20 text-right text-xs font-medium">{money(item.init_total)}</td>
        <td className="py-2 w-20 text-right text-xs">{money(item.budget_price)}</td>
        <td className="py-2 w-20 text-right text-xs font-medium">{money(item.budget_total)}</td>
        <td className="py-2 w-20 text-right text-xs font-medium text-orange-600">{totalCost > 0 ? money(totalCost) : '-'}</td>
        <td className="py-2 w-16 text-center" onClick={(e) => { e.stopPropagation(); canManageSuppliers && setShowList(true); }}>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] bg-purple-50 text-purple-700">
            <Building2 className="w-3 h-3" />{suppliers.length}
          </span>
        </td>
        <td className="py-2 w-10 text-center" onClick={(e) => e.stopPropagation()}>
          {canManageSuppliers && (
            <button onClick={openCreate} className="inline-flex w-7 h-7 items-center justify-center rounded-lg bg-lime-100 text-lime-700 hover:bg-lime-200">
              <UserPlus className="w-3.5 h-3.5" />
            </button>
          )}
        </td>
      </tr>
      {showList && (
        <SupplierListDialog
          item={item}
          suppliers={suppliers}
          canManage={canManageSuppliers}
          onClose={() => setShowList(false)}
          onAdd={() => { setShowList(false); openCreate(); }}
          onEdit={(s) => { setShowList(false); openEdit(s); }}
        />
      )}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) closeForm(); }}>
        <DialogContent className={`${formModalShellClass} max-w-lg max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden`}>
          <SupplierDialogHeader
            title={editingSupplier ? '编辑供应商' : '添加供应商'}
            subtitle={item.content}
          />
          <SupplierForm
            key={editingSupplier?.id || 'new'}
            project={project}
            executionItem={item}
            supplier={editingSupplier}
            onDone={closeForm}
            onCancel={closeForm}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function ExecutionItemsSection({ project }) {
  const { currentUserName, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState(null);
  const [tabInitialized, setTabInitialized] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [page, setPage] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [dismissedSheetIds, setDismissedSheetIds] = useState(() => loadDismissedSheetIds(project.id));

  const members = Array.isArray(project.members) ? project.members : [];
  const canParticipate = isAdmin || project.manager === currentUserName || members.includes(currentUserName);
  const canManageProject = isAdmin || project.manager === currentUserName;

  const { data: sheets = [], isLoading: sheetsLoading } = useQuery({
    queryKey: ['execution-sheets', project.id],
    queryFn: () => api.entities.ExecutionSheet.filter({ project_id: project.id }, 'created_date', 100),
  });

  const visibleSheets = useMemo(
    () => sortExecutionSheetsChronologically(sheets.filter((s) => !dismissedSheetIds.has(s.id))),
    [sheets, dismissedSheetIds]
  );

  useEffect(() => {
    setDismissedSheetIds(loadDismissedSheetIds(project.id));
    setTabInitialized(false);
    setActiveTab(null);
    setPage(1);
    setFullscreen(false);
  }, [project.id]);

  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  useEffect(() => {
    if (!fullscreen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  const { data: allItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['execution-items', project.id],
    queryFn: () => api.entities.ExecutionItem.filter({ project_id: project.id }, 'seq_id', 1000),
  });

  const dismissRejectedSheet = (sheetId, e) => {
    e?.stopPropagation();
    const next = new Set(dismissedSheetIds);
    next.add(sheetId);
    setDismissedSheetIds(next);
    saveDismissedSheetIds(project.id, next);
    if (activeTab === sheetId) {
      setActiveTab(getDefaultExecutionTab(sheets, allItems, next));
    }
  };

  // 仅展示已归入 Sheet 的条目；服务管理导入的待增项只在「服务增项」中可选
  const displayItems = useMemo(() => {
    if (!activeTab) return [];
    return allItems.filter((i) => i.sheet_id === activeTab);
  }, [allItems, activeTab]);

  const activeSheet = sheets.find((s) => s.id === activeTab) || null;
  const canManageSuppliers =
    canManageProject &&
    activeSheet?.status === '已通过';

  const { data: allSuppliers = [] } = useQuery({
    queryKey: ['supplier-items-project', project.id, displayItems.map((i) => i.id).join(',')],
    queryFn: () => {
      const ids = displayItems.map((i) => i.id);
      if (!ids.length) return [];
      return api.entities.SupplierItem.filter({ execution_item_id: { $in: ids } }, 'created_date', 1000);
    },
    enabled: displayItems.length > 0,
  });

  const money = (v) => (v === null || v === undefined || v === '' ? '-' : `¥${Number(v).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`);
  const totalQuantity = displayItems.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  const itemIds = new Set(displayItems.map((i) => i.id));
  const totalCost = allSuppliers.filter((s) => itemIds.has(s.execution_item_id)).reduce((s, x) => s + (Number(x.cost_detail) || 0), 0);

  const tabs = useMemo(
    () => visibleSheets.map((s) => ({ id: s.id, name: s.name, status: s.status })),
    [visibleSheets]
  );

  const { pageItems, totalPages, page: safePage } = useMemo(
    () => paginateItems(displayItems, page, EXECUTION_ITEMS_PAGE_SIZE),
    [displayItems, page]
  );

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const isLoading = sheetsLoading || itemsLoading;

  useEffect(() => {
    if (tabInitialized || isLoading) return;
    setActiveTab(getDefaultExecutionTab(sheets, allItems, dismissedSheetIds));
    setTabInitialized(true);
  }, [sheets, allItems, isLoading, tabInitialized, dismissedSheetIds]);

  useEffect(() => {
    if (isLoading) return;
    if (tabs.length === 0) {
      if (activeTab != null) setActiveTab(null);
      return;
    }
    if (!tabs.some((t) => t.id === activeTab)) {
      setActiveTab(getDefaultExecutionTab(sheets, allItems, dismissedSheetIds));
    }
  }, [tabs, activeTab, sheets, allItems, isLoading, dismissedSheetIds]);

  const panelBody = (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">执行内容</h3>
          <span className="text-xs text-muted-foreground">
            共 {displayItems.length} 条
            {totalPages > 1 && ` · 第 ${safePage}/${totalPages} 页`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFullscreen((v) => !v)}
            className="p-2 rounded-xl bg-secondary hover:bg-border text-muted-foreground transition-colors"
            title={fullscreen ? '退出全屏' : '全屏查看'}
          >
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          {canParticipate && (
            <button type="button" onClick={() => setShowPicker(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-full text-xs font-medium hover:bg-orange-100">
              <Plus className="w-3.5 h-3.5" />服务增项
            </button>
          )}
        </div>
      </div>

      {tabs.length > 0 && (
        <div className="flex gap-2 mb-4 border-b border-border/40 pb-3 overflow-x-auto shrink-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap',
                activeTab === t.id ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground hover:text-foreground'
              )}
            >
              {t.name}
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full',
                activeTab === t.id ? 'bg-white/20 text-white' : (SHEET_STATUS_STYLE[t.status] || 'bg-gray-100')
              )}>
                {t.status}
              </span>
              {t.status === '已拒绝' && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => dismissRejectedSheet(t.id, e)}
                  onKeyDown={(e) => { if (e.key === 'Enter') dismissRejectedSheet(t.id, e); }}
                  className={cn(
                    'ml-0.5 p-0.5 rounded-full hover:bg-black/10',
                    activeTab === t.id ? 'hover:bg-white/20' : 'hover:bg-red-100'
                  )}
                  title="关闭此 Sheet"
                >
                  <X className="w-3 h-3" />
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {activeSheet && activeSheet.status !== '已通过' && (
        <div className={cn(
          'mb-3 px-3 py-2 rounded-lg text-xs shrink-0',
          activeSheet.status === '已拒绝' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'
        )}>
          当前 Sheet「{activeSheet.name}」{activeSheet.status}，审批通过后可维护供应商与汇总。
        </div>
      )}

      <div className={cn('min-h-0', fullscreen && 'flex-1 overflow-auto')}>
        {isLoading ? (
          <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : displayItems.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p className="text-xs">{canParticipate ? '暂无执行内容，请先在服务管理中导入到本项目，再点击「服务增项」勾选提交' : '暂无执行内容'}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-[10px] text-muted-foreground border-b border-border/40 whitespace-nowrap">
                    <th className="w-10 py-2 text-left">序号</th>
                    <th className="py-2 text-left">内容</th>
                    <th className="w-12 py-2 text-center">单位</th>
                    <th className="w-14 py-2 text-center">数量</th>
                    <th className="w-20 py-2 text-right">立项单价</th>
                    <th className="w-20 py-2 text-right">立项总价</th>
                    <th className="w-20 py-2 text-right">预算单价</th>
                    <th className="w-20 py-2 text-right">预算总价</th>
                    <th className="w-20 py-2 text-right">成本</th>
                    <th className="w-16 py-2 text-center">供应商</th>
                    <th className="w-14 py-2 text-center">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((item) => (
                    <ExecutionItemRow key={item.id} item={item}
                      project={project}
                      suppliers={allSuppliers.filter((s) => s.execution_item_id === item.id)}
                      canManageSuppliers={canManageSuppliers} />
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">
                  显示 {(safePage - 1) * EXECUTION_ITEMS_PAGE_SIZE + 1}–{Math.min(safePage * EXECUTION_ITEMS_PAGE_SIZE, displayItems.length)} 条
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg bg-secondary hover:bg-border disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 tabular-nums">{safePage} / {totalPages}</span>
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded-lg bg-secondary hover:bg-border disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
            {canManageSuppliers && (
              <div className="mt-3 pt-2 border-t border-border/40 flex flex-wrap gap-x-6 gap-y-1 text-xs">
                <span className="text-muted-foreground">执行数量：<b>{totalQuantity}</b></span>
                <span className="text-muted-foreground">成本总和：<b className="text-orange-600">{money(totalCost)}</b></span>
              </div>
            )}
          </>
        )}
      </div>

      <ServiceCatalogPicker
        project={project}
        sheets={sheets}
        open={showPicker}
        onOpenChange={setShowPicker}
      />
    </>
  );

  if (fullscreen) {
    return (
      <>
        <div className="bg-white rounded-2xl border border-border/50 px-5 py-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>执行内容（全屏查看中，按 Esc 或点击右侧按钮退出）</span>
          <button
            type="button"
            onClick={() => setFullscreen(false)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary hover:bg-border text-foreground"
          >
            <Minimize2 className="w-3.5 h-3.5" />退出全屏
          </button>
        </div>
        <div className="fixed inset-0 z-50 bg-[#f4f5f7] dark:bg-[#14161a] p-4 flex flex-col">
          <div className="bg-white rounded-2xl border border-border/50 flex flex-col flex-1 min-h-0 p-5 shadow-sm">
            {panelBody}
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-border/50 p-5">
      {panelBody}
    </div>
  );
}
