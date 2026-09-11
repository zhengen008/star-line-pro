import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Plus, X, Clock, CheckCircle2, XCircle, Send, ChevronRight, FolderKanban } from 'lucide-react';

function getUserName() {
  try { return JSON.parse(localStorage.getItem('feishu_user'))?.name || ''; } catch { return ''; }
}

const APPROVAL_TYPES = [
  { key: 'reimbursement', label: '日常报销', icon: '🧾', direction: '支出' },
  { key: 'project_payment', label: '付款申请', icon: '💳', direction: '支出' },
  { key: 'project_reserve', label: '备用金申请', icon: '🏦', direction: '支出' },
  { key: 'project_purchase', label: '项目采购', icon: '📦', direction: '支出' },
  { key: 'invoice', label: '开票申请', icon: '🧾', direction: '收入' },
  { key: 'seal', label: '用章申请', icon: '🔏', direction: '无' },
  { key: 'contract', label: '合同审批', icon: '📄', direction: '无' },
];

const STATUS_MAP = {
  '待审核': { color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  '审核中': { color: 'bg-blue-100 text-blue-700', icon: Clock },
  '已通过': { color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  '已拒绝': { color: 'bg-red-100 text-red-700', icon: XCircle },
  '已付款': { color: 'bg-purple-100 text-purple-700', icon: CheckCircle2 },
};

function NewApprovalModal({ onClose, onCreate }) {
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.entities.Project.list(),
  });
  const [step, setStep] = useState(1);
  const [projectId, setProjectId] = useState('');
  const [typeKey, setTypeKey] = useState('');
  const [form, setForm] = useState({ title: '', amount: '', description: '' });

  const typeObj = APPROVAL_TYPES.find(t => t.key === typeKey);
  const project = projects.find(p => p.id === projectId);
  const eligibleProjects = projects.filter(p => !['待审批', '立项审批中'].includes(p.status));

  const handleSubmit = () => {
    const amount = parseFloat(String(form.amount).replace(/[¥,万元]/g, '')) || 0;
    onCreate({
      title: form.title || typeObj.label,
      type: typeKey,
      type_label: typeObj.label,
      applicant: getUserName(),
      dept: '业务管理',
      fields: JSON.stringify({ 说明: form.description }),
      amount,
      direction: typeObj.direction,
      project_id: projectId,
      project_name: project?.name || '',
      status: '待审核',
      cc_list: [],
      steps: '[]',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card rounded-2xl shadow-xl w-[520px] max-h-[85vh] flex flex-col animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-semibold">发起项目审批</h3>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-auto p-6 space-y-4">
          {step === 1 && (
            <>
              <div>
                <label className="text-xs text-muted-foreground">关联项目 *</label>
                <select value={projectId} onChange={e => setProjectId(e.target.value)}
                  className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-lime-400 cursor-pointer">
                  <option value="">请选择项目...</option>
                  {eligibleProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">审批类型 *</label>
                <div className="grid grid-cols-3 gap-2">
                  {APPROVAL_TYPES.map(t => (
                    <button key={t.key} type="button" onClick={() => setTypeKey(t.key)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${typeKey === t.key ? 'border-lime-400 bg-lime-400/10' : 'border-border hover:border-lime-400/50'}`}>
                      <span className="text-xl">{t.icon}</span>
                      <span className="text-xs font-medium">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end">
                <button onClick={() => setStep(2)} disabled={!projectId || !typeKey}
                  className="px-5 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors">
                  下一步
                </button>
              </div>
            </>
          )}
          {step === 2 && typeObj && (
            <>
              <button onClick={() => setStep(1)} className="text-xs text-muted-foreground hover:text-foreground">← 返回</button>
              <div className="flex items-center gap-3 p-3 bg-secondary rounded-xl text-sm">
                <span className="text-xl">{typeObj.icon}</span>
                <div>
                  <p className="font-medium">{typeObj.label}</p>
                  <p className="text-xs text-muted-foreground">项目：{project?.name}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">申请标题</label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-lime-400" />
                </div>
                {typeObj.direction !== '无' && (
                  <div>
                    <label className="text-xs text-muted-foreground">金额 (¥)</label>
                    <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-lime-400" />
                  </div>
                )}
                <div>
                  <label className="text-xs text-muted-foreground">说明</label>
                  <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    rows={2} className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-lime-400 resize-none" />
                </div>
              </div>
              <button onClick={handleSubmit}
                className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
                <Send className="w-3.5 h-3.5" />提交审批
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProjectApproval() {
  const qc = useQueryClient();
  const [typeFilter, setTypeFilter] = useState('全部');
  const [statusFilter, setStatusFilter] = useState('全部');
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew] = useState(false);

  // Read from unified Approval entity, filter by project_id not empty
  const { data: allApprovals = [], isLoading } = useQuery({
    queryKey: ['all-approvals'],
    queryFn: () => api.entities.Approval.list('-created_date'),
  });

  const approvals = allApprovals.filter(a => a.project_id);

  const createMutation = useMutation({
    mutationFn: (data) => api.entities.Approval.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['all-approvals'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.Approval.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['all-approvals'] }),
  });

  const handleApprove = (id, pass) => {
    updateMutation.mutate({ id, data: { status: pass ? '已通过' : '已拒绝' } });
    setSelected(null);
  };

  const filtered = approvals.filter(a => {
    const matchType = typeFilter === '全部' || a.type_label === typeFilter;
    const matchStatus = statusFilter === '全部' || a.status === statusFilter;
    return matchType && matchStatus;
  });

  const detail = selected ? approvals.find(a => a.id === selected) : null;

  return (
    <div className="bg-card rounded-2xl shadow-sm flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <h2 className="font-semibold">项目审批</h2>
        <div className="flex items-center gap-2">
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 bg-secondary rounded-xl text-xs border-0 focus:outline-none focus:ring-2 focus:ring-lime-400 cursor-pointer">
            {['全部', ...APPROVAL_TYPES.map(t => t.label)].map(t => <option key={t}>{t}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-secondary rounded-xl text-xs border-0 focus:outline-none focus:ring-2 focus:ring-lime-400 cursor-pointer">
            {['全部', ...Object.keys(STATUS_MAP)].map(s => <option key={s}>{s}</option>)}
          </select>
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-xl text-xs font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-3.5 h-3.5" />发起审批
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">加载中...</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary/50">
                  {['标题', '类型', '关联项目', '申请人', '金额', '日期', '状态', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs text-muted-foreground font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => {
                  const s = STATUS_MAP[a.status] || STATUS_MAP['待审核'];
                  const Icon = s.icon;
                  const t = APPROVAL_TYPES.find(t => t.key === a.type);
                  return (
                    <tr key={a.id} onClick={() => setSelected(a.id)} className="border-t border-border/40 hover:bg-secondary/20 cursor-pointer group">
                      <td className="px-5 py-3 font-medium">{a.title}</td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">{t?.icon || '📋'} {a.type_label}</td>
                      <td className="px-5 py-3 text-xs">
                        {a.project_name ? (
                          <span className="flex items-center gap-1 text-blue-600"><FolderKanban className="w-3 h-3" />{a.project_name}</span>
                        ) : '-'}
                      </td>
                      <td className="px-5 py-3 text-xs">{a.applicant}</td>
                      <td className="px-5 py-3 font-medium">
                        {a.amount > 0 ? (
                          <span className={a.direction === '收入' ? 'text-green-600' : 'text-red-600'}>
                            {a.direction === '收入' ? '+' : '-'}¥{(a.amount || 0).toLocaleString()}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">{a.created_date?.split('T')[0]}</td>
                      <td className="px-5 py-3">
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium w-fit ${s.color}`}>
                          <Icon className="w-3 h-3" />{a.status}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && !isLoading && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">暂无项目审批记录</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {detail && (
          <div className="w-64 border-l border-border flex flex-col animate-fade-in shrink-0">
            <div className="px-4 py-4 border-b border-border flex items-center justify-between">
              <p className="font-semibold text-sm truncate">{detail.title}</p>
              <button onClick={() => setSelected(null)} className="p-1 hover:bg-secondary rounded-lg ml-2"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-3 flex-1 overflow-auto">
              <div className="space-y-2">
                {[['类型', detail.type_label], ['关联项目', detail.project_name], ['申请人', detail.applicant], ['日期', detail.created_date?.split('T')[0]]].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{k}</span><span className="font-medium text-xs">{v || '-'}</span>
                  </div>
                ))}
                {(() => {
                  let fields = {};
                  try { fields = JSON.parse(detail.fields || '{}'); } catch {}
                  return Object.entries(fields).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{k}</span><span className="font-medium text-xs">{v}</span>
                    </div>
                  ));
                })()}
                {detail.amount > 0 && (
                  <div className="flex justify-between text-sm pt-1 border-t border-border">
                    <span className="text-muted-foreground">金额</span>
                    <span className={`font-semibold ${detail.direction === '收入' ? 'text-green-600' : 'text-red-600'}`}>
                      {detail.direction === '收入' ? '+' : '-'}¥{(detail.amount || 0).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
              {(detail.status === '待审核' || detail.status === '审核中') && (
                <div className="flex gap-2 pt-2">
                  <button onClick={() => handleApprove(detail.id, false)}
                    className="flex-1 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-medium hover:bg-red-100 transition-colors">拒绝</button>
                  <button onClick={() => handleApprove(detail.id, true)}
                    className="flex-1 py-2 bg-primary text-white rounded-xl text-xs font-medium hover:bg-primary/90 transition-colors">通过</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showNew && <NewApprovalModal onClose={() => setShowNew(false)} onCreate={(data) => createMutation.mutate(data)} />}
    </div>
  );
}