import { useState } from 'react';
import { X } from 'lucide-react';
import EmployeePicker from '../EmployeePicker';
import { SETTLEMENT_METHODS } from '@/lib/acceptancePeriods';

export default function EditProjectModal({ project, onClose, onSave }) {
  const [form, setForm] = useState({
    contract_no: project.contract_no || '',
    start_date: project.start_date || '',
    end_date: project.end_date || '',
    payment_method: project.payment_method || SETTLEMENT_METHODS[0],
    members: project.members || [],
  });
  const paymentOptions = SETTLEMENT_METHODS.includes(project.payment_method) || !project.payment_method
    ? SETTLEMENT_METHODS
    : [project.payment_method, ...SETTLEMENT_METHODS];

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const changes = {};
  if (form.contract_no !== (project.contract_no || '')) changes['合同编号'] = `${project.contract_no || '-'} → ${form.contract_no || '-'}`;
  if (form.start_date !== (project.start_date || '')) changes['开始时间'] = `${project.start_date || '-'} → ${form.start_date}`;
  if (form.end_date !== (project.end_date || '')) changes['结束时间'] = `${project.end_date || '-'} → ${form.end_date}`;
  if (form.payment_method !== (project.payment_method || '')) changes['结算方式'] = `${project.payment_method || '-'} → ${form.payment_method}`;
  if (JSON.stringify(form.members) !== JSON.stringify(project.members || [])) changes['项目成员'] = `- → ${form.members.join(',')}`;

  const hasChanges = Object.keys(changes).length > 0;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card rounded-2xl shadow-xl w-[520px] max-h-[85vh] flex flex-col animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-semibold">编辑项目 · {project.name}</h3>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-auto p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">合同编号</label>
              <input value={form.contract_no} onChange={e => f('contract_no', e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-lime-400" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">开始时间 *</label>
              <input type="date" value={form.start_date} onChange={e => f('start_date', e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-lime-400" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">结束时间 *</label>
              <input type="date" value={form.end_date} onChange={e => f('end_date', e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-lime-400" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">结算方式（验收周期）</label>
              <select value={form.payment_method} onChange={e => f('payment_method', e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-lime-400 cursor-pointer">
                {paymentOptions.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">项目成员</label>
            <EmployeePicker
              value={form.members}
              onChange={v => f('members', v)}
              multiple
              placeholder="请选择项目成员..."
              className="mt-1"
            />
          </div>
          {hasChanges && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-700">
              <strong>变更内容（提交后需审核）：</strong>
              <ul className="mt-1 space-y-0.5 list-disc list-inside">
                {Object.entries(changes).map(([k, v]) => <li key={k}>{k}：{v}</li>)}
              </ul>
            </div>
          )}
        </div>
        <div className="flex gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="flex-1 py-2.5 bg-secondary rounded-xl text-sm hover:bg-border transition-colors">取消</button>
          <button onClick={() => onSave(form, changes)} disabled={!hasChanges}
            className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40">
            提交修改（需审核）
          </button>
        </div>
      </div>
    </div>
  );
}