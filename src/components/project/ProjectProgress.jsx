import { AlertTriangle } from 'lucide-react';

export function calcProgress(startDate, endDate) {
  if (!startDate || !endDate) return { percent: 0, overdue: false, daysLeft: null };
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  const total = end - start;
  if (total <= 0) return { percent: 100, overdue: true, daysLeft: 0 };
  const elapsed = now - start;
  const percent = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  return { percent, overdue: daysLeft < 0, daysLeft };
}

export default function ProjectProgress({ startDate, endDate, status }) {
  if (!startDate || !endDate) return null;
  if (status === '已完成' || status === '已归档') return null;

  const { percent, overdue, daysLeft } = calcProgress(startDate, endDate);

  return (
    <div>
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>项目进度</span>
        <span>{overdue
          ? <span className="text-red-500 font-medium flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" />已逾期 {Math.abs(daysLeft)} 天</span>
          : `${percent}% · 剩余 ${daysLeft} 天`}
        </span>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${overdue ? 'bg-red-500' : percent > 80 ? 'bg-yellow-400' : 'bg-lime-400'}`}
          style={{ width: `${Math.min(100, percent)}%` }} />
      </div>
    </div>
  );
}