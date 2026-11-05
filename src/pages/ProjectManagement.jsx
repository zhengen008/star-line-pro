import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/api/client';
import { Plus, Search, ChevronRight, Clock, CheckCircle2, Layers, AlertTriangle, Archive, LayoutGrid, List, Send } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ProjectCard from '../components/project/ProjectCard';
import { calcProgress } from '../components/project/ProjectProgress';
import InitiateApprovalModal from '../components/approval/InitiateApprovalModal';
import ProjectInitiationModal from '../components/project/ProjectInitiationModal';
import { useAuth } from '@/lib/AuthContext';
import { canSubmitProjectInitiation } from '@/lib/bidProjectSync';
import { initiateProject } from '@/lib/projectInitiationApproval';
import { createApprovalWithSteps } from '@/lib/createApprovalWithSteps';
import { summarizeAcceptances } from '@/lib/acceptancePeriods';

const STATUS_MAP = {
  '待立项': { color: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
  '待审批': { color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  '执行中': { color: 'bg-blue-100 text-blue-700', icon: Layers },
  '完成审批中': { color: 'bg-purple-100 text-purple-700', icon: Clock },
  '已完成': { color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  '已归档': { color: 'bg-gray-100 text-gray-600', icon: Archive },
};

export default function ProjectManagement() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [view, setView] = useState('list'); // list | grid - 默认列表展示
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('全部');
  // null | { project: null }（项目立项按钮）| { project }（点击待立项项目）
  const [initiation, setInitiation] = useState(null);
  const [showInitiateApproval, setShowInitiateApproval] = useState(false);

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

  const { data: allAcceptances = [] } = useQuery({
    queryKey: ['all-acceptances'],
    queryFn: () => api.entities.ProjectAcceptance.list('seq', 5000),
  });

  const initiateMut = useMutation({
    mutationFn: (payload) => initiateProject({
      ...payload,
      operatorName: currentUserName,
      operatorDept: currentEmployee?.department || '',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['all-approvals'] });
      qc.invalidateQueries({ queryKey: ['all-acceptances'] });
      qc.invalidateQueries({ queryKey: ['projects-for-initiation'] });
      setInitiation(null);
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

  const openInitiation = (project = null) => {
    initiateMut.reset();
    setInitiation({ project });
  };

  const handleSelect = (projectOrId) => {
    const project = typeof projectOrId === 'object' ? projectOrId : activeProjects.find((p) => p.id === projectOrId);
    const id = project?.id || projectOrId;
    if (
      project &&
      canSubmitProjectInitiation(project, { isAdmin, currentUserName })
    ) {
      openInitiation(project);
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
            <button onClick={() => openInitiation()}
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
              <ProjectCard key={p.id} project={p} onSelect={handleSelect} approvals={allApprovals} acceptances={allAcceptances} />
            ))}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary/50">
                {['项目名称', '客户', '时间进度', '验收进度', '合同金额', '负责人', '状态', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const s = STATUS_MAP[p.status] || STATUS_MAP['执行中'];
                const Icon = s.icon;
                const acc = summarizeAcceptances(allAcceptances.filter(a => a.project_id === p.id));
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
                    <td className="px-4 py-3 w-32">
                      {acc.totalPeriods > 0 ? (
                        <div>
                          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-blue-400" style={{ width: `${(acc.acceptedPeriods / acc.totalPeriods) * 100}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground">{acc.acceptedPeriods}/{acc.totalPeriods} 期</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">¥{((p.contract_amount || 0) / 10000).toFixed(2)}万</td>
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

      {initiation && (
        <ProjectInitiationModal
          project={initiation.project}
          saving={initiateMut.isPending}
          error={initiateMut.error ? (initiateMut.error.data?.error || initiateMut.error.message || '提交失败') : ''}
          onClose={() => setInitiation(null)}
          onSubmit={(payload) => initiateMut.mutate(payload)}
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
