import { ChevronRight, FolderKanban } from 'lucide-react';
import { STATUS_CONFIG, getApprovalTypeConfig } from './ApprovalTypeConfig';

export default function ApprovalTable({ approvals, selectedId, onSelect }) {
  return (
    <table className="w-full text-sm table-fixed">
      <thead>
        <tr className="bg-secondary/50">
          {['标题', '类型', '关联项目', '申请人', '金额', '日期', '状态', ''].map(h => (
            <th key={h} className="text-left px-5 py-3 text-xs text-muted-foreground font-medium whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <colgroup>
        <col className="w-[22%]" />
        <col className="w-[12%]" />
        <col className="w-[16%]" />
        <col className="w-[12%]" />
        <col className="w-[12%]" />
        <col className="w-[12%]" />
        <col className="w-[10%]" />
        <col className="w-[4%]" />
      </colgroup>
      <tbody>
        {approvals.map(a => {
          const sc = STATUS_CONFIG[a.status] || STATUS_CONFIG['待审核'];
          const tc = getApprovalTypeConfig(a.type);
          return (
            <tr key={a.id} onClick={() => onSelect(a.id)}
              className={`border-t border-border/40 hover:bg-secondary/20 transition-colors group cursor-pointer ${selectedId === a.id ? 'bg-primary/5' : ''}`}>
              <td className="px-5 py-3 whitespace-nowrap overflow-hidden">
                <p className="font-medium text-sm truncate">{a.title}</p>
                {a.sub_type && <p className="text-xs text-muted-foreground truncate">{a.sub_type}</p>}
              </td>
              <td className="px-5 py-3 whitespace-nowrap overflow-hidden">
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground max-w-full">
                  {tc?.icon ? (() => { const Icon = tc.icon; return <Icon className="w-3.5 h-3.5 shrink-0" />; })() : null}
                  <span className="truncate">{a.type_label}</span>
                </span>
              </td>
              <td className="px-5 py-3 text-xs whitespace-nowrap overflow-hidden">
                {a.project_name ? (
                  <span className="inline-flex items-center gap-1 text-blue-600 max-w-full">
                    <FolderKanban className="w-3 h-3 shrink-0" />
                    <span className="truncate">{a.project_name}</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </td>
              <td className="px-5 py-3 whitespace-nowrap">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-lime-400 flex items-center justify-center text-xs font-semibold text-white shrink-0">
                    {(a.applicant || '?')[0]}
                  </div>
                  <span className="text-xs truncate">{a.applicant}</span>
                </div>
              </td>
              <td className="px-5 py-3 font-medium text-xs whitespace-nowrap">
                {Number(a.amount) > 0 ? (
                  <span className={a.direction === '收入' ? 'text-green-600' : 'text-red-600'}>
                    {a.direction === '收入' ? '+' : '-'}¥{Number(a.amount || 0).toLocaleString()}
                  </span>
                ) : '-'}
              </td>
              <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                {typeof a.created_date === 'string' ? a.created_date.split('T')[0] : (a.created_date ? new Date(a.created_date).toISOString().split('T')[0] : '-')}
              </td>
              <td className="px-5 py-3 whitespace-nowrap">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sc.dot}`}></span>
                  {a.status}
                </span>
              </td>
              <td className="px-5 py-3 whitespace-nowrap">
                <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </td>
            </tr>
          );
        })}
        {approvals.length === 0 && (
          <tr><td colSpan={8} className="px-4 py-16 text-center text-sm text-muted-foreground">暂无审批记录</td></tr>
        )}
      </tbody>
    </table>
  );
}
