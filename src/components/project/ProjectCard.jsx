/**
 * ProjectCard - 项目卡片（用于统一的卡片网格视图）
 * 展示：名称/客户、进度条、负责人、收支、状态徽章
 */
import { AlertTriangle, Users } from 'lucide-react';
import ProjectProgress, { calcProgress } from './ProjectProgress';

const STATUS_COLORS = {
  '待立项': 'bg-amber-100 text-amber-700',
  '待审批': 'bg-yellow-100 text-yellow-700',
  '执行中': 'bg-blue-100 text-blue-700',
  '完成审批中': 'bg-purple-100 text-purple-700',
  '已完成': 'bg-green-100 text-green-700',
  '已归档': 'bg-gray-100 text-gray-600',
};

export default function ProjectCard({ project, onSelect, approvals = [] }) {
  const pa = approvals.filter(a => a.project_id === project.id);
  const expense = pa.filter(a => a.direction === '支出' && (a.status === '已通过' || a.status === '已付款'))
    .reduce((s, a) => s + (a.amount || 0), 0);
  const income = pa.filter(a => a.direction === '收入' && (a.status === '已通过' || a.status === '已付款'))
    .reduce((s, a) => s + (a.amount || 0), 0);
  const pendingCount = pa.filter(a => a.status === '待审核' || a.status === '审核中').length;
  const remaining = (project.budget_cost || 0) - expense;
  const { overdue } = calcProgress(project.start_date, project.end_date);
  const isActive = !['已完成', '已归档'].includes(project.status);
  const showOverdue = overdue && isActive;

  return (
    <div onClick={() => onSelect(project)}
      className={`bg-white border rounded-2xl p-4 shadow-[0_2px_10px_rgb(0,0,0,0.02)] cursor-pointer transition-all space-y-3 ${showOverdue ? 'border-red-300' : 'border-border/50'} hover:border-primary/50 hover:shadow-md`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold leading-tight truncate flex-1">{project.name}</p>
            {showOverdue && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{project.customer}</p>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${STATUS_COLORS[project.status] || 'bg-gray-100 text-gray-600'}`}>
          {project.status}
        </span>
      </div>

      {project.start_date && project.end_date
        ? <ProjectProgress startDate={project.start_date} endDate={project.end_date} status={project.status} />
        : isActive && <p className="text-xs text-muted-foreground/60">未设置时间区间</p>
      }

      <div className="flex items-center gap-1.5">
        <div className="w-5 h-5 rounded-full bg-lime-400 flex items-center justify-center text-white shrink-0" style={{ fontSize: 9 }}>{project.manager?.[0] || '?'}</div>
        <span className="text-xs text-muted-foreground truncate">{project.manager || '-'}</span>
        <div className="ml-auto flex items-center gap-1">
          <Users className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{(project.members || []).length + 1}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1 text-xs">
        <div className="bg-green-50 rounded-lg px-2 py-1 text-center">
          <p className="text-green-600 font-medium">+¥{(income / 10000).toFixed(2)}万</p>
          <p className="text-green-500" style={{ fontSize: 10 }}>已收款</p>
        </div>
        <div className={`rounded-lg px-2 py-1 text-center ${remaining < 0 ? 'bg-red-50' : 'bg-orange-50'}`}>
          <p className={`font-medium ${remaining < 0 ? 'text-red-600' : 'text-orange-600'}`}>¥{(remaining / 10000).toFixed(2)}万</p>
          <p className={remaining < 0 ? 'text-red-500' : 'text-orange-500'} style={{ fontSize: 10 }}>剩余预算</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>合同 ¥{((project.contract_amount || 0) / 10000).toFixed(2)}万</span>
        {pendingCount > 0 && <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded-full">{pendingCount}待审</span>}
      </div>
    </div>
  );
}