/**
 * ApprovalTimeline - 审批流转时间轴
 * 统一的审批进度可视化组件，显示：
 *  - 节点状态（已通过/已拒绝/审批中/等待中/已跳过）
 *  - 审批人 + 角色
 *  - 审批时间
 *  - 审批意见（如有）
 *  - 当前节点高亮（蓝色 + 脉冲动画）
 *
 * Props:
 *   steps: array of step objects { name, actor, role, done, passed, skipped, time, comment, isCondition, conditionResult, isCC }
 *   compact?: boolean  - 紧凑模式（用于侧边栏小尺寸场景）
 */
import { MessageSquare, Clock } from 'lucide-react';

export default function ApprovalTimeline({ steps = [], compact = false }) {
  if (!steps || steps.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-4">暂无审批步骤</p>;
  }

  // 计算当前进行中的节点（第一个未完成且未跳过的）
  const activeIdx = steps.findIndex((s, i) =>
    !s.done && !s.skipped &&
    steps.slice(0, i).filter(x => !x.skipped && !x.isCondition && !x.isCC).every(x => x.done)
  );

  return (
    <div className="relative">
      {/* 竖线 */}
      <div className={`absolute top-2 bottom-2 w-px bg-border ${compact ? 'left-[7px]' : 'left-[9px]'}`} />
      <div className={compact ? 'space-y-2' : 'space-y-3'}>
        {steps.map((step, i) => {
          const isActive = i === activeIdx;
          const isPending = !step.done && !step.skipped && !isActive;
          const dotSize = compact ? 'w-4 h-4 text-[10px]' : 'w-5 h-5 text-xs';
          return (
            <div key={i} className="flex items-start gap-3 relative">
              {/* 节点圆点 */}
              <div className={`${dotSize} rounded-full flex items-center justify-center shrink-0 z-10 font-bold border-2
                ${step.skipped ? 'bg-gray-100 border-gray-300 text-gray-400' :
                  step.done ? (step.passed ? 'bg-green-500 border-green-500 text-white' : 'bg-red-500 border-red-500 text-white') :
                  isActive ? 'bg-blue-500 border-blue-500 text-white animate-pulse' :
                  'bg-background border-border text-muted-foreground'}`}>
                {step.skipped ? '–' : step.done ? (step.passed ? '✓' : '✗') : isActive ? '…' : i + 1}
              </div>
              {/* 内容卡片 */}
              <div className={`flex-1 min-w-0 pb-1 rounded-lg px-2 py-1.5 -ml-1
                ${isActive ? 'bg-blue-50 border border-blue-200' : step.done && !step.passed ? 'bg-red-50' : ''}`}>
                <div className="flex items-center justify-between gap-1 flex-wrap">
                  <p className={`text-xs font-semibold leading-tight ${
                    step.skipped ? 'line-through text-muted-foreground' :
                    step.done && step.passed ? 'text-green-700' :
                    step.done && !step.passed ? 'text-red-700' :
                    isActive ? 'text-blue-700' : 'text-foreground'}`}>
                    {step.name}
                  </p>
                  {step.done && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 font-medium ${step.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {step.passed ? '已通过' : '已拒绝'}
                    </span>
                  )}
                  {isActive && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium shrink-0">审批中</span>}
                  {/* 当前审批人是否已读 */}
                  {isActive && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${step.read ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {step.read ? '✓ 已读' : '未读'}
                    </span>
                  )}
                  {isPending && !step.skipped && <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />等待中</span>}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {step.isCondition ? `⚡ ${step.conditionResult || step.actor}` : `👤 ${step.actor || '-'}`}
                  {step.role && !step.isCondition && ` · ${step.role}`}
                </p>
                {step.skipped && <p className="text-[10px] text-orange-500 mt-0.5">申请人即审批人，自动跳过</p>}
                {step.time && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{step.time}</p>}
                {step.comment && (
                  <div className="mt-1 px-2 py-1 bg-white/70 rounded border border-border/40 flex items-start gap-1.5">
                    <MessageSquare className="w-2.5 h-2.5 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-[11px] text-foreground/80 leading-relaxed">{step.comment}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}