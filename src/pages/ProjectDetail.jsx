/**
 * ProjectDetail - 项目详情全屏页面
 * 路由：/projects/:id
 *
 * 信息分区：
 *  1. 顶部：项目名/状态/操作按钮（编辑、确认完成、返回）
 *  2. 概览卡片：合同金额 / 已收款 / 已支出 / 剩余预算（明确预算计算逻辑）
 *  3. 三列布局：基本信息 + 关联竞标 / 财务收支明细 / 立项审批流程
 *  4. 底部：审批记录 + 项目日志（双标签页）
 */
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, fileUrl } from '@/api/client';
import {
  ArrowLeft, Edit3, CheckCircle2, AlertTriangle, FileText, Briefcase, ExternalLink,
  Calendar, User, Users, Building2, DollarSign, TrendingUp, TrendingDown, Wallet,
  ClipboardList, History, Hash, Coins, Trash2, FileCheck
} from 'lucide-react';
import ProjectProgress, { calcProgress } from '../components/project/ProjectProgress';
import ApprovalTimeline from '../components/approval/ApprovalTimeline';
import ApprovalDetailPanel from '../components/approval/ApprovalDetailPanel';
import EditProjectModal from '../components/project/EditProjectModal';
import ExecutionItemsSection from '../components/project/ExecutionItemsSection';
import SubmitInitiationModal from '../components/project/SubmitInitiationModal';
import { useAuth } from '@/lib/AuthContext';
import { applyApprovalDecision } from '@/lib/applyApprovalDecision';
import { buildApprovalStepsForSubmit } from '@/lib/buildApprovalSteps';
import { canSubmitProjectInitiation } from '@/lib/bidProjectSync';
import { submitProjectInitiation } from '@/lib/projectInitiationApproval';

const STATUS_COLORS = {
  '待立项': 'bg-amber-100 text-amber-700',
  '待审批': 'bg-yellow-100 text-yellow-700',
  '执行中': 'bg-blue-100 text-blue-700',
  '完成审批中': 'bg-purple-100 text-purple-700',
  '已完成': 'bg-green-100 text-green-700',
  '已归档': 'bg-gray-100 text-gray-600',
};

// 财务计算工具：区分已确认 vs 待确认（保证剩余预算口径清晰）
function computeFinance(approvals) {
  const finalIncome = approvals.filter(a => a.direction === '收入' && (a.status === '已通过' || a.status === '已付款'))
    .reduce((s, a) => s + (a.amount || 0), 0);
  const pendingIncome = approvals.filter(a => a.direction === '收入' && (a.status === '待审核' || a.status === '审核中'))
    .reduce((s, a) => s + (a.amount || 0), 0);
  const finalExpense = approvals.filter(a => a.direction === '支出' && (a.status === '已通过' || a.status === '已付款'))
    .reduce((s, a) => s + (a.amount || 0), 0);
  const pendingExpense = approvals.filter(a => a.direction === '支出' && (a.status === '待审核' || a.status === '审核中'))
    .reduce((s, a) => s + (a.amount || 0), 0);
  return { finalIncome, pendingIncome, finalExpense, pendingExpense };
}

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { currentUserName, currentEmployee, can, isAdmin } = useAuth();
  const canEditPerm = can('项目管理', '编辑');
  const canDeletePerm = can('项目管理', '删除');
  const [bottomTab, setBottomTab] = useState('approvals');
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [showInitiation, setShowInitiation] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const list = await api.entities.Project.filter({ id });
      return list[0] || null;
    },
  });

  const { data: allApprovals = [] } = useQuery({
    queryKey: ['all-approvals'],
    queryFn: () => api.entities.Approval.list('-created_date'),
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['project-logs', id],
    queryFn: () => api.entities.ProjectLog.filter({ project_id: id }, '-created_date'),
    enabled: !!id,
  });

  const { data: bidList = [] } = useQuery({
    queryKey: ['bid', project?.bid_id],
    queryFn: () => api.entities.Bid.filter({ id: project.bid_id }),
    enabled: !!project?.bid_id,
  });

  // 完成项目
  const completeMut = useMutation({
    mutationFn: async () => {
      await api.entities.Project.update(project.id, { status: '完成审批中' });
      const steps = await buildApprovalStepsForSubmit({
        approvalType: 'project_init',
        typeLabel: '项目完成',
        fields: { 项目名称: project.name, 客户: project.customer },
        applicantName: currentUserName,
        applicantDept: currentEmployee?.department || '',
        projectManager: project.manager,
      });
      const approval = await api.entities.Approval.create({
        title: `项目完成确认-${project.name}`,
        type: 'project_init',
        type_label: '项目完成',
        applicant: currentUserName,
        dept: currentEmployee?.department || '',
        fields: JSON.stringify({ 项目名称: project.name, 客户: project.customer }),
        status: '待审核',
        cc_list: [],
        steps: JSON.stringify(steps),
        project_id: project.id,
        project_name: project.name,
        related_project_id: project.id,
      });
      // 通知第一审批人（审批流转提醒）
      try { await api.functions.invoke('onApprovalChange', { event: { type: 'create', entity_id: approval.id }, data: approval }); } catch (e) { console.error('onApprovalChange failed:', e); }
      await api.entities.ProjectLog.create({
        project_id: project.id, action: '申请完成项目',
        detail: `项目成员确认完成项目，提交完成审批`, operator: currentUserName,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', id] });
      qc.invalidateQueries({ queryKey: ['all-approvals'] });
      qc.invalidateQueries({ queryKey: ['project-logs', id] });
    },
  });

  // 软删除项目（保留数据）
  const deleteMut = useMutation({
    mutationFn: async () => {
      await api.entities.Project.update(project.id, {
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: currentUserName,
      });
      await api.entities.ProjectLog.create({
        project_id: project.id, action: '项目删除',
        detail: `项目「${project.name}」被删除（数据已保留）`,
        operator: currentUserName,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      navigate('/projects');
    },
  });

  // 待立项 → 提交立项审批
  const submitInitiationMut = useMutation({
    mutationFn: async (data) => {
      return submitProjectInitiation({
        project,
        formData: data,
        operatorName: currentUserName,
        operatorDept: currentEmployee?.department || '',
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', id] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['all-approvals'] });
      qc.invalidateQueries({ queryKey: ['project-logs', id] });
      setShowInitiation(false);
    },
  });

  // 编辑项目
  const editMut = useMutation({
    mutationFn: async ({ formData, changes }) => {
      const steps = await buildApprovalStepsForSubmit({
        approvalType: 'project_init',
        typeLabel: '项目变更',
        fields: { ...changes, 原项目: project.name },
        applicantName: currentUserName,
        applicantDept: currentEmployee?.department || '',
        projectManager: project.manager,
      });
      const approval = await api.entities.Approval.create({
        title: `项目变更申请-${project.name}`,
        type: 'project_init', type_label: '项目变更',
        applicant: currentUserName, dept: currentEmployee?.department || '',
        fields: JSON.stringify({ ...changes, 原项目: project.name }),
        status: '待审核', cc_list: [],
        steps: JSON.stringify(steps),
        project_id: project.id, project_name: project.name, related_project_id: project.id,
      });
      // 通知第一审批人（审批流转提醒）
      try { await api.functions.invoke('onApprovalChange', { event: { type: 'create', entity_id: approval.id }, data: approval }); } catch (e) { console.error('onApprovalChange failed:', e); }
      await api.entities.ProjectLog.create({
        project_id: project.id, action: '提交变更申请',
        detail: `变更内容：${Object.entries(changes).map(([k, v]) => `${k}(${v})`).join('、')}`,
        operator: currentUserName,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-approvals'] });
      qc.invalidateQueries({ queryKey: ['project-logs', id] });
      setEditing(false);
    },
  });

  const handleApproveFromDetail = async (approvalId, action) => {
    const target = allApprovals.find(a => a.id === approvalId) || selectedApproval;
    if (!target) return;
    try {
      await applyApprovalDecision({
        target,
        action,
        operatorName: currentUserName,
      });
      qc.invalidateQueries({ queryKey: ['all-approvals'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['project', id] });
      qc.invalidateQueries({ queryKey: ['project-logs', id] });
      qc.invalidateQueries({ queryKey: ['execution-sheets', id] });
      qc.invalidateQueries({ queryKey: ['execution-items', id] });
      setSelectedApproval(null);
    } catch (e) {
      console.error('applyApprovalDecision failed:', e);
    }
  };

  const markStepRead = async (approvalId, newSteps) => {
    await api.entities.Approval.update(approvalId, { steps: JSON.stringify(newSteps) });
    qc.invalidateQueries({ queryKey: ['all-approvals'] });
  };

  if (isLoading) return <div className="flex items-center justify-center h-full text-sm text-muted-foreground">加载中...</div>;
  if (!project) return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <p className="text-sm text-muted-foreground">项目不存在或已删除</p>
      <button onClick={() => navigate('/projects')} className="px-4 py-2 bg-primary text-white rounded-full text-xs">返回列表</button>
    </div>
  );

  const bid = bidList[0];
  const contractFiles = (() => { try { return bid?.contract_files ? JSON.parse(bid.contract_files) : []; } catch { return []; } })();
  const approvals = allApprovals.filter(a => a.project_id === project.id);
  const finance = computeFinance(approvals);

  const budget = project.budget_cost || 0;
  const remainingBudget = budget - finance.finalExpense;
  const projectedRemaining = budget - finance.finalExpense - finance.pendingExpense;

  const { overdue, daysLeft } = calcProgress(project.start_date, project.end_date);
  const isActive = !['已完成', '已归档', '完成审批中'].includes(project.status);
  const canComplete = canEditPerm && (project.status === '执行中');
  const canEdit = canEditPerm && isActive && !['待立项', '待审批'].includes(project.status);
  const canInitiate = canSubmitProjectInitiation(project, { isAdmin, currentUserName });
  const isPendingInitiation = project.status === '待立项';
  const isPendingApproval = project.status === '待审批';

  // 进行中的审批（含立项审批，不含变更/完成）
  const pendingOtherApprovals = approvals
    .filter(a => !['项目变更', '项目完成'].includes(a.type_label) && ['待审核', '审核中'].includes(a.status))
    .sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
  const financeApprovals = approvals.filter(a => a.direction === '收入' || a.direction === '支出');
  const tabApprovals = approvals.filter(a => !['项目变更', '项目完成'].includes(a.type_label));

  return (
    <div className="bg-background min-h-full">
      {/* Header */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-border/50 mb-4">
        <div className="px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button onClick={() => navigate('/projects')}
              className="p-2 rounded-full hover:bg-secondary transition-colors shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold truncate">{project.name}</h1>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[project.status]}`}>{project.status}</span>
                {overdue && isActive && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-600 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />已逾期 {Math.abs(daysLeft)} 天
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{project.customer} · 项目编号 {project.id?.slice(-8)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canInitiate && (
              <button onClick={() => setShowInitiation(true)}
                className="px-4 py-2 bg-primary text-white rounded-full text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5" />提交立项
              </button>
            )}
            {canEdit && (
              <button onClick={() => setEditing(true)}
                className="px-3 py-2 bg-secondary rounded-full text-xs font-medium hover:bg-border transition-colors flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5" />编辑
              </button>
            )}
            {canComplete && (
              <button onClick={() => completeMut.mutate()}
                className="px-4 py-2 bg-green-100 text-green-700 rounded-full text-xs font-medium hover:bg-green-200 transition-colors flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />确认完成项目
              </button>
            )}
            {project.status === '完成审批中' && (
              <span className="px-3 py-1.5 bg-yellow-50 text-yellow-700 rounded-full text-xs">⏳ 完成审批中</span>
            )}
            {isPendingApproval && (
              <span className="px-3 py-1.5 bg-yellow-50 text-yellow-700 rounded-full text-xs">⏳ 立项审批中</span>
            )}
            {canDeletePerm && (
              <button onClick={() => setConfirmDelete(true)}
                className="px-3 py-2 bg-red-50 text-red-600 rounded-full text-xs font-medium hover:bg-red-100 transition-colors flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5" />删除
              </button>
            )}
          </div>
        </div>
        {/* Progress bar */}
        {project.start_date && project.end_date && (
          <div className="px-6 pb-4">
            <ProjectProgress startDate={project.start_date} endDate={project.end_date} status={project.status} />
          </div>
        )}
      </div>

      {/* 财务概览卡片 - 4 列 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <FinanceCard
          icon={DollarSign} color="blue" label="合同金额"
          value={project.contract_amount} sub={`成本预算 ¥${(budget / 10000).toFixed(2)}万`}
        />
        <FinanceCard
          icon={TrendingUp} color="green" label="已收款"
          value={finance.finalIncome}
          sub={finance.pendingIncome > 0 ? `待审收入 ¥${(finance.pendingIncome / 10000).toFixed(2)}万` : '已通过/已付款'}
        />
        <FinanceCard
          icon={TrendingDown} color="red" label="已支出"
          value={finance.finalExpense}
          sub={finance.pendingExpense > 0 ? `待审支出 ¥${(finance.pendingExpense / 10000).toFixed(2)}万` : '已通过/已付款'}
        />
        <div className={`rounded-2xl p-5 ${remainingBudget < 0 ? 'bg-red-50 border border-red-200' : 'bg-orange-50 border border-orange-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-medium ${remainingBudget < 0 ? 'text-red-700' : 'text-orange-700'}`}>剩余预算</span>
            <Wallet className={`w-4 h-4 ${remainingBudget < 0 ? 'text-red-500' : 'text-orange-500'}`} />
          </div>
          <p className={`text-2xl font-bold ${remainingBudget < 0 ? 'text-red-700' : 'text-orange-700'}`}>
            ¥{(remainingBudget / 10000).toFixed(2)}万
          </p>
          <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">
            预算 ¥{(budget / 10000).toFixed(2)}万 − 已支出 ¥{(finance.finalExpense / 10000).toFixed(2)}万
          </p>
          {finance.pendingExpense > 0 && (
            <p className={`text-[10px] mt-0.5 font-medium ${projectedRemaining < 0 ? 'text-red-600' : 'text-amber-600'}`}>
              扣除待审后预估 ¥{(projectedRemaining / 10000).toFixed(2)}万
            </p>
          )}
        </div>
      </div>

      {/* 待立项提示 */}
      {isPendingInitiation && (
        <div className="mb-4 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between gap-3 flex-wrap">
          <span>该项目仍为<strong>待立项</strong>，请填写起止时间、二级负责人与成员后提交立项，方可开展执行与付款。</span>
          {canInitiate && (
            <button type="button" onClick={() => setShowInitiation(true)}
              className="px-3 py-1.5 bg-primary text-white rounded-full text-xs font-medium shrink-0">
              去立项
            </button>
          )}
        </div>
      )}

      {/* 执行内容 — 待立项/待审批不可操作 */}
      {!isPendingInitiation && !isPendingApproval && (
        <div className="mb-4">
          <ExecutionItemsSection project={project} />
        </div>
      )}

      {/* 主体网格：基本信息 / 收入明细 / 支出明细 / 立项审批 */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">
        {/* 基本信息 */}
        <div className="bg-white rounded-2xl border border-border/50 p-5 lg:col-span-1">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-1.5">
            <Hash className="w-4 h-4 text-muted-foreground" />基本信息
          </h3>
          {bid && (
            <Link to={`/business?id=${bid.id}`}
              className="flex items-center gap-2 p-2 mb-3 bg-purple-50 rounded-lg text-xs text-purple-700 hover:bg-purple-100 transition-colors group">
              <Briefcase className="w-3.5 h-3.5 shrink-0" />
              <span className="font-medium flex-1 truncate">关联竞标：{bid.project_name}</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          )}
          <div className="space-y-2.5 text-sm">
            <InfoRow icon={FileText} label="合同编号" value={project.contract_no || '-'} />
            <InfoRow icon={Building2} label="客户" value={project.customer} />
            <InfoRow icon={Hash} label="项目类型" value={project.project_type || '-'} />
            <InfoRow icon={Calendar} label="开始时间" value={project.start_date || '-'} />
            <InfoRow icon={Calendar} label="结束时间" value={project.end_date || '-'} />
            <InfoRow icon={Coins} label="结算方式" value={project.payment_method || '-'} />
            <InfoRow icon={User} label="负责人" value={project.manager} />
          </div>
          <div className="mt-4 pt-4 border-t border-border/40">
            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><Users className="w-3 h-3" />项目成员</p>
            <div className="flex flex-wrap gap-1">
              {(project.members || []).map(m => (
                <span key={m} className="px-2 py-0.5 bg-secondary rounded-full text-xs">{m}</span>
              ))}
              {(!project.members || project.members.length === 0) && <span className="text-xs text-muted-foreground">暂无成员</span>}
            </div>
          </div>
          {contractFiles.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border/40">
              <p className="text-xs text-muted-foreground mb-2">商务合同文件</p>
              <div className="space-y-1">
                {contractFiles.map((f, i) => (
                  <a key={i} href={fileUrl(f.url)} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-secondary/60 rounded-lg hover:bg-secondary transition-colors">
                    <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="text-xs text-blue-600 hover:underline truncate">{f.name}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 收入明细 */}
        <FinanceList
          title="收入明细"
          direction="收入"
          icon={TrendingUp}
          tone="green"
          items={financeApprovals.filter(a => a.direction === '收入')}
          finalTotal={finance.finalIncome}
          pendingTotal={finance.pendingIncome}
        />

        {/* 支出明细 */}
        <FinanceList
          title="支出明细"
          direction="支出"
          icon={TrendingDown}
          tone="red"
          items={financeApprovals.filter(a => a.direction === '支出')}
          finalTotal={finance.finalExpense}
          pendingTotal={finance.pendingExpense}
        />

        {/* 进行中的审批 */}
        <div className="bg-white rounded-2xl border border-border/50 p-5 lg:col-span-1">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-1.5">
            <ClipboardList className="w-4 h-4 text-muted-foreground" />进行中的审批
          </h3>
          {pendingOtherApprovals.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">当前无进行中的审批</p>
          ) : (
            <div className="space-y-3 max-h-[460px] overflow-auto pr-1">
              {pendingOtherApprovals.map(a => {
                let steps = [];
                try { steps = JSON.parse(a.steps || '[]'); } catch {}
                return (
                  <button
                    type="button"
                    key={a.id}
                    onClick={() => setSelectedApproval(a)}
                    className="w-full text-left bg-secondary/30 hover:bg-secondary/50 rounded-xl p-3 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold truncate">{a.title}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ml-2 ${
                        a.status === '审核中' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>{a.status}</span>
                    </div>
                    {steps.length > 0 && <ApprovalTimeline steps={steps} compact />}
                    <p className="text-[10px] text-muted-foreground mt-2">点击查看详情 / 审批</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 底部双标签：审批记录 + 项目日志 */}
      <div className="bg-white rounded-2xl border border-border/50 p-5">
        <div className="flex gap-1 border-b border-border mb-4">
          <button onClick={() => setBottomTab('approvals')}
            className={`px-4 py-2 text-sm font-medium relative transition-colors flex items-center gap-1.5 ${bottomTab === 'approvals' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            <ClipboardList className="w-4 h-4" />审批记录 ({tabApprovals.length})
            {bottomTab === 'approvals' && <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />}
          </button>
          <button onClick={() => setBottomTab('logs')}
            className={`px-4 py-2 text-sm font-medium relative transition-colors flex items-center gap-1.5 ${bottomTab === 'logs' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            <History className="w-4 h-4" />项目日志 ({logs.length})
            {bottomTab === 'logs' && <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />}
          </button>
        </div>

        {bottomTab === 'approvals' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tabApprovals.length === 0 && <p className="text-xs text-muted-foreground text-center py-6 col-span-2">暂无审批记录</p>}
            {tabApprovals.map(a => {
              let steps = [];
              try { steps = JSON.parse(a.steps || '[]'); } catch {}
              return (
                <div key={a.id} className="border border-border/50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium truncate">{a.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ml-2 ${
                      a.status === '已通过' || a.status === '已付款' ? 'bg-green-100 text-green-700' :
                      a.status === '审核中' ? 'bg-blue-100 text-blue-700' :
                      a.status === '已拒绝' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>{a.status}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <span>{a.type_label} · {a.applicant}</span>
                    {a.amount > 0 && (
                      <span className={`font-semibold ${a.direction === '收入' ? 'text-green-600' : 'text-red-600'}`}>
                        {a.direction === '收入' ? '+' : '-'}¥{(a.amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                  {steps.length > 0 && (
                    <div className="pt-2 border-t border-border/40">
                      <ApprovalTimeline steps={steps} compact />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {bottomTab === 'logs' && (
          <div className="space-y-2">
            {logs.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">暂无日志</p>}
            {logs.map(log => (
              <div key={log.id} className="border-l-2 border-lime-400 pl-3 py-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{log.action}</span>
                  <span className="text-xs text-muted-foreground">{log.created_date?.replace('T', ' ').slice(0, 16)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{log.detail}</p>
                {log.operator && <p className="text-[10px] text-muted-foreground/60 mt-0.5">操作人：{log.operator}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <EditProjectModal
          project={project}
          onClose={() => setEditing(false)}
          onSave={(formData, changes) => editMut.mutate({ formData, changes })}
        />
      )}

      {showInitiation && (
        <SubmitInitiationModal
          project={project}
          saving={submitInitiationMut.isPending}
          onClose={() => setShowInitiation(false)}
          onSave={(data) => submitInitiationMut.mutate(data)}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-[420px] p-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold">确认删除项目？</h3>
                <p className="text-xs text-muted-foreground mt-0.5">「{project.name}」将从列表中移除</p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 mb-4">
              ℹ️ 项目数据（审批记录、财务明细、项目日志）仍将在后台保留，仅从列表隐藏。
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2 bg-secondary rounded-xl text-sm hover:bg-border transition-colors">取消</button>
              <button onClick={() => { deleteMut.mutate(); setConfirmDelete(false); }}
                className="flex-1 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-colors">
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedApproval && (
        <ApprovalDetailPanel
          overlay
          item={allApprovals.find(a => a.id === selectedApproval.id) || selectedApproval}
          onClose={() => setSelectedApproval(null)}
          onApprove={handleApproveFromDetail}
          currentUser={currentUserName}
          onMarkStepRead={markStepRead}
        />
      )}
    </div>
  );
}

function FinanceCard({ icon: Icon, color, label, value, sub }) {
  const colorMap = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    red: 'bg-red-50 border-red-200 text-red-700',
  };
  return (
    <div className={`rounded-2xl p-5 border ${colorMap[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium">{label}</span>
        <Icon className="w-4 h-4 opacity-70" />
      </div>
      <p className="text-2xl font-bold">¥{((value || 0) / 10000).toFixed(2)}万</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-1.5">{sub}</p>}
    </div>
  );
}

function FinanceList({ title, direction, icon: Icon, tone, items, finalTotal, pendingTotal }) {
  const toneMap = {
    green: { text: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100' },
    red: { text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
  };
  const c = toneMap[tone];
  const sign = direction === '收入' ? '+' : '-';
  return (
    <div className="bg-white rounded-2xl border border-border/50 p-5 lg:col-span-1 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Icon className={`w-4 h-4 ${c.text}`} />{title}
        </h3>
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${c.bg} ${c.text} font-medium`}>{items.length} 条</span>
      </div>
      <div className={`${c.bg} rounded-xl p-3 mb-3 ${c.border} border`}>
        <p className="text-[10px] text-muted-foreground">已确认{direction}</p>
        <p className={`text-lg font-bold ${c.text}`}>
          {sign}¥{finalTotal.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        {pendingTotal > 0 && (
          <p className="text-[10px] text-amber-600 mt-0.5">
            待审 {sign}¥{pendingTotal.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6 flex-1">暂无{direction}记录</p>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-auto pr-1 flex-1">
          {items.map(a => {
            const counted = a.status === '已通过' || a.status === '已付款';
            return (
              <div key={a.id} className={`p-2.5 rounded-lg border ${counted ? 'bg-white border-border/50' : 'bg-yellow-50/50 border-yellow-200'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">{a.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{a.type_label} · {a.applicant}</p>
                  </div>
                  <span className={`text-xs font-semibold shrink-0 ${c.text}`}>
                    {sign}¥{(a.amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    counted ? 'bg-green-100 text-green-700' :
                    a.status === '已拒绝' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>{a.status}</span>
                  <span className={`text-[10px] ${counted ? 'text-green-600' : a.status === '已拒绝' ? 'text-red-500' : 'text-amber-600'}`}>
                    {counted ? '已计入汇总' : a.status === '已拒绝' ? '已拒绝' : '未计入汇总'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Icon className="w-3 h-3" />{label}
      </span>
      <span className="text-xs font-medium text-right truncate max-w-[60%]">{value}</span>
    </div>
  );
}