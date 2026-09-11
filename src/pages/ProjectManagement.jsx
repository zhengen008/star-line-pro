import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/api/client';
import { Plus, X, Search, ChevronRight, Clock, CheckCircle2, Layers, AlertTriangle, Archive, LayoutGrid, List, Send } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ProjectCard from '../components/project/ProjectCard';
import { calcProgress } from '../components/project/ProjectProgress';
import EmployeePicker from '../components/EmployeePicker';
import InitiateApprovalModal from '../components/approval/InitiateApprovalModal';
import SubmitInitiationModal from '../components/project/SubmitInitiationModal';
import { useAuth } from '@/lib/AuthContext';
import { canSubmitProjectInitiation } from '@/lib/bidProjectSync';
import { submitProjectInitiation } from '@/lib/projectInitiationApproval';
import { createApprovalWithSteps } from '@/lib/createApprovalWithSteps';

const STATUS_MAP = {
  '待立项': { color: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
  '待审批': { color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  '执行中': { color: 'bg-blue-100 text-blue-700', icon: Layers },
  '完成审批中': { color: 'bg-purple-100 text-purple-700', icon: Clock },
  '已完成': { color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  '已归档': { color: 'bg-gray-100 text-gray-600', icon: Archive },
};

/**
 * InitiateModal - 手动立项表单（仅管理员）
 * 从「中标且未关联项目」的竞标中选择，直接创建「执行中」项目（免审批）
 */
function InitiateModal({ onClose, onSave }) {
  const [bidId, setBidId] = useState('');
  const [form, setForm] = useState({ contractNo: '', budgetCost: '', members: [], startDate: '', endDate: '', projectManager: '' });
  const { data: bidOptions = [] } = useQuery({
    queryKey: ['bids'],
    queryFn: () => api.entities.Bid.list('-created_date'),
  });
  const { data: existingProjects = [] } = useQuery({
    queryKey: ['projects-for-bid-check'],
    queryFn: () => api.entities.Project.list('-created_date'),
  });
  const linkedBidIds = new Set(existingProjects.map(p => p.bid_id).filter(Boolean));
  const availableBids = bidOptions.filter(b => b.result === '中标' && !linkedBidIds.has(b.id));
  const bid = bidOptions.find(b => b.id === bidId);
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (!bidId || !form.startDate || !form.endDate || !form.projectManager) return;
    const budgetCost = +form.budgetCost || 0;
    onSave({
      bid_id: bidId,
      name: bid.project_name,
      customer: bid.customer_name,
      project_type: bid.project_type,
      contract_amount: bid.bid_amount,
      payment_method: bid.payment_method || '里程碑付款',
      contract_no: form.contractNo,
      start_date: form.startDate,
      end_date: form.endDate,
      budget_cost: budgetCost,
      remaining_budget: budgetCost,
      manager: form.projectManager,
      members: form.members,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.12)] w-[560px] max-h-[90vh] flex flex-col animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-semibold">项目立项</h3>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-auto p-6 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground">关联商务项目（仅显示中标且未关联项目）*</label>
            <select value={bidId} onChange={e => setBidId(e.target.value)}
              className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-lime-400 cursor-pointer">
              <option value="">请选择中标项目...</option>
              {availableBids.map(b => <option key={b.id} value={b.id}>{b.project_name} · {b.customer_name}</option>)}
            </select>
            {availableBids.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">⚠️ 暂无可立项的中标项目，请先到「竞标管理」标记中标</p>
            )}
          </div>
          {bid && (
            <div className="bg-lime-50 border border-lime-200 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-lime-700 flex items-center gap-1">
                ✓ 已自动同步竞标数据，立项后将沿用以下信息：
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">客户：</span><span className="font-medium">{bid.customer_name}</span></div>
                <div><span className="text-muted-foreground">项目类型：</span><span className="font-medium">{bid.project_type || '-'}</span></div>
                <div><span className="text-muted-foreground">合同金额：</span><span className="font-medium text-lime-700">¥{((bid.bid_amount || 0) / 10000).toFixed(0)}万</span></div>
                <div><span className="text-muted-foreground">商务负责人：</span><span className="font-medium">{bid.manager || '-'}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">结算方式：</span><span className="font-medium text-lime-700">{bid.payment_method || '-'}</span></div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">开始时间 *</label>
              <input type="date" value={form.startDate} onChange={e => f('startDate', e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-lime-400" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">结束时间 *</label>
              <input type="date" value={form.endDate} onChange={e => f('endDate', e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-lime-400" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">合同编号（可选）</label>
              <input value={form.contractNo} onChange={e => f('contractNo', e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-lime-400" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">总成本预算（元）</label>
              <input type="number" value={form.budgetCost} onChange={e => f('budgetCost', e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-lime-400" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">项目负责人 *<span className="ml-1 text-muted-foreground/60">（二级负责人）</span></label>
              <EmployeePicker value={form.projectManager} onChange={v => f('projectManager', v)} placeholder="请选择项目负责人..." className="mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">项目成员（三级负责人）</label>
            <EmployeePicker value={form.members} onChange={v => f('members', v)} multiple placeholder="请选择项目成员..." className="mt-1" />
          </div>
          <div className="bg-lime-50 border border-lime-200 rounded-xl p-3 text-xs text-lime-700">
            <strong>立项说明：</strong>提交后项目<b>直接立项启动</b>（免审批），并通知项目负责人与成员
          </div>
        </div>
        <div className="flex gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="flex-1 py-2.5 bg-secondary rounded-xl text-sm hover:bg-border transition-colors">取消</button>
          <button onClick={handleSave} disabled={!bidId || !form.startDate || !form.endDate || !form.projectManager}
            className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40">
            提交立项
          </button>
        </div>
      </div>
    </div>
  );
}

// 项目立项成功后通知项目相关成员（负责人 + 成员）
async function notifyProjectStarted(project, manager, members) {
  try {
    const recipients = [manager, ...(members || [])].filter(Boolean);
    if (recipients.length === 0) return;
    await api.functions.invoke('createNotification', {
      recipients,
      type: 'project_status',
      title: `项目立项成功：${project.name}`,
      content: `项目「${project.name}」已立项并启动，请关注项目进展`,
      link: '/projects',
      related_id: project.id,
      priority: 'high',
    });
  } catch (e) { console.error('notifyProjectStarted failed:', e); }
}

export default function ProjectManagement() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [view, setView] = useState('list'); // list | grid - 默认列表展示
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('全部');
  const [showNew, setShowNew] = useState(false); // 手动立项（仅管理员）
  const [showInitiateApproval, setShowInitiateApproval] = useState(false);
  const [initiatingProject, setInitiatingProject] = useState(null);

  const { currentUserName, isAdmin, currentEmployee } = useAuth();

  // 兼容旧链接 ?id=xxx → 直接跳转到详情页（仅在挂载时处理一次）
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const id = searchParams.get('id');
    if (id) navigate(`/projects/${id}`, { replace: true });
  }, []);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.entities.Project.list('-created_date'),
  });

  const { data: allApprovals = [] } = useQuery({
    queryKey: ['all-approvals'],
    queryFn: () => api.entities.Approval.list('-created_date'),
  });

  // 手动立项（从选中的中标竞标直接创建项目，立项免审批 → 直接执行中）
  const createMutation = useMutation({
    mutationFn: async (data) => {
      const project = await api.entities.Project.create({ ...data, status: '执行中' });
      await api.entities.ProjectLog.create({
        project_id: project.id, action: '项目立项',
        detail: `创建项目「${data.name}」，合同金额¥${data.contract_amount}，预算¥${data.budget_cost}，立项免审批直接启动`,
        operator: currentUserName,
      });
      // 通知项目相关成员（负责人 + 成员）
      await notifyProjectStarted(project, data.manager, data.members);
      return project;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      setShowNew(false);
    },
  });

  // 对待立项项目提交立项 → 待审批 + 创建立项审批单
  const submitInitiationMut = useMutation({
    mutationFn: async ({ project, data }) => {
      const result = await submitProjectInitiation({
        project,
        formData: data,
        operatorName: currentUserName,
        operatorDept: currentEmployee?.department || '',
      });
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['all-approvals'] });
      setInitiatingProject(null);
    },
  });

  const createApprovalMutation = useMutation({
    mutationFn: (data) => createApprovalWithSteps(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-approvals'] });
      setShowInitiateApproval(false);
    },
  });

  const activeProjects = projects.filter(p => !p.is_deleted);
  const filtered = activeProjects.filter(p => {
    const matchSearch = !search || p.name?.includes(search) || p.customer?.includes(search);
    const matchStatus = statusFilter === '全部' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // 各状态计数（用于下拉选项展示数量）
  const statusCounts = Object.keys(STATUS_MAP).reduce((acc, s) => {
    acc[s] = activeProjects.filter(p => p.status === s).length;
    return acc;
  }, {});

  const handleSelect = (projectOrId) => {
    const project = typeof projectOrId === 'object' ? projectOrId : activeProjects.find((p) => p.id === projectOrId);
    const id = project?.id || projectOrId;
    if (
      project &&
      canSubmitProjectInitiation(project, { isAdmin, currentUserName })
    ) {
      setInitiatingProject(project);
      return;
    }
    navigate(`/projects/${id}`);
  };

  return (
    <div className="bg-white rounded-[2rem] shadow-sm border border-border/50 flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-semibold">项目管理</h2>
          <p className="text-xs text-muted-foreground mt-0.5">所有项目必须先立项，才能花钱、收款、报销 · 共 {activeProjects.length} 个项目</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="搜索项目/客户..." className="pl-9 pr-4 py-2 bg-white rounded-full text-xs border border-border/50 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary w-48 transition-shadow" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] h-9 bg-white rounded-full text-xs border border-border/50 shadow-sm focus:ring-primary">
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border/50 shadow-lg">
              <SelectItem value="全部" className="text-xs rounded-lg cursor-pointer">
                全部状态 ({projects.length})
              </SelectItem>
              {Object.keys(STATUS_MAP).map(s => (
                <SelectItem key={s} value={s} className="text-xs rounded-lg cursor-pointer">
                  {s} ({statusCounts[s] || 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex bg-secondary rounded-full p-1 shadow-inner border border-border/20">
            <button type="button" onClick={() => setView('list')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${view === 'list' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              <List className="w-3 h-3" />列表
            </button>
            <button type="button" onClick={() => setView('grid')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${view === 'grid' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              <LayoutGrid className="w-3 h-3" />卡片
            </button>
          </div>
          <button onClick={() => setShowInitiateApproval(true)}
            className="flex items-center gap-1.5 px-5 py-2 bg-primary text-white rounded-full text-xs font-medium hover:bg-primary/90 shadow-sm transition-colors">
            <Send className="w-4 h-4" />发起审批
          </button>
          {isAdmin && (
            <button onClick={() => setShowNew(true)}
              className="flex items-center gap-1.5 px-5 py-2 bg-primary text-white rounded-full text-xs font-medium hover:bg-primary/90 shadow-sm transition-colors">
              <Plus className="w-4 h-4" />项目立项
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">加载中...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground text-sm">
            {activeProjects.length === 0 ? '暂无项目，点击「项目立项」创建' : '没有符合筛选条件的项目'}
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map(p => (
              <ProjectCard key={p.id} project={p} onSelect={handleSelect} approvals={allApprovals} />
            ))}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary/50">
                {['项目名称', '客户', '进度', '合同金额', '剩余预算', '负责人', '状态', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const s = STATUS_MAP[p.status] || STATUS_MAP['执行中'];
                const Icon = s.icon;
                const pa = allApprovals.filter(a => a.project_id === p.id);
                const expense = pa.filter(a => a.direction === '支出' && (a.status === '已通过' || a.status === '已付款')).reduce((sum, a) => sum + (a.amount || 0), 0);
                const remaining = (p.budget_cost || 0) - expense;
                const { percent, overdue } = calcProgress(p.start_date, p.end_date);
                const isActive = !['已完成', '已归档'].includes(p.status);
                return (
                  <tr key={p.id} onClick={() => handleSelect(p)} className="border-t border-border/40 hover:bg-secondary/20 transition-colors cursor-pointer group">
                    <td className="px-4 py-3 font-medium max-w-[160px]">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{p.name}</span>
                        {overdue && isActive && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{p.customer}</td>
                    <td className="px-4 py-3 w-32">
                      {p.start_date && p.end_date && isActive ? (
                        <div>
                          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${overdue ? 'bg-red-500' : percent > 80 ? 'bg-yellow-400' : 'bg-lime-400'}`} style={{ width: `${Math.min(100, percent)}%` }} />
                          </div>
                          <span className={`text-xs ${overdue ? 'text-red-500' : 'text-muted-foreground'}`}>{overdue ? '已逾期' : `${percent}%`}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">{p.status === '已完成' ? '✅ 已完成' : '-'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">¥{((p.contract_amount || 0) / 10000).toFixed(2)}万</td>
                    <td className={`px-4 py-3 font-medium ${remaining < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                      ¥{(remaining / 10000).toFixed(2)}万
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-lime-400 flex items-center justify-center text-xs font-semibold text-white">{p.manager?.[0] || '?'}</div>
                        <span className="text-xs">{p.manager}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium w-fit ${s.color}`}>
                        <Icon className="w-3 h-3" />{p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showNew && (
        <InitiateModal onClose={() => setShowNew(false)} onSave={(data) => createMutation.mutate(data)} />
      )}
      {initiatingProject && (
        <SubmitInitiationModal
          project={initiatingProject}
          saving={submitInitiationMut.isPending}
          onClose={() => setInitiatingProject(null)}
          onSave={(data) => submitInitiationMut.mutate({ project: initiatingProject, data })}
        />
      )}
      {showInitiateApproval && (
        <InitiateApprovalModal
          onClose={() => setShowInitiateApproval(false)}
          onCreate={(data) => createApprovalMutation.mutate(data)}
        />
      )}
    </div>
  );
}
