import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, fileUrl } from '@/api/client';
import { Link } from 'react-router-dom';
import { X, Edit3, CheckCircle2, AlertTriangle, FileText, Briefcase, ExternalLink } from 'lucide-react';
import ProjectProgress, { calcProgress } from './ProjectProgress';
import ApprovalTimeline from '../approval/ApprovalTimeline';

import { useAuth } from '@/lib/AuthContext';

export default function ProjectDetailPanel({ project, onClose, onEdit, onComplete, isViewer: isViewerProp }) {
  const [tab, setTab] = useState('info');
  const { can } = useAuth();
  const canEditPerm = can('项目管理', '编辑') && !isViewerProp;
  const { data: allApprovals = [] } = useQuery({
    queryKey: ['all-approvals'],
    queryFn: () => api.entities.Approval.list('-created_date'),
  });
  const { data: logs = [] } = useQuery({
    queryKey: ['project-logs', project.id],
    queryFn: () => api.entities.ProjectLog.filter({ project_id: project.id }, '-created_date'),
  });
  const { data: bidList = [] } = useQuery({
    queryKey: ['bid', project.bid_id],
    queryFn: async () => {
      try {
        return await api.entities.Bid.filter({ id: project.bid_id });
      } catch (e) {
        return [];
      }
    },
    enabled: !!project.bid_id,
  });
  const bid = bidList[0];
  const contractFiles = (() => { try { return bid?.contract_files ? JSON.parse(bid.contract_files) : []; } catch { return []; } })();

  const approvals = allApprovals.filter(a => a.project_id === project.id);
  const income = approvals.filter(a => a.direction === '收入' && (a.status === '已通过' || a.status === '已付款')).reduce((s, a) => s + (a.amount || 0), 0);
  const expense = approvals.filter(a => a.direction === '支出' && (a.status === '已通过' || a.status === '已付款')).reduce((s, a) => s + (a.amount || 0), 0);

  const { overdue, daysLeft } = calcProgress(project.start_date, project.end_date);
  const canComplete = canEditPerm && (project.status === '执行中') && !['完成审批中', '已完成', '已归档'].includes(project.status);
  const canEdit = canEditPerm && !['完成审批中', '已完成', '已归档'].includes(project.status);

  const TABS = ['info', 'approvals', 'logs'];
  const TAB_LABELS = ['基本信息', '审批记录', '项目日志'];

  const remainingBudget = (project.budget_cost || 0) - expense;

  // 进行中的其他审批（非立项/变更/完成，未完成）—— 显示审批流程图
  const pendingOtherApprovals = allApprovals
    .filter(a => a.project_id === project.id && !['项目变更', '项目完成'].includes(a.type_label) && ['待审核', '审核中'].includes(a.status))
    .sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
  // 审批记录 tab：不显示立项/变更/完成类记录
  const tabApprovals = approvals.filter(a => !['项目变更', '项目完成'].includes(a.type_label));

  return (
    <div className="w-80 border-l border-border flex flex-col animate-fade-in shrink-0">
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm truncate">{project.name}</p>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {canEdit && (
              <button onClick={() => onEdit(project)} className="p-1 hover:bg-secondary rounded-lg" title="编辑项目">
                <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
            <button onClick={onClose} className="p-1 hover:bg-secondary rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Overdue alert */}
        {overdue && canComplete && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-600">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>项目已逾期 {Math.abs(daysLeft)} 天，请尽快确认完成</span>
          </div>
        )}
        {/* Complete button */}
        {canComplete && (
          <button onClick={() => onComplete(project)}
            className="mt-2 w-full py-2 bg-green-100 text-green-700 rounded-xl text-xs font-medium hover:bg-green-200 transition-colors flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />确认完成项目（需审核）
          </button>
        )}
        {project.status === '完成审批中' && (
          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700 text-center">
            ⏳ 项目完成审批中...
          </div>
        )}
      </div>

      <div className="flex gap-1 px-4 pt-3 border-b border-border">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-2.5 py-1.5 text-xs font-medium relative pb-2 transition-colors ${tab === t ? 'text-foreground' : 'text-muted-foreground'}`}>
            {TAB_LABELS[i]}
            {tab === t && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full" />}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {tab === 'info' && (
          <div className="space-y-2.5">
            <ProjectProgress startDate={project.start_date} endDate={project.end_date} status={project.status} />
            {bid && (
              <Link
                to={`/business?id=${bid.id}`}
                className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg text-xs text-purple-700 hover:bg-purple-100 transition-colors group"
              >
                <Briefcase className="w-3.5 h-3.5 shrink-0" />
                <span className="font-medium flex-1 truncate">关联竞标：{bid.project_name}</span>
                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            )}
            {[
              ['项目编号', project.id?.slice(-8)], ['合同编号', project.contract_no || '-'],
              ['客户', project.customer], ['项目类型', project.project_type],
              ['开始时间', project.start_date || '-'], ['结束时间', project.end_date || '-'],
              ['合同金额', `¥${((project.contract_amount || 0) / 10000).toFixed(0)}万`],
              ['成本预算', `¥${((project.budget_cost || 0) / 10000).toFixed(0)}万`],
              ['剩余预算', `¥${(remainingBudget / 10000).toFixed(1)}万`],
              ['结算方式', project.payment_method], ['负责人', project.manager],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{k}</span>
                <span className={`font-medium text-right max-w-[55%] text-xs ${k === '剩余预算' && remainingBudget < 0 ? 'text-red-600' : ''}`}>{v}</span>
              </div>
            ))}
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">项目成员</p>
              <div className="flex flex-wrap gap-1">
                {(project.members || []).map(m => (
                  <span key={m} className="px-2 py-0.5 bg-secondary rounded-full text-xs">{m}</span>
                ))}
                {(!project.members || project.members.length === 0) && <span className="text-xs text-muted-foreground">暂无成员</span>}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">商务合同文件</p>
              {contractFiles.length > 0 ? (
                <div className="space-y-1">
                  {contractFiles.map((f, i) => (
                    <a key={i} href={fileUrl(f.url)} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-secondary/60 rounded-lg hover:bg-secondary transition-colors">
                      <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span className="text-xs text-blue-600 hover:underline truncate">{f.name}</span>
                    </a>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">{project.bid_id ? '暂无合同文件' : '未关联商务项目'}</span>
              )}
            </div>

            {pendingOtherApprovals.length > 0 && (
              <div className="bg-secondary/30 rounded-xl p-3 mt-2">
                <p className="text-xs font-semibold mb-3">进行中的审批</p>
                <div className="space-y-3">
                  {pendingOtherApprovals.map(a => {
                    let steps = [];
                    try { steps = JSON.parse(a.steps || '[]'); } catch {}
                    return (
                      <div key={a.id} className="bg-white/70 rounded-lg p-2.5 border border-border/40">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className="text-xs font-medium truncate">{a.title}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${a.status === '审核中' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>{a.status}</span>
                        </div>
                        {steps.length > 0 ? (
                          <ApprovalTimeline steps={steps} compact />
                        ) : (
                          <p className="text-[10px] text-muted-foreground">暂无审批步骤</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs font-semibold mb-3">项目财务汇总</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-green-600">已收款</p>
                  <p className="text-lg font-bold text-green-700 mt-1">¥{(income / 10000).toFixed(1)}万</p>
                </div>
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-red-600">已支出</p>
                  <p className="text-lg font-bold text-red-700 mt-1">¥{(expense / 10000).toFixed(1)}万</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-blue-600">合同金额</p>
                  <p className="text-sm font-bold text-blue-700 mt-1">¥{((project.contract_amount || 0) / 10000).toFixed(0)}万</p>
                </div>
                <div className={`rounded-xl p-3 text-center ${remainingBudget < 0 ? 'bg-red-50' : 'bg-orange-50'}`}>
                  <p className={`text-xs ${remainingBudget < 0 ? 'text-red-600' : 'text-orange-600'}`}>剩余预算</p>
                  <p className={`text-sm font-bold mt-1 ${remainingBudget < 0 ? 'text-red-700' : 'text-orange-700'}`}>¥{(remainingBudget / 10000).toFixed(1)}万</p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">* 收支汇总仅统计已通过/已付款的审批金额</p>

              <div className="mt-4">
                <p className="text-xs font-semibold mb-3">收支明细记录</p>
                <div className="space-y-2">
                  {approvals.filter(a => a.direction === '收入' || a.direction === '支出').length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">暂无收支记录</p>
                  )}
                  {approvals.filter(a => a.direction === '收入' || a.direction === '支出').map(a => (
                    <div key={a.id} className="flex items-center justify-between p-2.5 bg-secondary/50 rounded-lg">
                      <div>
                        <p className="text-xs font-medium text-foreground">{a.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {a.type_label} · {a.applicant} · <span className={a.status === '已通过' || a.status === '已付款' ? 'text-green-600' : a.status === '已拒绝' ? 'text-red-600' : 'text-yellow-600'}>{a.status}</span>
                        </p>
                      </div>
                      <span className={`text-xs font-semibold ${a.direction === '收入' ? 'text-green-600' : 'text-red-600'}`}>
                        {a.direction === '收入' ? '+' : '-'}¥{(a.amount || 0).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        )}
        {tab === 'approvals' && (
          <div className="space-y-2">
            {tabApprovals.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">暂无审批记录</p>}
            {tabApprovals.map(a => (
              <div key={a.id} className="border border-border rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">{a.title}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${a.status === '已通过' || a.status === '已付款' ? 'bg-green-100 text-green-700' : a.status === '审核中' ? 'bg-blue-100 text-blue-700' : a.status === '已拒绝' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{a.status}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{a.type_label} · {a.applicant}</span>
                  {a.amount > 0 && (
                    <span className={`font-semibold ${a.direction === '收入' ? 'text-green-600' : 'text-red-600'}`}>
                      {a.direction === '收入' ? '+' : '-'}¥{(a.amount || 0).toLocaleString()}
                    </span>
                  )}
                </div>
                {a.steps && (() => {
                  try {
                    const steps = JSON.parse(a.steps);
                    return (
                      <div className="mt-3 pt-3 border-t border-border">
                        <ApprovalTimeline steps={steps} compact />
                      </div>
                    );
                  } catch (e) { return null; }
                })()}
              </div>
            ))}
          </div>
        )}
        {tab === 'logs' && (
          <div className="space-y-2">
            {logs.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">暂无日志</p>}
            {logs.map(log => (
              <div key={log.id} className="border-l-2 border-lime-400 pl-3 py-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{log.action}</span>
                  <span className="text-xs text-muted-foreground">{log.created_date?.split('T')[0]}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{log.detail}</p>
                {log.operator && <p className="text-xs text-muted-foreground/60 mt-0.5">操作人：{log.operator}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}