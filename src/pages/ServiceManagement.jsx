/**
 * ServiceManagement - 按权限展示已参与项目的执行内容；导入到项目并回显；批量删除未入 Sheet 条目。
 */
import { useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import {
  projectsVisibleToUser,
  projectsEligibleForServiceImport,
  filterServiceExecutionItems,
  isServiceItemBatchDeletable,
} from '@/lib/serviceManagementAccess';
import { Plus, Upload, Loader2, Pencil, Trash2, X, Check, Search } from 'lucide-react';
import {
  formLabelClass,
  formInputClass,
  formTextareaClass,
  formModalOverlayClass,
  formModalPanelClass,
  formModalHeaderClass,
  formModalBodyClass,
  formModalFooterClass,
  formCancelBtnClass,
  formSubmitBtnClass,
} from '@/lib/formStyles';

function numOrNull(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function ImportToProjectModal({ eligibleProjects, onClose, onImported }) {
  const fileInputRef = useRef(null);
  const [projectId, setProjectId] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;
    setImporting(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('project_id', projectId);
      const res = await api.functions.upload('importExecutionItems', fd);
      const project = eligibleProjects.find((p) => p.id === projectId);
      onImported({
        projectId,
        projectName: project?.name || '',
        imported: res.imported ?? 0,
        skipped: res.skipped ?? 0,
        text: `已导入到「${project?.name || '项目'}」：成功 ${res.imported} 条${res.skipped ? `，跳过 ${res.skipped} 条` : ''}（列表已切换至该项目）`,
      });
      onClose();
    } catch (err) {
      setError(err.data?.error || err.message || '导入失败');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div className={formModalOverlayClass}>
      <div className={formModalPanelClass}>
        <div className={formModalHeaderClass}>
          <h3 className="font-semibold">导入执行内容到项目</h3>
          <button type="button" onClick={onClose} disabled={importing}><X className="w-4 h-4" /></button>
        </div>
        <div className={formModalBodyClass}>
          <div>
            <label className={formLabelClass}>目标项目 *</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className={`${formInputClass} cursor-pointer`}
            >
              <option value="">请选择要导入到的项目…</option>
              {eligibleProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.name} · {p.customer}</option>
              ))}
            </select>
            {eligibleProjects.length === 0 && (
              <p className="mt-2 text-xs text-amber-600">暂无可导入项目（需为你参与且「执行中/完成审批中」的项目）</p>
            )}
          </div>
          <div className="bg-secondary/40 rounded-xl p-3 text-xs text-muted-foreground leading-relaxed">
            导入后归属所选项目，并在下方列表回显。项目内可在「服务增项」中勾选提交审批。
          </div>
          {error && (
            <div className="px-3 py-2 rounded-lg text-xs bg-red-50 text-red-700">{error}</div>
          )}
        </div>
        <div className={formModalFooterClass}>
          <button type="button" onClick={onClose} className={formCancelBtnClass} disabled={importing}>取消</button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
          <button
            type="button"
            disabled={!projectId || importing || eligibleProjects.length === 0}
            onClick={() => fileInputRef.current?.click()}
            className={`${formSubmitBtnClass} flex items-center justify-center gap-1`}
          >
            {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            选择 Excel 并导入
          </button>
        </div>
      </div>
    </div>
  );
}

function CatalogFormModal({ item, visibleProjects, defaultProjectId, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    project_id: item?.project_id || defaultProjectId || '',
    content: item?.content || '',
    detail: item?.detail || '',
    unit: item?.unit || '',
    quantity: item?.quantity ?? '',
    init_price: item?.init_price ?? '',
    init_total: item?.init_total ?? '',
    budget_price: item?.budget_price ?? '',
    budget_total: item?.budget_total ?? '',
    seq_id: item?.seq_id || '',
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const selectedProject = visibleProjects.find((p) => p.id === form.project_id);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form.project_id) throw new Error('请选择项目');
      const data = {
        project_id: form.project_id,
        project_name: selectedProject?.name || null,
        sheet_id: item?.sheet_id || null,
        content: form.content.trim(),
        detail: form.detail.trim() || null,
        unit: form.unit.trim() || null,
        quantity: numOrNull(form.quantity),
        init_price: numOrNull(form.init_price),
        init_total: numOrNull(form.init_total),
        budget_price: numOrNull(form.budget_price),
        budget_total: numOrNull(form.budget_total),
        seq_id: form.seq_id.trim() || null,
        is_service_addon: true,
      };
      if (item?.id) return api.entities.ExecutionItem.update(item.id, data);
      return api.entities.ExecutionItem.create(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-project-items'] });
      onClose();
    },
  });

  return (
    <div className={formModalOverlayClass}>
      <div className={formModalPanelClass}>
        <div className={formModalHeaderClass}>
          <h3 className="font-semibold">{item?.id ? '编辑执行内容' : '新增执行内容'}</h3>
          <button type="button" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className={formModalBodyClass}>
          <div>
            <label className={formLabelClass}>所属项目 *</label>
            <select
              value={form.project_id}
              onChange={(e) => set('project_id', e.target.value)}
              disabled={!!item?.id}
              className={`${formInputClass} cursor-pointer disabled:opacity-60`}
            >
              <option value="">请选择项目…</option>
              {visibleProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.name} · {p.customer}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={formLabelClass}>内容 *</label>
            <input value={form.content} onChange={(e) => set('content', e.target.value)} className={formInputClass} />
          </div>
          <div>
            <label className={formLabelClass}>详细说明</label>
            <textarea value={form.detail} onChange={(e) => set('detail', e.target.value)} rows={2} className={formTextareaClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={formLabelClass}>序号</label>
              <input value={form.seq_id} onChange={(e) => set('seq_id', e.target.value)} className={formInputClass} />
            </div>
            <div>
              <label className={formLabelClass}>单位</label>
              <input value={form.unit} onChange={(e) => set('unit', e.target.value)} className={formInputClass} />
            </div>
            <div>
              <label className={formLabelClass}>数量</label>
              <input type="number" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} className={formInputClass} />
            </div>
            <div>
              <label className={formLabelClass}>立项单价（含税）</label>
              <input type="number" value={form.init_price} onChange={(e) => set('init_price', e.target.value)} className={formInputClass} />
            </div>
            <div>
              <label className={formLabelClass}>立项总价（含税）</label>
              <input type="number" value={form.init_total} onChange={(e) => set('init_total', e.target.value)} className={formInputClass} />
            </div>
            <div>
              <label className={formLabelClass}>预算单价（含税）</label>
              <input type="number" value={form.budget_price} onChange={(e) => set('budget_price', e.target.value)} className={formInputClass} />
            </div>
            <div className="col-span-2">
              <label className={formLabelClass}>预算总价（含税）</label>
              <input type="number" value={form.budget_total} onChange={(e) => set('budget_total', e.target.value)} className={formInputClass} />
            </div>
          </div>
          {saveMut.isError && (
            <div className="px-3 py-2 rounded-lg text-xs bg-red-50 text-red-700">
              {saveMut.error?.message || '保存失败'}
            </div>
          )}
        </div>
        <div className={formModalFooterClass}>
          <button type="button" onClick={onClose} className={formCancelBtnClass}>取消</button>
          <button
            type="button"
            onClick={() => saveMut.mutate()}
            disabled={!form.content.trim() || !form.project_id || saveMut.isPending}
            className={`${formSubmitBtnClass} flex items-center justify-center gap-1`}
          >
            {saveMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ServiceManagement() {
  const qc = useQueryClient();
  const { isAdmin, can, currentUserName } = useAuth();
  const canEdit = isAdmin || can('服务管理', '编辑') || can('服务管理', '创建');
  // 有编辑/创建权限也可清理误导入；删除权限同样可用
  const canDelete = isAdmin || can('服务管理', '删除') || can('服务管理', '编辑') || can('服务管理', '创建');

  const [search, setSearch] = useState('');
  const [projectFilterId, setProjectFilterId] = useState('');
  const [importMsg, setImportMsg] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.entities.Project.list('-created_date', 500),
  });

  const accessOpts = useMemo(
    () => ({ isAdmin, userName: currentUserName }),
    [isAdmin, currentUserName]
  );

  const visibleProjects = useMemo(
    () => projectsVisibleToUser(projects, accessOpts),
    [projects, accessOpts]
  );

  const importProjects = useMemo(
    () => projectsEligibleForServiceImport(projects, accessOpts),
    [projects, accessOpts]
  );

  const visibleProjectIds = useMemo(
    () => visibleProjects.map((p) => p.id),
    [visibleProjects]
  );

  const projectNameById = useMemo(
    () => Object.fromEntries(visibleProjects.map((p) => [p.id, p.name])),
    [visibleProjects]
  );

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['service-project-items', visibleProjectIds.join(',')],
    queryFn: async () => {
      if (visibleProjectIds.length === 0) return [];
      return api.entities.ExecutionItem.filter(
        { project_id: { $in: visibleProjectIds } },
        '-created_date',
        2000
      );
    },
    enabled: visibleProjectIds.length > 0,
  });

  const filtered = useMemo(
    () => filterServiceExecutionItems(items, { projectFilterId, search }),
    [items, projectFilterId, search]
  );

  const deletableFiltered = useMemo(
    () => filtered.filter(isServiceItemBatchDeletable),
    [filtered]
  );

  const deleteMut = useMutation({
    mutationFn: async (ids) => {
      const errors = [];
      for (const id of ids) {
        try {
          await api.entities.ExecutionItem.delete(id);
        } catch (e) {
          errors.push(e?.data?.error || e?.message || id);
        }
      }
      if (errors.length === ids.length) {
        throw new Error(errors[0] || '删除失败');
      }
      return { ok: ids.length - errors.length, fail: errors.length };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['service-project-items'] });
      setSelectedIds([]);
      if (res?.fail) {
        setImportMsg({ type: 'err', text: `已删除 ${res.ok} 条，${res.fail} 条失败` });
      } else {
        setImportMsg({ type: 'ok', text: `已删除 ${res?.ok ?? 0} 条执行内容` });
      }
    },
    onError: (e) => {
      setImportMsg({ type: 'err', text: e?.message || '批量删除失败' });
    },
  });

  const toggleOne = (id, deletable) => {
    if (!deletable) return;
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const allDeletableSelected =
    deletableFiltered.length > 0 &&
    deletableFiltered.every((it) => selected.has(it.id));

  const toggleAllDeletable = () => {
    const ids = deletableFiltered.map((it) => it.id);
    setSelectedIds((prev) => {
      const prevSet = new Set(prev);
      const allOn = ids.length > 0 && ids.every((id) => prevSet.has(id));
      if (allOn) return prev.filter((id) => !ids.includes(id));
      return [...new Set([...prev, ...ids])];
    });
  };

  const handleBatchDelete = () => {
    const ids = selectedIds.filter((id) => {
      const it = items.find((x) => x.id === id);
      return it && isServiceItemBatchDeletable(it);
    });
    if (ids.length === 0) {
      setImportMsg({ type: 'err', text: '没有可删除的条目（已入 Sheet 的不可删）' });
      return;
    }
    if (!confirm(`确定删除选中的 ${ids.length} 条未入 Sheet 执行内容？`)) return;
    deleteMut.mutate(ids);
  };

  const handleImported = ({ projectId, text }) => {
    setImportMsg({ type: 'ok', text });
    setProjectFilterId(projectId);
    setSelectedIds([]);
    qc.invalidateQueries({ queryKey: ['service-project-items'] });
    qc.invalidateQueries({ queryKey: ['execution-items', projectId] });
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  const fmt = (v) => (v === null || v === undefined || v === '' ? '-' : Number(v).toLocaleString('zh-CN', { maximumFractionDigits: 2 }));
  const money = (v) => (v === null || v === undefined || v === '' ? '-' : `¥${Number(v).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`);

  return (
    <div className="bg-white rounded-[2rem] shadow-sm border border-border/50 flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-semibold">服务管理</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isAdmin ? '管理员可查看全部项目' : '仅显示你参与的项目'} · 共 {filtered.length} 条
            {projectFilterId ? `（已筛选）` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={projectFilterId}
            onChange={(e) => {
              setProjectFilterId(e.target.value);
              setSelectedIds([]);
            }}
            className="px-3 py-2 bg-white rounded-full text-xs border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer max-w-[200px]"
          >
            <option value="">全部我的项目</option>
            {visibleProjects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索内容..."
              className="pl-9 pr-4 py-2 bg-white rounded-full text-xs border border-border/50 w-44 focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          {canEdit && (
            <>
              <button type="button" onClick={() => { setEditing(null); setShowForm(true); }}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-full text-xs font-medium hover:bg-primary/90">
                <Plus className="w-4 h-4" />新增
              </button>
              <button type="button" onClick={() => { setImportMsg(null); setShowImportModal(true); }}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-full text-xs font-medium hover:bg-primary/90">
                <Upload className="w-4 h-4" />导入到项目
              </button>
            </>
          )}
        </div>
      </div>

      {importMsg && (
        <div className={`mx-6 mt-3 px-3 py-2 rounded-lg text-xs flex items-start justify-between gap-2 ${importMsg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          <span>{importMsg.text}</span>
          <button type="button" onClick={() => setImportMsg(null)} className="shrink-0 opacity-70 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {canDelete && selectedIds.length > 0 && (
        <div className="mx-6 mt-3 px-4 py-2.5 rounded-xl bg-red-50 border border-red-100 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-xs text-red-800">已选 {selectedIds.length} 条可删除执行内容</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 rounded-full text-xs border border-red-200 text-red-700 hover:bg-white"
            >
              取消选择
            </button>
            <button
              type="button"
              onClick={handleBatchDelete}
              disabled={deleteMut.isPending}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-red-500 text-white rounded-full text-xs font-medium hover:bg-red-600 disabled:opacity-60"
            >
              {deleteMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              批量删除
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : visibleProjects.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-20">暂无可见项目</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-20">暂无执行内容，请「导入到项目」或「新增」</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-muted-foreground border-b border-border/40 whitespace-nowrap">
                  {canDelete && (
                    <th className="py-2 text-center w-10">
                      <input
                        type="checkbox"
                        checked={allDeletableSelected}
                        onChange={toggleAllDeletable}
                        disabled={deletableFiltered.length === 0}
                        title="全选可删除项（未入 Sheet）"
                      />
                    </th>
                  )}
                  <th className="py-2 text-left min-w-[100px]">项目</th>
                  <th className="py-2 text-left w-12">序号</th>
                  <th className="py-2 text-left">内容</th>
                  <th className="py-2 text-center w-12">单位</th>
                  <th className="py-2 text-center w-14">数量</th>
                  <th className="py-2 text-right w-20">立项单价</th>
                  <th className="py-2 text-right w-20">立项总价</th>
                  <th className="py-2 text-right w-20">预算单价</th>
                  <th className="py-2 text-right w-20">预算总价</th>
                  <th className="py-2 text-center w-16">状态</th>
                  {canEdit && <th className="py-2 w-20 text-center">操作</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((it) => {
                  const deletable = isServiceItemBatchDeletable(it);
                  return (
                    <tr key={it.id} className="border-b border-border/30 hover:bg-secondary/20">
                      {canDelete && (
                        <td className="py-2 text-center">
                          <input
                            type="checkbox"
                            checked={selected.has(it.id)}
                            disabled={!deletable}
                            onChange={() => toggleOne(it.id, deletable)}
                            title={deletable ? '选择删除' : '已入 Sheet，不可删除'}
                          />
                        </td>
                      )}
                      <td className="py-2 text-xs text-muted-foreground max-w-[120px] truncate" title={projectNameById[it.project_id] || it.project_name}>
                        {projectNameById[it.project_id] || it.project_name || '-'}
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">{it.seq_id || '-'}</td>
                      <td className="py-2 max-w-[240px]">
                        <p className="text-xs font-medium truncate" title={it.content}>{it.content}</p>
                        {it.detail && <p className="text-[10px] text-muted-foreground truncate">{it.detail}</p>}
                      </td>
                      <td className="py-2 text-center text-xs">{it.unit || '-'}</td>
                      <td className="py-2 text-center text-xs">{fmt(it.quantity)}</td>
                      <td className="py-2 text-right text-xs">{money(it.init_price)}</td>
                      <td className="py-2 text-right text-xs font-medium">{money(it.init_total)}</td>
                      <td className="py-2 text-right text-xs">{money(it.budget_price)}</td>
                      <td className="py-2 text-right text-xs font-medium">{money(it.budget_total)}</td>
                      <td className="py-2 text-center text-[10px]">
                        {it.sheet_id ? (
                          <span className="text-muted-foreground">已入Sheet</span>
                        ) : (
                          <span className="text-amber-700">待增项</span>
                        )}
                      </td>
                      {canEdit && (
                        <td className="py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button type="button" onClick={() => { setEditing(it); setShowForm(true); }} className="p-1.5 rounded-lg hover:bg-secondary">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {canDelete && deletable && (
                              <button
                                type="button"
                                onClick={() => { if (confirm('确定删除？')) deleteMut.mutate([it.id]); }}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <CatalogFormModal
          item={editing}
          visibleProjects={visibleProjects}
          defaultProjectId={projectFilterId || importProjects[0]?.id || visibleProjects[0]?.id || ''}
          onClose={closeForm}
        />
      )}

      {showImportModal && (
        <ImportToProjectModal
          eligibleProjects={importProjects}
          onClose={() => setShowImportModal(false)}
          onImported={handleImported}
        />
      )}
    </div>
  );
}
