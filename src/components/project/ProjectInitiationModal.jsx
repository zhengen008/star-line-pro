/**
 * ProjectInitiationModal - 统一立项表单
 * - 传入 project：对该待立项项目提交立项（商务信息只读）
 * - 不传 project：选择已中标商务记录；找不到时可手动填写（直签兜底）
 * 提交 onSubmit({ project | newProject, formData, serviceItems })
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { api } from '@/api/client';
import EmployeePicker from '../EmployeePicker';
import ServiceItemsImporter from './ServiceItemsImporter';
import { listInitiatableBids } from '@/lib/bidProjectSync';
import { SETTLEMENT_METHODS } from '@/lib/acceptancePeriods';
import {
  formModalOverlayClass,
  formModalHeaderClass,
  formModalBodyClass,
  formModalFooterClass,
  formModalShellClass,
  formLabelClass,
  formInputClass,
  formSelectClass,
  formCancelBtnClass,
  formSubmitBtnClass,
} from '@/lib/formStyles';

const wan = (v) => `¥${((Number(v) || 0) / 10000).toFixed(2)}万`;

function BusinessInfo({ customer, projectType, amount, paymentMethod, bizManager }) {
  return (
    <div className="bg-lime-50 border border-lime-200 rounded-xl p-4 space-y-2">
      <p className="text-xs font-semibold text-lime-700">商务已填写的信息（立项后沿用，修改请到商务管理）</p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div><span className="text-muted-foreground">客户：</span><span className="font-medium">{customer || '-'}</span></div>
        <div><span className="text-muted-foreground">项目类型：</span><span className="font-medium">{projectType || '-'}</span></div>
        <div><span className="text-muted-foreground">合同金额：</span><span className="font-medium text-lime-700">{wan(amount)}</span></div>
        <div><span className="text-muted-foreground">结算方式（验收周期）：</span><span className="font-medium text-lime-700">{paymentMethod || '-'}</span></div>
        {bizManager && <div className="col-span-2"><span className="text-muted-foreground">商务负责人：</span><span className="font-medium">{bizManager}</span></div>}
      </div>
    </div>
  );
}

function initialForm(project) {
  return {
    contractNo: project?.contract_no || '',
    startDate: project?.start_date || '',
    endDate: project?.end_date || '',
    projectManager: project?.manager || '',
    members: Array.isArray(project?.members) ? project.members : [],
  };
}

export default function ProjectInitiationModal({ project: lockedProject = null, onClose, onSubmit, saving = false, error = '' }) {
  const [bidId, setBidId] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [manual, setManual] = useState({ title: '', amount: '', customer: '', paymentMethod: SETTLEMENT_METHODS[0] });
  const [form, setForm] = useState(() => initialForm(lockedProject));
  const [serviceItems, setServiceItems] = useState([]);

  const { data: bids = [] } = useQuery({
    queryKey: ['bids-for-initiation'],
    queryFn: () => api.entities.Bid.list('-created_date', 500),
    enabled: !lockedProject,
  });
  const { data: projects = [] } = useQuery({
    queryKey: ['projects-for-initiation'],
    queryFn: () => api.entities.Project.list('-created_date', 500),
    enabled: !lockedProject,
  });
  const options = useMemo(() => listInitiatableBids(bids, projects), [bids, projects]);
  const selected = options.find((o) => o.bid.id === bidId) || null;

  const f = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const m = (k, v) => setManual((p) => ({ ...p, [k]: v }));

  const selectBid = (id) => {
    setBidId(id);
    const opt = options.find((o) => o.bid.id === id);
    setForm(initialForm(opt?.project || { manager: opt?.bid.manager }));
  };

  const toggleManual = () => {
    setManualMode((v) => !v);
    setBidId('');
    setForm(initialForm(null));
  };

  const manualAmount = Number(manual.amount);
  const targetReady = lockedProject
    ? true
    : manualMode
      ? !!manual.title.trim() && !!manual.customer.trim() && Number.isFinite(manualAmount) && manualAmount > 0
      : !!selected;
  const datesValid = !!form.startDate && !!form.endDate && form.endDate >= form.startDate;
  const canSubmit = targetReady && datesValid && !!form.projectManager && !saving;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const formData = {
      contract_no: form.contractNo || null,
      start_date: form.startDate,
      end_date: form.endDate,
      manager: form.projectManager,
      members: form.members,
    };
    if (lockedProject) {
      onSubmit({ project: lockedProject, formData, serviceItems });
    } else if (manualMode) {
      onSubmit({
        newProject: {
          bid_id: null,
          name: manual.title.trim(),
          customer: manual.customer.trim(),
          project_type: '直签',
          contract_amount: manualAmount,
          payment_method: manual.paymentMethod,
        },
        formData: { ...formData, payment_method: manual.paymentMethod },
        serviceItems,
      });
    } else if (selected.project) {
      onSubmit({ project: selected.project, formData, serviceItems });
    } else {
      const { bid } = selected;
      onSubmit({
        newProject: {
          bid_id: bid.id,
          name: bid.project_name,
          customer: bid.customer_name || '待定',
          project_type: bid.project_type || '',
          contract_amount: bid.bid_amount,
          payment_method: bid.payment_method || '',
        },
        formData,
        serviceItems,
      });
    }
  };

  const info = lockedProject
    ? { customer: lockedProject.customer, projectType: lockedProject.project_type, amount: lockedProject.contract_amount, paymentMethod: lockedProject.payment_method }
    : selected
      ? { customer: selected.bid.customer_name, projectType: selected.bid.project_type, amount: selected.bid.bid_amount, paymentMethod: selected.bid.payment_method, bizManager: selected.bid.manager }
      : null;

  return (
    <div className={formModalOverlayClass}>
      <div className={`${formModalShellClass} w-[640px] max-w-[calc(100vw-2rem)] max-h-[90vh] flex flex-col animate-fade-in`}>
        <div className={formModalHeaderClass}>
          <h3 className="font-semibold">项目立项{lockedProject ? ` · ${lockedProject.name}` : ''}</h3>
          <button type="button" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className={formModalBodyClass}>
          {!lockedProject && !manualMode && (
            <div>
              <label className={formLabelClass}>关联商务项目 *</label>
              <select value={bidId} onChange={(e) => selectBid(e.target.value)} className={formSelectClass}>
                <option value="">请选择已中标的商务项目…</option>
                {options.map(({ bid, project }) => (
                  <option key={bid.id} value={bid.id}>
                    {bid.project_name} · {bid.customer_name || '-'}{project ? '（待立项）' : ''}
                  </option>
                ))}
              </select>
              {options.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">暂无可立项的中标项目，请先到「商务管理」标记中标</p>
              )}
            </div>
          )}

          {!lockedProject && (
            <button type="button" onClick={toggleManual} className="text-xs text-primary hover:underline">
              {manualMode ? '← 返回选择商务项目' : '找不到商务记录？手动填写'}
            </button>
          )}

          {manualMode ? (
            <div className="grid grid-cols-2 gap-3 bg-secondary/30 rounded-xl p-3">
              <div className="col-span-2">
                <label className={formLabelClass}>项目标题 *</label>
                <input value={manual.title} onChange={(e) => m('title', e.target.value)} placeholder="项目名称" className={formInputClass} />
              </div>
              <div>
                <label className={formLabelClass}>合同金额（元）*</label>
                <input type="number" value={manual.amount} onChange={(e) => m('amount', e.target.value)} className={formInputClass} />
              </div>
              <div>
                <label className={formLabelClass}>客户 *</label>
                <input value={manual.customer} onChange={(e) => m('customer', e.target.value)} className={formInputClass} />
              </div>
              <div className="col-span-2">
                <label className={formLabelClass}>结算方式（验收周期）*</label>
                <select value={manual.paymentMethod} onChange={(e) => m('paymentMethod', e.target.value)} className={formSelectClass}>
                  {SETTLEMENT_METHODS.map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
          ) : info && <BusinessInfo {...info} />}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={formLabelClass}>开始时间 *</label>
              <input type="date" value={form.startDate} onChange={(e) => f('startDate', e.target.value)} className={formInputClass} />
            </div>
            <div>
              <label className={formLabelClass}>结束时间 *</label>
              <input type="date" value={form.endDate} onChange={(e) => f('endDate', e.target.value)} className={formInputClass} />
            </div>
            {form.startDate && form.endDate && !datesValid && (
              <p className="col-span-2 -mt-1 text-xs text-red-600">结束时间不能早于开始时间</p>
            )}
            <div>
              <label className={formLabelClass}>合同编号（可选）</label>
              <input value={form.contractNo} onChange={(e) => f('contractNo', e.target.value)} className={formInputClass} />
            </div>
            <div>
              <label className={formLabelClass}>项目负责人 *<span className="ml-1 text-muted-foreground/60">（二级负责人）</span></label>
              <EmployeePicker value={form.projectManager} onChange={(v) => f('projectManager', v)} placeholder="请选择项目负责人..." className="mt-1" />
            </div>
          </div>
          <div>
            <label className={formLabelClass}>项目成员（三级负责人）</label>
            <EmployeePicker value={form.members} onChange={(v) => f('members', v)} multiple placeholder="请选择项目成员..." className="mt-1" />
          </div>

          <ServiceItemsImporter items={serviceItems} onChange={setServiceItems} />

          <div className="bg-lime-50 border border-lime-200 rounded-xl p-3 text-xs text-lime-700">
            <strong>立项说明：</strong>提交后进入<b>立项审批</b>，通过后项目启动为「执行中」，并按结算方式自动生成验收期次；导入的服务内容随立项一起生效。
          </div>
          {error && <div className="px-3 py-2 rounded-lg text-xs bg-red-50 text-red-700">{error}</div>}
        </div>
        <div className={formModalFooterClass}>
          <button type="button" onClick={onClose} className={formCancelBtnClass} disabled={saving}>取消</button>
          <button type="button" onClick={handleSubmit} disabled={!canSubmit} className={formSubmitBtnClass}>
            {saving ? '提交中…' : '提交立项'}
          </button>
        </div>
      </div>
    </div>
  );
}
