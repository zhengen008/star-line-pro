/**
 * SubmitInitiationModal - 对待立项项目填写立项信息并提交立项审批
 * 权限由调用方保证（负责人或管理员）。
 */
import { useState } from 'react';
import { X } from 'lucide-react';
import EmployeePicker from '../EmployeePicker';
import {
  formModalOverlayClass,
  formModalPanelClass,
  formModalHeaderClass,
  formModalBodyClass,
  formModalFooterClass,
  formLabelClass,
  formInputClass,
  formCancelBtnClass,
  formSubmitBtnClass,
} from '@/lib/formStyles';

export default function SubmitInitiationModal({ project, onClose, onSave, saving = false }) {
  const [form, setForm] = useState({
    contractNo: project.contract_no || '',
    budgetCost: project.budget_cost || '',
    members: Array.isArray(project.members) ? project.members : [],
    startDate: project.start_date || '',
    endDate: project.end_date || '',
    projectManager: project.manager || '',
  });
  const f = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (!form.startDate || !form.endDate || !form.projectManager) return;
    const budgetCost = +form.budgetCost || 0;
    onSave({
      contract_no: form.contractNo || null,
      start_date: form.startDate,
      end_date: form.endDate,
      budget_cost: budgetCost,
      remaining_budget: budgetCost,
      manager: form.projectManager,
      members: form.members,
    });
  };

  return (
    <div className={formModalOverlayClass}>
      <div className={formModalPanelClass}>
        <div className={formModalHeaderClass}>
          <h3 className="font-semibold">项目立项 · {project.name}</h3>
          <button type="button" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className={formModalBodyClass}>
          <div className="bg-lime-50 border border-lime-200 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-lime-700">来自竞标的商务信息（可在竞标管理修改，待立项期间自动同步）</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-muted-foreground">客户：</span><span className="font-medium">{project.customer}</span></div>
              <div><span className="text-muted-foreground">项目类型：</span><span className="font-medium">{project.project_type || '-'}</span></div>
              <div><span className="text-muted-foreground">合同金额：</span><span className="font-medium text-lime-700">¥{((project.contract_amount || 0) / 10000).toFixed(2)}万</span></div>
              <div><span className="text-muted-foreground">结算方式：</span><span className="font-medium">{project.payment_method || '-'}</span></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={formLabelClass}>开始时间 *</label>
              <input type="date" value={form.startDate} onChange={(e) => f('startDate', e.target.value)} className={formInputClass} />
            </div>
            <div>
              <label className={formLabelClass}>结束时间 *</label>
              <input type="date" value={form.endDate} onChange={(e) => f('endDate', e.target.value)} className={formInputClass} />
            </div>
            <div>
              <label className={formLabelClass}>合同编号（可选）</label>
              <input value={form.contractNo} onChange={(e) => f('contractNo', e.target.value)} className={formInputClass} />
            </div>
            <div>
              <label className={formLabelClass}>总成本预算（元）</label>
              <input type="number" value={form.budgetCost} onChange={(e) => f('budgetCost', e.target.value)} className={formInputClass} />
            </div>
            <div className="col-span-2">
              <label className={formLabelClass}>项目负责人 *<span className="ml-1 text-muted-foreground/60">（二级负责人）</span></label>
              <EmployeePicker value={form.projectManager} onChange={(v) => f('projectManager', v)} placeholder="请选择项目负责人..." className="mt-1" />
            </div>
          </div>
          <div>
            <label className={formLabelClass}>项目成员（三级负责人）</label>
            <EmployeePicker value={form.members} onChange={(v) => f('members', v)} multiple placeholder="请选择项目成员..." className="mt-1" />
          </div>
          <div className="bg-lime-50 border border-lime-200 rounded-xl p-3 text-xs text-lime-700">
            <strong>立项说明：</strong>提交后进入<b>立项审批</b>流程，审批通过后将通知项目负责人与成员并启动项目
          </div>
        </div>
        <div className={formModalFooterClass}>
          <button type="button" onClick={onClose} className={formCancelBtnClass} disabled={saving}>取消</button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!form.startDate || !form.endDate || !form.projectManager || saving}
            className={formSubmitBtnClass}
          >
            {saving ? '提交中…' : '提交立项'}
          </button>
        </div>
      </div>
    </div>
  );
}
