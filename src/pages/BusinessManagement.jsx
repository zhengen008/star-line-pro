import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { api, fileUrl } from '@/api/client';
import { Plus, X, Edit3, Trash2, Search, FileText, FolderKanban, ExternalLink } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import OssUpload from '../components/OssUpload';
import EmployeePicker from '../components/EmployeePicker';
import { useAuth } from '@/lib/AuthContext';

const BID_FORMS = ['公开竞标', '客户指定'];
const BID_STAGES = ['报名', '开标中', '竞标结束'];
const OPEN_FORMS = ['线上', '线下'];
const BID_RESULTS = ['弃标', '流标', '未中标', '中标'];
const PAYMENT_METHODS = ['月付', '季付', '半年付', '结束后支付'];

const RESULT_COLORS = {
  '弃标': 'bg-blue-100 text-blue-700',
  '流标': 'bg-gray-100 text-gray-600',
  '未中标': 'bg-red-100 text-red-700',
  '中标': 'bg-green-100 text-green-700',
};

const STAGE_COLORS = {
  '报名': 'bg-yellow-100 text-yellow-700',
  '开标中': 'bg-blue-100 text-blue-700',
  '竞标结束': 'bg-gray-100 text-gray-600',
};



function Modal({ bid, onClose, onSave }) {
  const parseFiles = (raw) => { try { return raw ? JSON.parse(raw) : []; } catch { return []; } };
  const [form, setForm] = useState(bid || {
    project_name: '', customer_name: '', bid_form: '公开竞标', bid_stage: '报名',
    project_type: '', signup_date: '', open_date: '', open_form: '线上', open_location: '',
    bid_amount: 0, deposit_amount: 0, manager: '', result: '弃标', payment_method: '月付', contract_files: '', proposal_files: '',
  });
  const [contractFiles, setContractFiles] = useState(parseFiles(bid?.contract_files));
  const [proposalFiles, setProposalFiles] = useState(parseFiles(bid?.proposal_files));
  const [uploading, setUploading] = useState(false);
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.12)] w-[580px] max-h-[90vh] flex flex-col animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-semibold">{bid ? '编辑竞标信息' : '新增竞标项目'}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-secondary rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">项目名称 *</label>
              <input value={form.project_name} onChange={e => f('project_name', e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-lime-400" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">客户名称</label>
              <input value={form.customer_name} onChange={e => f('customer_name', e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-lime-400" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">竞标形式</label>
              <select value={form.bid_form} onChange={e => f('bid_form', e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-lime-400 cursor-pointer">
                {BID_FORMS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">竞标阶段</label>
              <select value={form.bid_stage} onChange={e => f('bid_stage', e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-lime-400 cursor-pointer">
                {BID_STAGES.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">项目类型</label>
              <input value={form.project_type} onChange={e => f('project_type', e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-lime-400" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">报名时间</label>
              <input type="date" value={form.signup_date} onChange={e => f('signup_date', e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-lime-400" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">开标时间</label>
              <input type="date" value={form.open_date} onChange={e => f('open_date', e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-lime-400" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">开标形式</label>
              <select value={form.open_form} onChange={e => f('open_form', e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-lime-400 cursor-pointer">
                {OPEN_FORMS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">开标地点</label>
              <input value={form.open_location} onChange={e => f('open_location', e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-lime-400" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">投标金额 (¥)</label>
              <input type="number" value={form.bid_amount} onChange={e => f('bid_amount', +e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-lime-400" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">保证金金额 (¥)</label>
              <input type="number" value={form.deposit_amount || 0} onChange={e => f('deposit_amount', +e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-lime-400" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">结算方式</label>
              <select value={form.payment_method} onChange={e => f('payment_method', e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-lime-400 cursor-pointer">
                {PAYMENT_METHODS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">项目负责人</label>
              <EmployeePicker
                value={form.manager}
                onChange={v => f('manager', v)}
                placeholder="请选择负责人..."
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">是否中标</label>
              <select value={form.result} onChange={e => f('result', e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-secondary rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-lime-400 cursor-pointer">
                {BID_RESULTS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">方案文件</label>
              <div className="mt-1">
                <OssUpload
                  fileType="proposal"
                  value={proposalFiles}
                  onChange={setProposalFiles}
                  onUploadingChange={setUploading}
                  multiple
                  label="上传方案文件"
                />
              </div>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">合同文件</label>
              <div className="mt-1">
                <OssUpload
                  fileType="contract"
                  value={contractFiles}
                  onChange={setContractFiles}
                  onUploadingChange={setUploading}
                  multiple
                  label="上传合同文件"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="flex-1 py-2.5 bg-secondary rounded-xl text-sm hover:bg-border transition-colors">取消</button>
          <button onClick={() => { if (form.project_name) { onSave({ ...form, contract_files: JSON.stringify(contractFiles), proposal_files: JSON.stringify(proposalFiles) }); onClose(); } }}
            disabled={uploading || !form.project_name}
            className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
            {uploading ? '上传中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BusinessManagement() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('全部');
  const [modal, setModal] = useState(null); // null | 'create' | bid object

  const { can } = useAuth();
  const canCreate = can('商务管理', '创建');
  const canEdit = can('商务管理', '编辑');
  const canDelete = can('商务管理', '删除');

  const { data: bids = [], isLoading } = useQuery({
    queryKey: ['bids'],
    queryFn: () => api.entities.Bid.list('-created_date'),
  });

  // 反查：bid_id -> Project，用于显示「已关联项目」链接
  const { data: projects = [] } = useQuery({
    queryKey: ['projects-for-bid-link'],
    queryFn: () => api.entities.Project.list('-created_date'),
  });
  const projectByBidId = projects.reduce((acc, p) => {
    if (p.bid_id) acc[p.bid_id] = p;
    return acc;
  }, {});

  // 支持 URL ?id=xxx 深度链接，从项目详情跳转过来时高亮某条竞标
  const [searchParams, setSearchParams] = useSearchParams();
  const [highlightId, setHighlightId] = useState(null);
  const rowRefs = useRef({});
  useEffect(() => {
    const id = searchParams.get('id');
    if (id) {
      setHighlightId(id);
      setTimeout(() => {
        rowRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      searchParams.delete('id');
      setSearchParams(searchParams, { replace: true });
      setTimeout(() => setHighlightId(null), 3000);
    }
  }, []);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const created = await api.entities.Bid.create(data);
      // 中标后自动关联项目管理：创建「待立项」项目 + 通知负责人立项
      if (created.result === '中标') {
        try { await api.functions.invoke('ensurePendingProject', { bid_id: created.id }); } catch (e) { console.error('ensurePendingProject failed:', e); }
      }
      return created;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bids'] }); qc.invalidateQueries({ queryKey: ['projects'] }); qc.invalidateQueries({ queryKey: ['projects-for-bid-link'] }); setModal(null); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const updated = await api.entities.Bid.update(id, data);
      // 编辑为中标 / 已是中标：创建待立项或同步待立项项目商务字段
      if (updated.result === '中标') {
        try { await api.functions.invoke('ensurePendingProject', { bid_id: id }); } catch (e) { console.error('ensurePendingProject failed:', e); }
      }
      return updated;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bids'] }); qc.invalidateQueries({ queryKey: ['projects'] }); qc.invalidateQueries({ queryKey: ['projects-for-bid-link'] }); setModal(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.Bid.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bids'] }),
  });

  const handleSave = (form) => {
    if (modal === 'create') createMutation.mutate(form);
    else updateMutation.mutate({ id: modal.id, data: form });
  };

  const filtered = bids.filter(b => {
    const matchSearch = !search || b.project_name?.includes(search) || b.customer_name?.includes(search);
    const matchStage = stageFilter === '全部' || b.bid_stage === stageFilter;
    return matchSearch && matchStage;
  });

  const stats = [
    { label: '全部项目', value: bids.length, color: 'text-foreground' },
    { label: '报名中', value: bids.filter(b => b.bid_stage === '报名').length, color: 'text-yellow-600' },
    { label: '开标中', value: bids.filter(b => b.bid_stage === '开标中').length, color: 'text-blue-600' },
    { label: '已中标', value: bids.filter(b => b.result === '中标').length, color: 'text-green-600' },
  ];

  return (
    <div className="bg-white rounded-[2rem] shadow-sm border border-border/50 flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold text-lg">商务管理 · 竞标信息</h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="搜索项目/客户..." className="pl-9 pr-4 py-2 bg-white rounded-full text-xs border border-border/50 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary w-48 transition-shadow" />
            </div>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-[120px] h-9 bg-white rounded-full text-xs border border-border/50 shadow-sm focus:ring-primary">
                <SelectValue placeholder="全部阶段" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border/50 shadow-lg">
                {['全部', ...BID_STAGES].map(s => (
                  <SelectItem key={s} value={s} className="text-xs rounded-lg cursor-pointer">{s === '全部' ? '全部阶段' : s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canCreate && (
              <button onClick={() => setModal('create')}
                className="flex items-center gap-1.5 px-5 py-2 bg-primary text-white rounded-full text-xs font-medium hover:bg-primary/90 shadow-sm transition-colors">
                <Plus className="w-4 h-4" />新增项目
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-4">
          {stats.map(s => (
            <div key={s.label} className="flex items-center gap-2">
              <span className={`text-xl font-bold ${s.color}`}>{s.value}</span>
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">加载中...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary/50">
                {['项目名称', '客户', '竞标形式', '阶段', '开标时间', '投标金额', '结算方式', '负责人', '结果', '立项', '方案文件', '合同文件', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.id} ref={el => { if (el) rowRefs.current[b.id] = el; }}
                  className={`border-t border-border/40 hover:bg-secondary/20 transition-colors group ${highlightId === b.id ? 'bg-lime-50 animate-pulse' : ''}`}>
                  <td className="px-4 py-3 font-medium max-w-[160px] truncate whitespace-nowrap">{b.project_name}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs max-w-[120px] truncate whitespace-nowrap">{b.customer_name}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{b.bid_form}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STAGE_COLORS[b.bid_stage] || 'bg-gray-100 text-gray-600'}`}>{b.bid_stage}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{b.open_date || '-'}</td>
                  <td className="px-4 py-3 font-medium text-sm whitespace-nowrap">¥{((b.bid_amount || 0) / 10000).toFixed(0)}万</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{b.payment_method || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-lime-400 flex items-center justify-center text-xs font-semibold text-white">{b.manager?.[0] || '?'}</div>
                      <span className="text-xs">{b.manager || '-'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${RESULT_COLORS[b.result] || 'bg-gray-100 text-gray-600'}`}>{b.result}</span>
                  </td>
                  <td className="px-4 py-3">
                    {projectByBidId[b.id] ? (
                      <Link to={`/projects/${projectByBidId[b.id].id}`}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors max-w-[140px] ${
                          projectByBidId[b.id].status === '待立项'
                            ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                            : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                        }`}>
                        <FolderKanban className="w-3 h-3 shrink-0" />
                        <span className="truncate">{projectByBidId[b.id].status === '待立项' ? '待立项' : '已关联'}</span>
                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                      </Link>
                    ) : b.result === '中标' ? (
                      <span className="text-xs text-amber-600">待关联</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-2 py-3 w-[110px]">
                    {(() => {
                      let files = [];
                      try { files = b.proposal_files ? JSON.parse(b.proposal_files) : []; } catch {}
                      return files.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          {files.map((f, i) => (
                            <a key={i} href={fileUrl(f.url)} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-blue-600 hover:underline max-w-[95px] truncate">
                              <FileText className="w-3 h-3 shrink-0" />{f.name}
                            </a>
                          ))}
                        </div>
                      ) : <span className="text-xs text-muted-foreground">-</span>;
                    })()}
                  </td>
                  <td className="px-2 py-3 w-[110px]">
                    {(() => {
                      let files = [];
                      try { files = b.contract_files ? JSON.parse(b.contract_files) : []; } catch {}
                      return files.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          {files.map((f, i) => (
                            <a key={i} href={fileUrl(f.url)} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-blue-600 hover:underline max-w-[95px] truncate">
                              <FileText className="w-3 h-3 shrink-0" />{f.name}
                            </a>
                          ))}
                        </div>
                      ) : <span className="text-xs text-muted-foreground">-</span>;
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    {(canEdit || canDelete) && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {canEdit && (
                          <button onClick={() => setModal(b)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
                            <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => deleteMutation.mutate(b.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !isLoading && (
                <tr><td colSpan={13} className="px-4 py-10 text-center text-sm text-muted-foreground">暂无数据</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {modal && <Modal bid={modal === 'create' ? null : modal} onClose={() => setModal(null)} onSave={handleSave} />}
    </div>
  );
}