import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { api } from '@/api/client';
import { Plus, Bell, Search, Send } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAllTypeLabels } from '../components/approval/ApprovalTypeConfig';
import ApprovalTable from '../components/approval/ApprovalTable';
import ApprovalDetailPanel from '../components/approval/ApprovalDetailPanel';
import InitiateApprovalModal from '../components/approval/InitiateApprovalModal';
import { applyApprovalDecision } from '@/lib/applyApprovalDecision';
import { createApprovalWithSteps } from '@/lib/createApprovalWithSteps';
import { useAuth } from '@/lib/AuthContext';

import { List, Receipt, ShoppingCart, TrendingDown, FileText, FileSignature, FolderPlus } from 'lucide-react';

// Tab definitions: key → matching approval type keys
const CATEGORY_TABS = [
  { key: 'all', label: '全部', icon: List, types: null },
  { key: 'reimbursement', label: '报销', icon: Receipt, types: ['reimbursement'] },
  { key: 'purchase', label: '采购', icon: ShoppingCart, types: ['purchase'] },
  { key: 'project_expense', label: '项目支出', icon: TrendingDown, types: ['project_payment', 'project_reserve', 'project_purchase'] },
  { key: 'project_initiation', label: '项目立项', icon: FolderPlus, types: ['project_initiation'] },
  { key: 'invoice', label: '开票', icon: FileText, types: ['invoice'] },
  { key: 'contract_seal', label: '合同/用章', icon: FileSignature, types: ['contract', 'seal'] },
];

const STATUS_OPTIONS = ['全部', '待审核', '审核中', '已通过', '已拒绝', '已付款'];

export default function ApprovalManagement() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUserName } = useAuth();

  const idFromUrl = searchParams.get('id');
  const tabFromUrl = searchParams.get('tab') || 'all';

  const [activeTab, setActiveTab] = useState(tabFromUrl);
  const [statusFilter, setStatusFilter] = useState('全部');
  const [typeFilter, setTypeFilter] = useState('全部');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(idFromUrl);
  const [showInitiate, setShowInitiate] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const { data: allApprovals = [], isLoading } = useQuery({
    queryKey: ['all-approvals'],
    queryFn: () => api.entities.Approval.list('-created_date', 500),
  });

  // 深链：按 id 单独拉取，不依赖列表是否包含该条
  const {
    data: deepLinkFetched,
    isLoading: deepLinkLoading,
    isError: deepLinkError,
    isFetched: deepLinkFetchedDone,
  } = useQuery({
    queryKey: ['approval-by-id', idFromUrl],
    queryFn: () => api.entities.Approval.get(idFromUrl),
    enabled: !!idFromUrl,
    retry: 1,
  });

  const { data: allProjects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.entities.Project.list(),
  });

  // 排除已删除项目的审批记录
  const deletedProjectIds = useMemo(
    () => new Set(allProjects.filter(p => p.is_deleted).map(p => p.id)),
    [allProjects]
  );
  const approvals = useMemo(
    () => allApprovals.filter(a => !a.project_id || !deletedProjectIds.has(a.project_id)),
    [allApprovals, deletedProjectIds]
  );

  // Deep link：用 React Router search params 同步选中态（避免 history.replaceState 与路由脱节）
  useEffect(() => {
    if (!idFromUrl) {
      if (!searchParams.get('tab')) setActiveTab('all');
      else setActiveTab(tabFromUrl);
      return;
    }
    setActiveTab('all');
    setTypeFilter('全部');
    setStatusFilter('全部');
    setSearch('');
    setSelected(idFromUrl);
  }, [idFromUrl, tabFromUrl]); // eslint-disable-line react-hooks/exhaustive-deps -- 仅跟随 URL id/tab

  const createMutation = useMutation({
    mutationFn: (data) => createApprovalWithSteps(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['all-approvals'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.Approval.update(id, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['all-approvals'] });
      qc.invalidateQueries({ queryKey: ['project-approvals'] });
      if (vars?.id) qc.invalidateQueries({ queryKey: ['approval-by-id', vars.id] });
    },
  });

  const markStepReadMutate = updateMutation.mutate;
  const handleMarkStepRead = useCallback((approvalId, newSteps) => {
    markStepReadMutate({ id: approvalId, data: { steps: JSON.stringify(newSteps) } });
  }, [markStepReadMutate]);

  const handleApprove = async (id, action) => {
    const target =
      approvals.find(a => a.id === id)
      || (deepLinkFetched?.id === id ? deepLinkFetched : null);
    if (!target) return;
    try {
      const { notifMsg } = await applyApprovalDecision({
        target,
        action,
        operatorName: currentUserName,
      });
      qc.invalidateQueries({ queryKey: ['all-approvals'] });
      qc.invalidateQueries({ queryKey: ['approval-by-id', id] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['project'] });
      qc.invalidateQueries({ queryKey: ['execution-sheets'] });
      qc.invalidateQueries({ queryKey: ['execution-items'] });
      setNotifications(n => [{ id: Date.now(), msg: notifMsg, time: new Date().toLocaleString('zh-CN'), read: false }, ...n]);
    } catch (e) {
      console.error('applyApprovalDecision failed:', e);
    }
  };

  // Current tab config
  const currentTabConfig = CATEGORY_TABS.find(t => t.key === activeTab) || CATEGORY_TABS[0];

  // Available sub-type labels for the active tab (for further filtering)
  const subTypeLabels = useMemo(() => {
    if (!currentTabConfig.types) return getAllTypeLabels();
    const tabApprovals = approvals.filter(a => currentTabConfig.types.includes(a.type));
    const labels = [...new Set(tabApprovals.map(a => a.type_label).filter(Boolean))];
    return labels;
  }, [approvals, currentTabConfig]);

  // Filtered approvals
  const filtered = useMemo(() => {
    return approvals.filter(a => {
      const matchTab = !currentTabConfig.types || currentTabConfig.types.includes(a.type);
      const matchStatus = statusFilter === '全部' || a.status === statusFilter;
      const matchType = typeFilter === '全部' || a.type_label === typeFilter;
      const matchSearch = !search || a.title?.includes(search) || a.applicant?.includes(search) || a.project_name?.includes(search);
      return matchTab && matchStatus && matchType && matchSearch;
    });
  }, [approvals, currentTabConfig, statusFilter, typeFilter, search]);

  const detailItem = selected
    ? (approvals.find(a => a.id === selected)
      || (deepLinkFetched?.id === selected ? deepLinkFetched : null))
    : null;
  const deepLinkMissing = !!idFromUrl && !isLoading && !deepLinkLoading && deepLinkFetchedDone
    && !detailItem && (deepLinkError || deepLinkFetched == null);
  const unreadCount = notifications.filter(n => !n.read).length;
  const showDeepLinkOverlay = !!idFromUrl && !!detailItem;

  const handleSelectApproval = (id) => {
    setSelected(id);
    const next = new URLSearchParams(searchParams);
    next.set('id', id);
    setSearchParams(next, { replace: true });
  };

  const handleCloseDetail = () => {
    setSelected(null);
    const next = new URLSearchParams(searchParams);
    next.delete('id');
    setSearchParams(next, { replace: true });
  };

  const handleFeishuPush = async (msg) => {
    try {
      const user = JSON.parse(localStorage.getItem('feishu_user') || '{}');
      await api.functions.invoke('sendFeishuNotification', {
        msg: `[系统通知] ${msg}`,
        receive_id: user.open_id || '', 
        receive_id_type: 'open_id'
      });
      // Optionally show a lightweight toast or alert
      alert('已成功推送到飞书');
    } catch (e) {
      console.error(e);
      alert('推送到飞书失败');
    }
  };

  // Stats for current tab
  const tabApprovals = currentTabConfig.types
    ? approvals.filter(a => currentTabConfig.types.includes(a.type))
    : approvals;
  const pending = tabApprovals.filter(a => a.status === '待审核').length;
  const reviewing = tabApprovals.filter(a => a.status === '审核中').length;
  const totalAmount = tabApprovals.filter(a => (a.status === '已通过' || a.status === '已付款') && a.direction === '支出').reduce((s, a) => s + (a.amount || 0), 0);
  const incomeAmount = tabApprovals.filter(a => (a.status === '已通过' || a.status === '已付款') && a.direction === '收入').reduce((s, a) => s + (a.amount || 0), 0);

  const handleTabChange = (key) => {
    setActiveTab(key);
    setTypeFilter('全部');
    setStatusFilter('全部');
    setSelected(null);
    const next = new URLSearchParams(searchParams);
    if (key === 'all') next.delete('tab');
    else next.set('tab', key);
    next.delete('id');
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="bg-white rounded-[2rem] shadow-sm border border-border/50 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold text-lg">审批中心</h2>
            <p className="text-xs text-muted-foreground mt-0.5">统一管理所有审批流程</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Notification bell */}
            <div className="relative">
              <button onClick={() => setShowNotif(v => !v)} className="relative w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-border transition-colors">
                <Bell className="w-3.5 h-3.5 text-muted-foreground" />
                {unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-lime-400 rounded-full text-xs flex items-center justify-center font-semibold">{unreadCount}</span>}
              </button>
              {showNotif && (
                <div className="absolute right-0 top-10 w-80 bg-card rounded-2xl shadow-xl border border-border z-50 overflow-hidden animate-fade-in">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <span className="text-sm font-semibold">系统通知</span>
                    <button onClick={() => { setNotifications(n => n.map(x => ({ ...x, read: true }))); setShowNotif(false); }} className="text-xs text-muted-foreground hover:text-foreground">全部已读</button>
                  </div>
                  <div className="max-h-72 overflow-auto">
                    {notifications.map(n => (
                      <div key={n.id} className={`px-4 py-3 border-b border-border/40 text-xs ${n.read ? 'opacity-60' : ''}`}>
                        <div className="flex items-start gap-2">
                          {!n.read && <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1 shrink-0"></span>}
                          <div className="flex-1 min-w-0">
                            <p className="text-foreground leading-relaxed">{n.msg}</p>
                            <div className="flex items-center justify-between mt-1">
                              <p className="text-muted-foreground">{n.time}</p>
                              <button onClick={() => handleFeishuPush(n.msg)} className="flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-600 transition-colors">
                                <Send className="w-3 h-3" />推送飞书
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {notifications.length === 0 && <div className="px-4 py-6 text-center text-xs text-muted-foreground">暂无通知</div>}
                  </div>
                </div>
              )}
            </div>

            <button onClick={() => setShowInitiate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-xl text-xs font-medium hover:bg-primary/90 transition-colors">
              <Plus className="w-3.5 h-3.5" />发起审批
            </button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex gap-5">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-yellow-600">{pending}</span>
            <span className="text-xs text-muted-foreground">待审核</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-blue-600">{reviewing}</span>
            <span className="text-xs text-muted-foreground">审核中</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-foreground">{tabApprovals.length}</span>
            <span className="text-xs text-muted-foreground">全部</span>
          </div>
          {totalAmount > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-muted-foreground">已批支出</span>
              <span className="text-sm font-bold text-red-600">¥{(totalAmount / 10000).toFixed(1)}万</span>
            </div>
          )}
          {incomeAmount > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">已批收入</span>
              <span className="text-sm font-bold text-green-600">¥{(incomeAmount / 10000).toFixed(1)}万</span>
            </div>
          )}
        </div>
      </div>

      {/* Category Tabs + Filters */}
      <div className="flex items-center gap-2 px-6 pt-3 pb-2 border-b border-border">
        {/* Tabs */}
        <div className="flex gap-2 flex-1 min-w-0 overflow-x-auto pb-1">
          {CATEGORY_TABS.map(t => {
            const count = t.types ? approvals.filter(a => t.types.includes(a.type)).length : approvals.length;
            const isActive = activeTab === t.key;
            return (
              <button key={t.key} onClick={() => handleTabChange(t.key)}
                className={`px-4 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap flex items-center gap-2 border ${isActive ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white text-muted-foreground border-border/50 hover:border-border hover:bg-secondary/50'}`}>
                <t.icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-muted-foreground'}`} />
                <span>{t.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-secondary'}`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索..."
              className="pl-9 pr-4 py-2 bg-white rounded-full text-xs border border-border/50 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary w-40 transition-shadow" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[120px] h-9 bg-white rounded-full text-xs border border-border/50 shadow-sm focus:ring-primary">
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border/50 shadow-lg">
              {STATUS_OPTIONS.map(s => (
                <SelectItem key={s} value={s} className="text-xs rounded-lg cursor-pointer">{s === '全部' ? '全部状态' : s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {subTypeLabels.length > 1 && (
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px] h-9 bg-white rounded-full text-xs border border-border/50 shadow-sm focus:ring-primary">
                <SelectValue placeholder="全部类型" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border/50 shadow-lg max-h-60">
                <SelectItem value="全部" className="text-xs rounded-lg cursor-pointer">全部类型</SelectItem>
                {subTypeLabels.map(l => (
                  <SelectItem key={l} value={l} className="text-xs rounded-lg cursor-pointer">{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 overflow-auto">
          {isLoading || (idFromUrl && deepLinkLoading && !detailItem) ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">加载中...</div>
          ) : deepLinkMissing ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground text-sm gap-3">
              <p>未找到该审批单，可能已被删除或您无权查看</p>
              <button
                type="button"
                onClick={handleCloseDetail}
                className="px-4 py-2 rounded-xl text-xs bg-secondary hover:bg-border transition-colors"
              >
                清除链接并返回列表
              </button>
            </div>
          ) : (
            <ApprovalTable approvals={filtered} selectedId={selected} onSelect={handleSelectApproval} />
          )}
        </div>

        {detailItem && !showDeepLinkOverlay && (
          <ApprovalDetailPanel
            item={detailItem}
            onClose={handleCloseDetail}
            onApprove={handleApprove}
            currentUser={currentUserName}
            onMarkStepRead={handleMarkStepRead}
          />
        )}
      </div>

      {showDeepLinkOverlay && detailItem && (
        <ApprovalDetailPanel
          item={detailItem}
          onClose={handleCloseDetail}
          onApprove={handleApprove}
          currentUser={currentUserName}
          onMarkStepRead={handleMarkStepRead}
          overlay
        />
      )}

      {showInitiate && (
        <InitiateApprovalModal
          onClose={() => setShowInitiate(false)}
          onCreate={(data) => createMutation.mutate(data)}
        />
      )}
    </div>
  );
}