import { useEffect, useRef } from 'react';
import { X, Copy, FolderKanban, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fileUrl } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { STATUS_CONFIG, getApprovalTypeConfig } from './ApprovalTypeConfig';
import ApprovalTimeline from './ApprovalTimeline';
import { getActiveApprovalStepIndex, isCurrentApprover, parseSteps } from '@/lib/approvalAccess';

function formatDate(value) {
  if (!value) return '-';
  if (typeof value === 'string') return value.split('T')[0] || value;
  try {
    return new Date(value).toISOString().split('T')[0];
  } catch {
    return '-';
  }
}

function formatAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString();
}

export default function ApprovalDetailPanel({ item, onClose, onApprove, currentUser = '', onMarkStepRead, overlay = false }) {
  const { currentEmployee } = useAuth();
  const myRole = currentEmployee?.role || '';
  const myDept = currentEmployee?.department || '';
  const markedReadRef = useRef('');

  // 打开详情时：若当前用户是当前审批节点的审批人且该节点未读 → 标记已读（每条审批只触发一次，避免循环更新）
  useEffect(() => {
    if (!item?.id || !currentUser || !onMarkStepRead) return;
    if (markedReadRef.current === item.id) return;
    const steps = parseSteps(item.steps);
    const activeIdx = getActiveApprovalStepIndex(steps);
    if (activeIdx < 0) return;
    const step = steps[activeIdx];
    if (step.read) {
      markedReadRef.current = item.id;
      return;
    }
    if (isCurrentApprover(item, { currentUser, role: myRole, dept: myDept })) {
      markedReadRef.current = item.id;
      steps[activeIdx] = { ...step, read: true };
      onMarkStepRead(item.id, steps);
    }
  }, [item, currentUser, myRole, myDept, onMarkStepRead]);

  if (!item) return null;

  const fields = (() => { try { return JSON.parse(item.fields || '{}'); } catch { return {}; } })();
  const steps = parseSteps(item.steps);
  const typeConfig = getApprovalTypeConfig(item.type);
  const TypeIcon = typeConfig?.icon;
  const canApprove = isCurrentApprover(item, { currentUser, role: myRole, dept: myDept });
  const canMarkPaid = item.status === '已通过' && (item.direction === '支出');
  const amountNum = Number(item.amount) || 0;
  const ccList = Array.isArray(item.cc_list) ? item.cc_list : [];

  const panelClass = overlay
    ? 'w-[360px] max-w-[92vw] h-full bg-white shadow-xl flex flex-col animate-fade-in'
    : 'w-72 border-l border-border flex flex-col animate-fade-in shrink-0';

  const panel = (
    <div className={panelClass}>
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <p className="font-semibold text-sm truncate">{item.title}</p>
        <button onClick={onClose} className="p-1 hover:bg-secondary rounded-lg shrink-0 ml-2">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
      <div className="p-5 flex-1 overflow-auto space-y-4">
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_CONFIG[item.status]?.color || 'bg-gray-100 text-gray-600'}`}>
            {item.status}
          </span>
          {typeConfig && (
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              {TypeIcon ? <TypeIcon className="w-3.5 h-3.5" /> : null}
              {item.type_label}
            </span>
          )}
        </div>

        {item.project_name && (
          <Link
            to={item.project_id ? `/projects/${item.project_id}` : '/projects'}
            className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg text-xs text-blue-700 hover:bg-blue-100 transition-colors group"
          >
            <FolderKanban className="w-3.5 h-3.5 shrink-0" />
            <span className="font-medium flex-1 truncate">关联项目：{item.project_name}</span>
            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        )}

        <div className="space-y-2">
          {[
            ['申请人', item.applicant],
            ['部门', item.dept],
            ['日期', formatDate(item.created_date)],
            item.sub_type ? ['子类型', item.sub_type] : null,
          ].filter(Boolean).map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{k}</span>
              <span className="font-medium text-xs">{v || '-'}</span>
            </div>
          ))}
        </div>

        {Object.keys(fields).length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border">
            {Object.entries(fields).map(([k, v]) => {
              let fileList = null;
              if (typeof v === 'string' && v.startsWith('[')) {
                try { fileList = JSON.parse(v); } catch {}
              }
              return (
                <div key={k} className="flex justify-between text-sm gap-2">
                  <span className="text-muted-foreground shrink-0">{k}</span>
                  {fileList ? (
                    <div className="flex flex-col gap-0.5 items-end">
                      {fileList.map((f, i) => (
                        <a key={i} href={fileUrl(f.url)} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline truncate max-w-[160px]">
                          📎 {f.name}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <span className="font-medium text-xs max-w-[55%] text-right">{String(v ?? '')}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {amountNum > 0 && (
          <div className="flex justify-between text-sm pt-2 border-t border-border">
            <span className="text-muted-foreground">金额</span>
            <span className={`font-bold ${item.direction === '收入' ? 'text-green-600' : 'text-red-600'}`}>
              {item.direction === '收入' ? '+' : '-'}¥{formatAmount(amountNum)}
            </span>
          </div>
        )}

        {ccList.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2"><Copy className="w-3 h-3" />抄送</p>
            <div className="flex flex-wrap gap-1">
              {ccList.map(cc => <span key={cc} className="px-2 py-0.5 bg-secondary rounded-full text-xs">{cc}</span>)}
            </div>
          </div>
        )}

        {steps.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-3 text-muted-foreground">审批进度</p>
            <ApprovalTimeline steps={steps} />
          </div>
        )}

        {canApprove && (
          <div className="flex gap-2 pt-2">
            <button onClick={() => onApprove(item.id, false)}
              className="flex-1 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-medium hover:bg-red-100 transition-colors">拒绝</button>
            <button onClick={() => onApprove(item.id, true)}
              className="flex-1 py-2 bg-primary text-white rounded-xl text-xs font-medium hover:bg-primary/90 transition-colors">通过</button>
          </div>
        )}
        {canMarkPaid && (
          <button onClick={() => onApprove(item.id, 'paid')}
            className="w-full py-2 bg-purple-100 text-purple-700 rounded-xl text-xs font-medium hover:bg-purple-200 transition-colors">
            💰 标记已付款
          </button>
        )}
      </div>
    </div>
  );

  if (overlay) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        <button type="button" className="absolute inset-0 bg-black/30 backdrop-blur-sm" aria-label="关闭" onClick={onClose} />
        <div className="relative z-10 h-full">{panel}</div>
      </div>
    );
  }

  return panel;
}
