import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Plus, Edit3, Trash2, X, Users, RefreshCw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toDepartmentWritePayload } from '@/lib/deptPayload';

const STATUSES = ['启用', '停用'];
const HEAD_NONE = '__none__';

function DeptModal({ dept, employees, onClose, onSave, saving, error }) {
  const [form, setForm] = useState(() => ({
    name: dept?.name || '',
    code: dept?.code || '',
    head: dept?.head || '',
    head_open_id: dept?.head_open_id || '',
    status: dept?.status || '启用',
    member_count: dept?.member_count ?? 0,
  }));
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const empNames = employees.map(e => e.name).filter(Boolean);

  const handleHeadChange = (v) => {
    if (v === HEAD_NONE) {
      f('head', '');
      f('head_open_id', '');
      return;
    }
    const emp = employees.find(e => e.name === v);
    setForm(p => ({
      ...p,
      head: v,
      head_open_id: emp?.employee_id || '',
    }));
  };

  const handleSubmit = () => {
    if (!form.name?.trim() || saving) return;
    onSave(form);
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card rounded-2xl shadow-xl w-[420px] p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold">{dept ? '编辑部门' : '新增部门'}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-secondary rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">部门名称 *</label>
            <input value={form.name} onChange={e => f('name', e.target.value)} className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">部门代码</label>
            <input value={form.code || ''} onChange={e => f('code', e.target.value)} className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground">部门负责人</label>
            <Select value={form.head || HEAD_NONE} onValueChange={handleHeadChange}>
              <SelectTrigger className="mt-1 bg-secondary rounded-xl text-sm border-0 focus:ring-primary h-9"><SelectValue placeholder="请选择负责人" /></SelectTrigger>
              <SelectContent className="rounded-xl max-h-60">
                <SelectItem value={HEAD_NONE} className="text-sm text-muted-foreground">未指定</SelectItem>
                {empNames.map(n => <SelectItem key={n} value={n} className="text-sm">{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground">状态</label>
            <Select value={form.status || '启用'} onValueChange={v => f('status', v)}>
              <SelectTrigger className="mt-1 bg-secondary rounded-xl text-sm border-0 focus:ring-primary h-9"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-xl">
                {STATUSES.map(s => <SelectItem key={s} value={s} className="text-sm">{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {error && (
          <p className="mt-3 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 bg-secondary rounded-xl text-sm hover:bg-border transition-colors disabled:opacity-60">取消</button>
          <button onClick={handleSubmit} disabled={!form.name?.trim() || saving} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DeptManagement() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const list = await api.entities.Department.list('-created_date');
      return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const list = await api.entities.Employee.list('-created_date');
      return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.entities.Department.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['departments'] });
      setModal(null);
      setSaveError(null);
    },
    onError: (e) => setSaveError(e?.message || '保存失败，请稍后重试'),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.Department.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['departments'] });
      setModal(null);
      setSaveError(null);
    },
    onError: (e) => setSaveError(e?.message || '保存失败，请稍后重试'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.Department.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['departments'] }),
  });

  const saving = createMutation.isPending || updateMutation.isPending;

  const handleSave = (form) => {
    setSaveError(null);
    const data = toDepartmentWritePayload(form);
    if (!data.name) {
      setSaveError('请填写部门名称');
      return;
    }
    if (modal?.id) updateMutation.mutate({ id: modal.id, data });
    else createMutation.mutate(data);
  };

  const openCreate = () => {
    setSaveError(null);
    setModal({});
  };

  const openEdit = (d) => {
    setSaveError(null);
    // Don't pass computed_count into modal — only editable fields
    setModal({
      id: d.id,
      name: d.name,
      code: d.code,
      head: d.head,
      head_open_id: d.head_open_id,
      status: d.status,
      member_count: d.member_count,
    });
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await api.functions.invoke('syncFeishuOrg', {});
      setSyncResult(res);
      qc.invalidateQueries({ queryKey: ['departments'] });
      qc.invalidateQueries({ queryKey: ['employees'] });
    } catch (e) {
      setSyncResult({ error: e.message });
    }
    setSyncing(false);
  };

  // Compute member count from employees
  const deptWithCounts = departments.map(d => ({
    ...d,
    computed_count: employees.filter(e => e.department === d.name).length,
  }));

  return (
    <div className="bg-white rounded-[2rem] shadow-sm border border-border/50 flex flex-col h-full overflow-hidden">
      <div className="px-6 py-5 border-b border-border flex items-center justify-between">
        <h2 className="font-semibold text-lg">部门管理</h2>
        <div className="flex items-center gap-2">
          {syncResult && (
            <span className={`text-xs px-3 py-1 rounded-full ${syncResult.error ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
              {syncResult.error ? `失败: ${syncResult.error}` : `✓ 同步 ${syncResult.departments?.created + syncResult.departments?.updated} 个部门`}
            </span>
          )}
          <button onClick={handleSync} disabled={syncing}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 text-white rounded-full text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-60 shadow-sm">
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />从飞书同步
          </button>
          <button onClick={openCreate} className="flex items-center gap-1.5 px-5 py-2 bg-primary text-white rounded-full text-sm font-medium hover:bg-primary/90 shadow-sm transition-colors">
            <Plus className="w-4 h-4" />新增部门
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">加载中...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary/60">
                {['部门名称', '代码', '负责人', '人员数', '飞书ID', '状态', '操作'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs text-muted-foreground font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deptWithCounts.map(d => (
                <tr key={d.id} className="border-t border-border/40 hover:bg-secondary/20 transition-colors group">
                  <td className="px-5 py-3.5 font-medium">{d.name}</td>
                  <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">{d.code || '-'}</td>
                  <td className="px-5 py-3.5">
                    {d.head ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-xs font-semibold text-white">{d.head[0]}</div>
                        {d.head}
                      </div>
                    ) : <span className="text-muted-foreground">-</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="flex items-center gap-1 text-muted-foreground"><Users className="w-3 h-3" />{d.computed_count}</span>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">{d.feishu_dept_id || '-'}</td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${d.status === '启用' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {d.status || '启用'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(d)} className="p-1.5 rounded-lg hover:bg-secondary"><Edit3 className="w-3.5 h-3.5 text-muted-foreground" /></button>
                      <button onClick={() => deleteMutation.mutate(d.id)} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {deptWithCounts.length === 0 && !isLoading && (
                <tr><td colSpan={7} className="px-5 py-16 text-center text-sm text-muted-foreground">暂无部门数据，点击「从飞书同步」或手动新增</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {modal !== null && (
        <DeptModal
          dept={Object.keys(modal).length > 0 ? modal : null}
          employees={employees}
          saving={saving}
          error={saveError}
          onClose={() => { if (!saving) { setModal(null); setSaveError(null); } }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}