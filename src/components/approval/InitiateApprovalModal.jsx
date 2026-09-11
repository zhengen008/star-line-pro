import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { X, Send, FolderKanban } from 'lucide-react';
import { APPROVAL_CATEGORIES, getAllApprovalTypes } from './ApprovalTypeConfig';
import OssUpload from '../OssUpload';
import { useAuth } from '@/lib/AuthContext';
import { eligibleProjectsForApproval } from '@/lib/projectAccess';

export default function InitiateApprovalModal({ onClose, onCreate }) {
  const { currentUserName, currentEmployee, isAdmin } = useAuth();
  const lockedApplicant = currentEmployee?.name || currentUserName || '';
  const lockedDept = currentEmployee?.department || '';

  const [step, setStep] = useState(1); // 1=category, 2=subtype (for groups), 3=form
  const [selectedCat, setSelectedCat] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [projectId, setProjectId] = useState('');
  const [linkProject, setLinkProject] = useState(null); // null=not chosen, true/false
  const [form, setForm] = useState({});
  const [applicant, setApplicant] = useState(lockedApplicant);
  const [dept, setDept] = useState(lockedDept);

  useEffect(() => {
    setApplicant(lockedApplicant);
    setDept(lockedDept);
  }, [lockedApplicant, lockedDept]);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.entities.Project.list('-created_date'),
  });

  const eligibleProjects = useMemo(
    () => eligibleProjectsForApproval(projects, { isAdmin, userName: lockedApplicant }),
    [projects, isAdmin, lockedApplicant]
  );

  const project = eligibleProjects.find(p => p.id === projectId);
  const typeConfig = selectedType ? getAllApprovalTypes().find(t => t.key === selectedType) : null;

  const handleSelectCategory = (cat) => {
    setSelectedCat(cat);
    if (cat.isGroup) {
      setStep(2);
    } else {
      setSelectedType(cat.key);
      setForm({});
      setStep(3);
    }
  };

  const handleSelectSubType = (child) => {
    setSelectedType(child.key);
    setForm({});
    setStep(3);
  };

  const handleSubmit = () => {
    if (!typeConfig || !applicant) return;
    const amountVal = parseFloat(String(form.amount || '0').replace(/[¥,万元]/g, '')) || 0;
    const fieldsObj = {};
    typeConfig.fields.forEach(f => {
      if (!form[f.key]) return;
      if (f.type === 'file') {
        const files = Array.isArray(form[f.key]) ? form[f.key] : [];
        if (files.length > 0) fieldsObj[f.label] = JSON.stringify(files.map(x => ({ url: x.url, name: x.name })));
      } else {
        fieldsObj[f.label] = form[f.key];
      }
    });
    if (form.contract_ref) fieldsObj['关联合同'] = form.contract_ref;

    onCreate({
      title: form.title || typeConfig.label,
      type: selectedType,
      type_label: typeConfig.label,
      sub_type: form.sub_type || '',
      applicant: applicant || '未知',
      dept: dept || '',
      fields: JSON.stringify(fieldsObj),
      amount: amountVal,
      direction: typeConfig.direction,
      project_id: projectId || '',
      project_name: project?.name || '',
      status: '待审核',
      cc_list: [],
      steps: '[]',
    });
    onClose();
  };

  const needProject = typeConfig?.needProject;
  const needContract = typeConfig?.needContract;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.12)] w-[600px] max-h-[88vh] flex flex-col animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-semibold">发起审批</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-secondary rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        {step === 1 && (
          <div className="p-6">
            <p className="text-xs text-muted-foreground mb-4">选择审批类型</p>
            <div className="grid grid-cols-3 gap-2.5">
              {APPROVAL_CATEGORIES.map(cat => (
                <button key={cat.key} onClick={() => handleSelectCategory(cat)}
                  className="flex items-center gap-3 p-4 rounded-2xl border border-border/50 shadow-sm hover:border-primary hover:bg-primary/5 transition-all text-left group">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-foreground group-hover:bg-primary group-hover:text-white transition-colors">
                    <cat.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium block">{cat.label}</span>
                    {cat.isGroup && <span className="text-xs text-muted-foreground">含 {cat.children.length} 个子类 →</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && selectedCat?.isGroup && (
          <div className="p-6">
            <button onClick={() => { setStep(1); setSelectedCat(null); }} className="text-xs text-muted-foreground hover:text-foreground mb-4 block">← 返回</button>
            <div className="flex items-center gap-3 p-3 bg-secondary rounded-xl mb-4">
              <selectedCat.icon className="w-6 h-6 text-foreground" />
              <span className="font-medium">{selectedCat.label}</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {selectedCat.children.map(child => (
                <button key={child.key} onClick={() => handleSelectSubType(child)}
                  className="flex flex-col items-center gap-3 p-5 rounded-2xl border border-border/50 shadow-sm hover:border-primary hover:bg-primary/5 transition-all group">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-foreground group-hover:bg-primary group-hover:text-white transition-colors">
                    <child.icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium">{child.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && typeConfig && (
          <div className="flex-1 overflow-auto p-6 space-y-4">
            <button onClick={() => { setStep(selectedCat?.isGroup ? 2 : 1); setSelectedType(null); }}
              className="text-xs text-muted-foreground hover:text-foreground">← 返回</button>

            <div className="flex items-center gap-3 p-3 bg-secondary rounded-xl">
              <div className="w-10 h-10 rounded-full bg-white border border-border/50 shadow-sm flex items-center justify-center text-primary">
                <typeConfig.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-sm">{typeConfig.label}</p>
                {typeConfig.direction !== '无' && (
                  <span className={`text-xs ${typeConfig.direction === '收入' ? 'text-green-600' : 'text-red-500'}`}>
                    {typeConfig.direction === '收入' ? '↗ 收入类' : '↘ 支出类'}
                  </span>
                )}
              </div>
            </div>

            {(needProject === 'required' || needProject === 'optional' || needProject === 'select') && (
              <div>
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  <FolderKanban className="w-3 h-3" />
                  项目名称 {needProject === 'required' ? '*' : ''}
                </label>
                {needProject === 'select' && (
                  <div className="flex gap-2 mt-1 mb-2">
                    <button type="button" onClick={() => { setLinkProject(true); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${linkProject === true ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground hover:bg-border'}`}>
                      关联项目
                    </button>
                    <button type="button" onClick={() => { setLinkProject(false); setProjectId(''); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${linkProject === false ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground hover:bg-border'}`}>
                      不关联项目
                    </button>
                  </div>
                )}
                {(needProject !== 'select' || linkProject === true) && (
                  <select value={projectId} onChange={e => setProjectId(e.target.value)}
                    className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-lime-400 cursor-pointer">
                    <option value="">{needProject === 'optional' ? '不关联项目' : '请选择项目...'}</option>
                    {eligibleProjects.map(p => (
                      <option key={p.id} value={p.id}>{p.name} · {p.customer}</option>
                    ))}
                  </select>
                )}
                {needProject === 'required' && !projectId && (
                  <p className="text-xs text-yellow-600 mt-1">⚠️ 该类型必须关联项目</p>
                )}
                {project && (
                  <div className="mt-2 text-xs bg-secondary/60 rounded-lg p-2 flex items-center gap-3">
                    <span>合同额 ¥{((project.contract_amount || 0) / 10000).toFixed(0)}万</span>
                    <span>·</span>
                    <span>{project.manager}</span>
                    <span>·</span>
                    <span>{project.payment_method}</span>
                  </div>
                )}
              </div>
            )}

            {needContract && (
              <div>
                <label className="text-xs text-muted-foreground">关联合同 *</label>
                <input value={form.contract_ref || ''} onChange={e => setForm(f => ({ ...f, contract_ref: e.target.value }))}
                  placeholder={project ? `合同编号: ${project.contract_no || '未填写'}` : '请先选择项目'}
                  className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-lime-400" />
                {project?.contract_no && (
                  <button type="button" onClick={() => setForm(f => ({ ...f, contract_ref: project.contract_no }))}
                    className="mt-1 text-xs text-blue-600 hover:underline">
                    自动填入项目合同：{project.contract_no}
                  </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">申请人 *</label>
                <input
                  value={applicant}
                  readOnly
                  className="mt-1 w-full px-3 py-2 bg-secondary/70 rounded-xl text-sm border-0 text-foreground cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">所在部门</label>
                <input
                  value={dept}
                  readOnly
                  placeholder="—"
                  className="mt-1 w-full px-3 py-2 bg-secondary/70 rounded-xl text-sm border-0 text-foreground cursor-not-allowed"
                />
                {!dept && (
                  <p className="text-[10px] text-amber-600 mt-1">未匹配到员工部门，请在员工管理补全</p>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">审批标题</label>
              <input value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder={typeConfig.label}
                className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-lime-400" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {typeConfig.fields.map((field, idx) => {
                const prevField = typeConfig.fields[idx - 1];
                const showGroup = field.group && (!prevField || prevField.group !== field.group);
                return (<>
                  {showGroup && <p key={`g-${field.group}`} className="col-span-2 text-xs font-semibold text-muted-foreground pt-2 border-t border-border mt-1">{field.group}</p>}
                  <div key={field.key} className={field.type === 'textarea' ? 'col-span-2' : ''}>
                  <label className="text-xs text-muted-foreground">{field.label} {field.required && '*'}</label>
                  {field.type === 'select' ? (
                    <select value={form[field.key] || ''} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-lime-400 cursor-pointer">
                      <option value="">请选择...</option>
                      {field.options?.map(o => <option key={o}>{o}</option>)}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea value={form[field.key] || ''} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                      rows={2} className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-lime-400 resize-none" />
                  ) : field.type === 'file' ? (
                    <OssUpload
                      fileType={selectedType || 'other'}
                      value={form[field.key] ? (Array.isArray(form[field.key]) ? form[field.key] : [{ url: form[field.key], name: field.label }]) : []}
                      onChange={files => setForm(f => ({ ...f, [field.key]: files }))}
                      multiple
                      label={`上传${field.label}`}
                    />
                  ) : (
                    <input
                      type={field.type === 'currency' || field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'month' ? 'month' : 'text'}
                      value={form[field.key] || ''} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-lime-400" />
                  )}
                </div>
              </>);
              })}
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={onClose} className="flex-1 py-2.5 bg-secondary rounded-xl text-sm hover:bg-border transition-colors">取消</button>
              <button onClick={handleSubmit}
                disabled={(needProject === 'required' && !projectId) || !applicant}
                className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-40">
                <Send className="w-3.5 h-3.5" />提交审批
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
