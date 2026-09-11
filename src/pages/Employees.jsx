import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Search, Plus, X, Edit3, Trash2, Building2, RefreshCw, ChevronLeft, ChevronRight, Shield } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const EMP_TYPES = ['全职', '兼职', '合同工', '实习'];
const STATUSES = ['在职', '试用期', '离职'];
const STATUS_COLORS = { '在职': 'bg-green-100 text-green-700', '试用期': 'bg-blue-100 text-blue-700', '离职': 'bg-red-100 text-red-700' };
const ROLE_COLORS = { '管理员': 'bg-purple-100 text-purple-700', '审核员': 'bg-blue-100 text-blue-700', '普通员工': 'bg-green-100 text-green-700', '查看者': 'bg-gray-100 text-gray-600' };
const PAGE_SIZE = 12;

function EmployeeModal({ emp, roles, departments, onClose, onSave }) {
  const [form, setForm] = useState(emp || {
    employee_id: `EMP-${Date.now().toString().slice(-6)}`,
    name: '', department: '', position: '',
    employment_type: '全职', base_salary: 0, status: '在职', role: '普通员工', email: '', join_date: ''
  });
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const deptNames = departments.map(d => d.name);
  const roleNames = roles.map(r => r.name);

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card rounded-2xl shadow-xl w-[500px] max-h-[90vh] overflow-y-auto p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold">{emp ? '编辑员工' : '新增员工'}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-secondary rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">姓名 *</label>
            <input value={form.name} onChange={e => f('name', e.target.value)} className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">职位</label>
            <input value={form.position} onChange={e => f('position', e.target.value)} className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">邮箱</label>
            <input type="email" value={form.email} onChange={e => f('email', e.target.value)} className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">入职日期</label>
            <input type="date" value={form.join_date} onChange={e => f('join_date', e.target.value)} className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">基本薪资</label>
            <input type="number" value={form.base_salary} onChange={e => f('base_salary', +e.target.value)} className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">雇用类型</label>
            <Select value={form.employment_type} onValueChange={v => f('employment_type', v)}>
              <SelectTrigger className="mt-1 bg-secondary rounded-xl text-sm border-0 focus:ring-primary h-9"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-xl">{EMP_TYPES.map(o => <SelectItem key={o} value={o} className="text-sm">{o}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">部门</label>
            <Select value={form.department} onValueChange={v => f('department', v)}>
              <SelectTrigger className="mt-1 bg-secondary rounded-xl text-sm border-0 focus:ring-primary h-9"><SelectValue placeholder="选择部门" /></SelectTrigger>
              <SelectContent className="rounded-xl max-h-52">{deptNames.map(d => <SelectItem key={d} value={d} className="text-sm">{d}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">角色</label>
            <Select value={form.role} onValueChange={v => f('role', v)}>
              <SelectTrigger className="mt-1 bg-secondary rounded-xl text-sm border-0 focus:ring-primary h-9"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-xl">{roleNames.map(r => <SelectItem key={r} value={r} className="text-sm">{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground">状态</label>
            <Select value={form.status} onValueChange={v => f('status', v)}>
              <SelectTrigger className="mt-1 bg-secondary rounded-xl text-sm border-0 focus:ring-primary h-9"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-xl">{STATUSES.map(s => <SelectItem key={s} value={s} className="text-sm">{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-secondary rounded-xl text-sm hover:bg-border transition-colors">取消</button>
          <button onClick={() => { if (form.name) { onSave(form); onClose(); } }} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">保存</button>
        </div>
      </div>
    </div>
  );
}

export default function Employees() {
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('全部');
  const [roleFilter, setRoleFilter] = useState('全部');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const { data: employees = [], isLoading: empLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.entities.Employee.list('-created_date'),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const list = await api.entities.Department.list('-created_date');
      return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const list = await api.entities.Role.list('-created_date');
      return list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.entities.Employee.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.Employee.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.Employee.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  });

  const handleSave = (form) => {
    if (modal?.id) updateMutation.mutate({ id: modal.id, data: form });
    else createMutation.mutate(form);
    setModal(null);
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await api.functions.invoke('syncFeishuOrg', {});
      setSyncResult(res);
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['departments'] });
    } catch (e) {
      setSyncResult({ error: e.message });
    }
    setSyncing(false);
  };

  const deptNames = ['全部', ...departments.map(d => d.name)];
  const roleNames = ['全部', ...roles.map(r => r.name)];

  const filtered = useMemo(() => employees.filter(e => {
    const ms = !search || e.name?.includes(search) || e.employee_id?.includes(search) || e.position?.includes(search);
    const md = deptFilter === '全部' || e.department === deptFilter;
    const mr = roleFilter === '全部' || e.role === roleFilter;
    return ms && md && mr;
  }), [employees, search, deptFilter, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const deptStats = departments.map(d => ({
    dept: d.name,
    count: employees.filter(e => e.department === d.name).length,
    roles: roles.map(r => ({ role: r.name, count: employees.filter(e => e.department === d.name && e.role === r.name).length }))
  }));

  const tabs = ['员工列表', '部门概览', '角色统计'];

  return (
    <div className="bg-white rounded-[2rem] shadow-sm border border-border/50 flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-4 px-6 pt-5 pb-4 border-b border-border flex-wrap">
        <h2 className="font-semibold text-lg shrink-0">员工管理</h2>
        <div className="flex items-center bg-secondary rounded-full p-1 shadow-inner border border-border/20">
          {tabs.map((t, i) => (
            <button key={t} onClick={() => setTab(i)}
              className={`px-5 py-1.5 rounded-full text-xs font-medium transition-all ${tab === i ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {syncResult && (
            <span className={`text-xs px-3 py-1 rounded-full ${syncResult.error ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
              {syncResult.error ? `同步失败: ${syncResult.error}` : `✓ 同步完成 部门${syncResult.departments?.created + syncResult.departments?.updated}个 员工${syncResult.employees?.created + syncResult.employees?.updated}人`}
            </span>
          )}
          <button onClick={handleSync} disabled={syncing}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 text-white rounded-full text-xs font-medium hover:bg-blue-600 transition-colors disabled:opacity-60 shadow-sm">
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? '同步中...' : '从飞书同步'}
          </button>
        </div>
      </div>

      <div className="p-6 flex-1 flex flex-col gap-4 overflow-auto">
        {tab === 0 && <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                  placeholder="搜索姓名、工号..." className="pl-9 pr-4 py-2 bg-white rounded-full text-xs border border-border/50 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary w-48 transition-shadow" />
              </div>
              <Select value={deptFilter} onValueChange={v => { setDeptFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[130px] h-9 bg-white rounded-full text-xs border border-border/50 shadow-sm"><SelectValue placeholder="全部部门" /></SelectTrigger>
                <SelectContent className="rounded-xl max-h-60">{deptNames.map(d => <SelectItem key={d} value={d} className="text-xs">{d === '全部' ? '全部部门' : d}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={roleFilter} onValueChange={v => { setRoleFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[130px] h-9 bg-white rounded-full text-xs border border-border/50 shadow-sm"><SelectValue placeholder="全部角色" /></SelectTrigger>
                <SelectContent className="rounded-xl">{roleNames.map(r => <SelectItem key={r} value={r} className="text-xs">{r === '全部' ? '全部角色' : r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <button onClick={() => setModal({})} className="flex items-center gap-1.5 px-5 py-2 bg-primary text-white rounded-full text-xs font-medium hover:bg-primary/90 shadow-sm transition-colors">
              <Plus className="w-4 h-4" />新增员工
            </button>
          </div>

          <div className="flex-1 rounded-2xl border border-border overflow-hidden">
            {empLoading ? (
              <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">加载中...</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary/60">
                    {['员工ID', '姓名', '部门', '职位', '角色', '雇用类型', '薪资', '状态', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageData.map(emp => (
                    <tr key={emp.id} className="border-t border-border/40 hover:bg-secondary/20 transition-colors group">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{emp.employee_id}</td>
                      <td className="px-4 py-3 font-medium">{emp.name}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-muted-foreground text-xs">
                          <Building2 className="w-3 h-3" />{emp.department || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{emp.position || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[emp.role] || 'bg-gray-100 text-gray-600'}`}>{emp.role}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{emp.employment_type}</td>
                      <td className="px-4 py-3 font-medium text-xs">¥{(emp.base_salary || 0).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[emp.status] || 'bg-gray-100 text-gray-600'}`}>{emp.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setModal(emp)} className="p-1.5 rounded-lg hover:bg-secondary"><Edit3 className="w-3.5 h-3.5 text-muted-foreground" /></button>
                          <button onClick={() => deleteMutation.mutate(emp.id)} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {pageData.length === 0 && <tr><td colSpan={9} className="px-4 py-16 text-center text-sm text-muted-foreground">暂无员工数据，点击「从飞书同步」导入</td></tr>}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">共 {filtered.length} 条记录</p>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-secondary disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = page <= 3 ? i + 1 : page - 2 + i;
                if (p < 1 || p > totalPages) return null;
                return <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 rounded-full text-sm font-medium transition-colors ${page === p ? 'bg-foreground text-background' : 'hover:bg-secondary text-muted-foreground'}`}>{p}</button>;
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-secondary disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        </>}

        {tab === 1 && (
          <div className="space-y-3">
            <h2 className="font-semibold">部门概览</h2>
            {departments.length === 0 ? (
              <div className="text-sm text-muted-foreground py-12 text-center">暂无部门数据，请先从飞书同步或在部门管理中添加</div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {deptStats.map(({ dept, count, roles: dr }) => (
                  <div key={dept} className="rounded-2xl border border-border p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-sm">{dept}</span>
                      <span className="text-2xl font-bold text-primary">{count}</span>
                    </div>
                    <div className="space-y-1.5">
                      {dr.filter(r => r.count > 0).map(({ role, count: c }) => (
                        <div key={role} className="flex items-center justify-between">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[role] || 'bg-gray-100 text-gray-600'}`}>{role}</span>
                          <span className="text-xs text-muted-foreground">{c}人</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 2 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-base">角色统计</h2>
            <div className="grid grid-cols-2 gap-4">
              {roles.map(role => {
                const roleEmps = employees.filter(e => e.role === role.name);
                return (
                  <div key={role.id} className="rounded-2xl border border-border p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-sm">{role.name}</span>
                      </div>
                      <span className="text-xl font-bold text-primary">{roleEmps.length}<span className="text-xs text-muted-foreground font-normal ml-1">人</span></span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{role.description}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {roleEmps.slice(0, 6).map(e => (
                        <div key={e.id} className="flex items-center gap-1 px-2 py-1 bg-secondary rounded-lg">
                          <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-white">{e.name?.[0]}</div>
                          <span className="text-xs">{e.name}</span>
                        </div>
                      ))}
                      {roleEmps.length > 6 && <span className="text-xs text-muted-foreground px-2 py-1">+{roleEmps.length - 6}人</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {modal !== null && (
        <EmployeeModal emp={Object.keys(modal).length > 0 ? modal : null} roles={roles} departments={departments} onClose={() => setModal(null)} onSave={handleSave} />
      )}
    </div>
  );
}