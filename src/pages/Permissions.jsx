import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, Plus, Shield, Eye, Edit3, Trash2, X, Check, Save, Lock } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

const PERMISSIONS = [
  { module: '员工管理', actions: ['查看', '创建', '编辑', '删除'] },
  { module: '薪资管理', actions: ['查看', '创建', '编辑', '删除'] },
  { module: '权限管理', actions: ['查看', '创建', '编辑', '删除'] },
  { module: '审核流程', actions: ['查看', '创建', '编辑', '删除'] },
  { module: '报表导出', actions: ['查看', '创建', '编辑', '删除'] },
  { module: '系统设置', actions: ['查看', '创建', '编辑', '删除'] },
  { module: '商务管理', actions: ['查看', '创建', '编辑', '删除'] },
  { module: '项目管理', actions: ['查看', '创建', '编辑', '删除'] },
  { module: '服务管理', actions: ['查看', '创建', '编辑', '删除'] },
  { module: '项目审批', actions: ['查看', '创建', '编辑', '删除'] },
];

const COLOR_OPTIONS = [
  { value: 'purple', label: '紫色', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700' },
  { value: 'blue', label: '蓝色', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700' },
  { value: 'green', label: '绿色', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', badge: 'bg-green-100 text-green-700' },
  { value: 'orange', label: '橙色', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700' },
  { value: 'red', label: '红色', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', badge: 'bg-red-100 text-red-700' },
  { value: 'gray', label: '灰色', bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', badge: 'bg-gray-100 text-gray-600' },
];

const getColorCfg = (color) => COLOR_OPTIONS.find(c => c.value === color) || COLOR_OPTIONS[1];
const actionIcons = { '查看': Eye, '创建': Plus, '编辑': Edit3, '删除': Trash2 };

function RoleModal({ role, onClose, onSave }) {
  const defaultPerms = PERMISSIONS.reduce((acc, p) => { acc[p.module] = []; return acc; }, {});
  const [form, setForm] = useState({ name: '', description: '', color: 'blue', ...role });
  const [matrix, setMatrix] = useState(() => {
    try { return role?.permissions ? { ...defaultPerms, ...JSON.parse(role.permissions) } : defaultPerms; }
    catch { return defaultPerms; }
  });

  const togglePerm = (mod, action) => {
    setMatrix(prev => {
      const cur = prev[mod] || [];
      return { ...prev, [mod]: cur.includes(action) ? cur.filter(a => a !== action) : [...cur, action] };
    });
  };

  const handleSave = () => {
    if (!form.name) return;
    onSave({ ...form, permissions: JSON.stringify(matrix) });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card rounded-2xl shadow-xl w-[640px] max-h-[90vh] overflow-y-auto p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold">{role?.id ? '编辑角色' : '新增角色'}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-secondary rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">角色名称 *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">描述</label>
              <input value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">颜色标识</label>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map(c => (
                <button key={c.value} onClick={() => setForm(f => ({ ...f, color: c.value }))}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${form.color === c.value ? `${c.badge} border-current ring-2 ring-offset-1 ring-current` : `${c.bg} ${c.text} ${c.border}`}`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-2 block font-semibold">权限配置</label>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-secondary/60">
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">功能模块</th>
                    {PERMISSIONS[0].actions.map(a => (
                      <th key={a} className="px-4 py-2.5 text-muted-foreground font-medium text-center">{a}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSIONS.map(({ module, actions }) => (
                    <tr key={module} className="border-t border-border/40">
                      <td className="px-4 py-2.5 font-medium">{module}</td>
                      {actions.map(action => {
                        const enabled = (matrix[module] || []).includes(action);
                        return (
                          <td key={action} className="px-4 py-2.5 text-center">
                            <button onClick={() => togglePerm(module, action)}
                              className={`w-8 h-4 rounded-full transition-all duration-200 relative ${enabled ? 'bg-primary' : 'bg-border'}`}>
                              <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-all duration-200 ${enabled ? 'left-4' : 'left-0.5'}`} />
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-secondary rounded-xl text-sm hover:bg-border transition-colors">取消</button>
          <button onClick={handleSave} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">保存角色</button>
        </div>
      </div>
    </div>
  );
}

export default function Permissions() {
  const qc = useQueryClient();
  const { can, isLoadingEmployee } = useAuth();
  const canEditPermissions = can('权限管理', '编辑');
  const [activeTab, setActiveTab] = useState('matrix');
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [roleModal, setRoleModal] = useState(null);
  const [addingTo, setAddingTo] = useState(null);
  const [selectedToAdd, setSelectedToAdd] = useState([]);
  const [saved, setSaved] = useState(false);
  const [localMatrix, setLocalMatrix] = useState(null);

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.entities.Role.list('sort_order'),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.entities.Employee.list('name'),
  });

  const createRole = useMutation({
    mutationFn: (data) => api.entities.Role.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
  const updateRole = useMutation({
    mutationFn: ({ id, data }) => api.entities.Role.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
  const deleteRole = useMutation({
    mutationFn: (id) => api.entities.Role.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
  const updateEmp = useMutation({
    mutationFn: ({ id, data }) => api.entities.Employee.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  });

  const selectedRole = roles.find(r => r.id === selectedRoleId) || roles[0];
  const colorCfg = getColorCfg(selectedRole?.color);

  const defaultPerms = PERMISSIONS.reduce((acc, p) => { acc[p.module] = []; return acc; }, {});
  const currentMatrix = localMatrix || (() => {
    try { return selectedRole?.permissions ? { ...defaultPerms, ...JSON.parse(selectedRole.permissions) } : defaultPerms; }
    catch { return defaultPerms; }
  })();

  useEffect(() => { setLocalMatrix(null); }, [selectedRoleId, roles]);

  const togglePerm = (mod, action) => {
    setLocalMatrix(prev => {
      const base = prev || currentMatrix;
      const cur = base[mod] || [];
      return { ...base, [mod]: cur.includes(action) ? cur.filter(a => a !== action) : [...cur, action] };
    });
  };

  const saveMatrix = () => {
    if (!selectedRole) return;
    updateRole.mutate({ id: selectedRole.id, data: { permissions: JSON.stringify(localMatrix || currentMatrix) } });
    setSaved(true);
    setLocalMatrix(null);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleRoleSave = (form) => {
    if (form.id) updateRole.mutate({ id: form.id, data: form });
    else createRole.mutate({ ...form, is_system: false });
  };

  // People per role
  const peopleByRole = roles.reduce((acc, r) => {
    acc[r.name] = employees.filter(e => e.role === r.name);
    return acc;
  }, {});

  const assignedRoleNames = new Set(employees.map(e => e.role));
  const unassigned = employees.filter(e => !e.role || !roles.find(r => r.name === e.role));

  const confirmAdd = () => {
    if (!addingTo || selectedToAdd.length === 0) return;
    selectedToAdd.forEach(empId => {
      const emp = employees.find(e => e.id === empId);
      if (emp) updateEmp.mutate({ id: empId, data: { ...emp, role: addingTo } });
    });
    setAddingTo(null);
    setSelectedToAdd([]);
  };

  const removePerson = (empId, roleName) => {
    const emp = employees.find(e => e.id === empId);
    if (emp) updateEmp.mutate({ id: empId, data: { ...emp, role: '查看者' } });
  };

  if (!isLoadingEmployee && !can('权限管理', '查看')) {
    return (
      <div className="bg-white rounded-[2rem] shadow-sm border border-border/50 flex flex-col items-center justify-center h-full p-10">
        <Lock className="w-10 h-10 text-muted-foreground mb-3" />
        <h2 className="font-semibold text-lg">无访问权限</h2>
        <p className="text-sm text-muted-foreground mt-1">你的角色未开启「权限管理」查看权限</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[2rem] shadow-sm border border-border/50 flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-5 pb-4 border-b border-border flex items-center gap-4 flex-wrap">
        <h2 className="font-semibold text-lg shrink-0">权限管理</h2>
        {!canEditPermissions && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
            <Eye className="w-3 h-3" />仅查看模式
          </span>
        )}
        <div className="flex items-center bg-secondary rounded-full p-1 shadow-inner border border-border/20">
          {[['matrix', '权限矩阵'], ['roles', '角色管理'], ['people', '人员分配']].map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`px-5 py-1.5 rounded-full text-xs font-medium transition-all ${activeTab === key ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 flex-1 overflow-auto">
        {/* --- Tab: 权限矩阵 --- */}
        {activeTab === 'matrix' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="font-semibold">权限矩阵配置</h2>
                <p className="text-xs text-muted-foreground mt-0.5">点击开关切换权限后点「保存」生效</p>
              </div>
              <div className="flex items-center gap-2">
                {localMatrix && canEditPermissions && (
                  <button onClick={saveMatrix}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium shadow-sm transition-all ${saved ? 'bg-green-500 text-white' : 'bg-primary text-white hover:bg-primary/90'}`}>
                    <Save className="w-3.5 h-3.5" />{saved ? '✓ 已保存' : '保存配置'}
                  </button>
                )}
                <div className="flex bg-secondary rounded-full p-0.5 shadow-inner border border-border/20 flex-wrap">
                  {roles.map(r => (
                    <button key={r.id} onClick={() => setSelectedRoleId(r.id)}
                      className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${selectedRole?.id === r.id ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {selectedRole && (
              <div className="rounded-2xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-secondary/60">
                      <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium">功能模块</th>
                      {PERMISSIONS[0].actions.map(a => (
                        <th key={a} className="px-5 py-3 text-xs text-muted-foreground font-medium text-center">
                          <div className="flex items-center justify-center gap-1">
                            {(() => { const Icon = actionIcons[a]; return <Icon className="w-3 h-3" />; })()}
                            {a}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PERMISSIONS.map(({ module, actions }) => (
                      <tr key={module} className="border-t border-border/40 hover:bg-secondary/20 transition-colors">
                        <td className="px-5 py-3.5 font-medium">{module}</td>
                        {actions.map(action => {
                          const enabled = (currentMatrix[module] || []).includes(action);
                          return (
                            <td key={action} className="px-5 py-3.5 text-center">
                              <button onClick={() => { if (!selectedRole.is_system && canEditPermissions) togglePerm(module, action); }}
                                className={`w-9 h-5 rounded-full transition-all duration-200 relative ${enabled ? 'bg-primary' : 'bg-border'} ${(selectedRole.is_system || !canEditPermissions) ? 'cursor-not-allowed opacity-70' : ''}`}>
                                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${enabled ? 'left-4' : 'left-0.5'}`} />
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {selectedRole?.is_system && <p className="text-xs text-amber-600 bg-amber-50 px-4 py-2 rounded-xl">⚠️ 系统内置角色权限已锁定，如需修改请在「角色管理」中复制或新建角色</p>}
          </div>
        )}

        {/* --- Tab: 角色管理 --- */}
        {activeTab === 'roles' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">角色管理</h2>
                <p className="text-xs text-muted-foreground mt-0.5">管理系统角色，配置每个角色的权限范围</p>
              </div>
              {canEditPermissions && (
                <button onClick={() => setRoleModal({})}
                  className="flex items-center gap-1.5 px-5 py-2 bg-primary text-white rounded-full text-sm font-medium hover:bg-primary/90 shadow-sm transition-colors">
                  <Plus className="w-4 h-4" />新增角色
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {roles.map(role => {
                const c = getColorCfg(role.color);
                const count = employees.filter(e => e.role === role.name).length;
                return (
                  <div key={role.id} className={`rounded-2xl border p-4 ${c.border} ${c.bg}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Shield className={`w-4 h-4 ${c.text}`} />
                        <span className={`font-semibold text-sm ${c.text}`}>{role.name}</span>
                        {role.is_system && <span className="text-[10px] px-1.5 py-0.5 bg-white/60 rounded-full text-muted-foreground border border-border/30">系统内置</span>}
                      </div>
                      <span className={`text-lg font-bold ${c.text}`}>{count}<span className="text-xs font-normal ml-0.5">人</span></span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{role.description || '暂无描述'}</p>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        {(() => {
                          try {
                            const perms = JSON.parse(role.permissions || '{}');
                            const activeCount = Object.values(perms).flat().length;
                            return `${activeCount} 项权限`;
                          } catch { return '权限未配置'; }
                        })()}
                      </div>
                      {canEditPermissions && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => setRoleModal(role)} className="p-1.5 rounded-lg hover:bg-white/60 transition-colors">
                            <Edit3 className={`w-3.5 h-3.5 ${c.text}`} />
                          </button>
                          {!role.is_system && (
                            <button onClick={() => deleteRole.mutate(role.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --- Tab: 人员分配 --- */}
        {activeTab === 'people' && (
          <div className="space-y-4">
            <div>
              <h2 className="font-semibold">人员角色分配</h2>
              <p className="text-xs text-muted-foreground mt-0.5">点击「+」为角色添加成员，或点击成员卡片上的 × 移除</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {roles.map(role => {
                const c = getColorCfg(role.color);
                const roleEmps = employees.filter(e => e.role === role.name);
                return (
                  <div key={role.id} className="rounded-2xl border border-border overflow-hidden">
                    <div className={`px-4 py-3 border-b border-border flex items-center justify-between ${c.bg}`}>
                      <div className="flex items-center gap-2">
                        <Shield className={`w-3.5 h-3.5 ${c.text}`} />
                        <span className={`text-sm font-semibold ${c.text}`}>{role.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">{roleEmps.length}人</span>
                        {canEditPermissions && (
                          <button onClick={() => { setAddingTo(role.name); setSelectedToAdd([]); }}
                            className="w-5 h-5 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors">
                            <Plus className="w-3 h-3 text-white" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="p-2 min-h-24 bg-card">
                      {roleEmps.map(person => (
                        <div key={person.id}
                          className="flex items-center gap-2 p-2.5 rounded-xl mb-1.5 bg-card border border-border text-sm hover:border-primary/30 transition-colors group/card">
                          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-xs font-semibold shrink-0 text-white">
                            {person.name?.[0]}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-xs truncate">{person.name}</p>
                            <p className="text-muted-foreground text-xs truncate">{person.department}</p>
                          </div>
                          {canEditPermissions && (
                            <button onClick={() => removePerson(person.id, role.name)}
                              className="opacity-0 group-hover/card:opacity-100 transition-opacity p-0.5 hover:text-red-400 text-muted-foreground">
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                      {roleEmps.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">暂无成员</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Role modal */}
      {roleModal !== null && (
        <RoleModal role={Object.keys(roleModal).length > 0 ? roleModal : null} onClose={() => setRoleModal(null)} onSave={handleRoleSave} />
      )}

      {/* Add people modal */}
      {addingTo && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl shadow-xl w-96 p-5 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">添加成员 → {addingTo}</h3>
              <button onClick={() => setAddingTo(null)} className="p-1 hover:bg-secondary rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-1.5 max-h-72 overflow-auto">
              {employees.filter(e => e.role !== addingTo).map(p => {
                const sel = selectedToAdd.includes(p.id);
                return (
                  <button key={p.id} onClick={() => setSelectedToAdd(prev => sel ? prev.filter(id => id !== p.id) : [...prev, p.id])}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors border ${sel ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-secondary'}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${sel ? 'bg-primary text-white' : 'bg-secondary'}`}>
                      {sel ? <Check className="w-3 h-3" /> : p.name?.[0]}
                    </div>
                    <div className="text-left flex-1">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.department} · 当前: {p.role || '未分配'}</p>
                    </div>
                  </button>
                );
              })}
              {employees.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">暂无员工数据</p>}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setAddingTo(null)} className="flex-1 py-2 bg-secondary rounded-xl text-sm hover:bg-border transition-colors">取消</button>
              <button onClick={confirmAdd} disabled={selectedToAdd.length === 0}
                className="flex-1 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40">
                确认添加 {selectedToAdd.length > 0 ? `(${selectedToAdd.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}