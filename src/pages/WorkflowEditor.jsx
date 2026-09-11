import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Plus, Trash2, GitBranch, CheckCircle2, User, AlertCircle, Play, Save, ZoomIn, ZoomOut, Link, Unlink, Copy, Receipt, ShoppingCart, CreditCard, Landmark, Package, FileText, FileSignature, Stamp, CheckSquare, FilePen, ListChecks, FolderPlus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EmployeePicker from '../components/EmployeePicker';
import { INIT_WORKFLOWS, buildStepsFromWorkflow, evaluateCondition } from '@/lib/workflowDefaults';
import { buildDeptHeadMap } from '@/lib/approvalResolver';

export const NODE_TYPES = {
  start: { label: '开始', color: 'bg-green-100 border-green-300 text-green-700', icon: Play },
  approval: { label: '审批节点', color: 'bg-blue-100 border-blue-300 text-blue-700', icon: User },
  condition: { label: '条件判断', color: 'bg-yellow-100 border-yellow-300 text-yellow-700', icon: GitBranch },
  notify: { label: '通知', color: 'bg-purple-100 border-purple-300 text-purple-700', icon: AlertCircle },
  cc: { label: '抄送节点', color: 'bg-pink-100 border-pink-300 text-pink-700', icon: Copy },
  end: { label: '结束', color: 'bg-gray-100 border-gray-300 text-gray-600', icon: CheckCircle2 },
};

// Synced with ApprovalTypeConfig approval types
export const APPROVAL_TYPES = [
  { key: 'reimbursement', label: '报销申请', icon: Receipt, fields: ['报销金额', '报销类型', '报销说明'] },
  { key: 'purchase', label: '采购申请', icon: ShoppingCart, fields: ['采购物品', '数量', '总价'] },
  { key: 'project_payment', label: '项目付款申请', icon: CreditCard, fields: ['付款金额', '付款对象', '付款事由'] },
  { key: 'project_reserve', label: '项目备用金', icon: Landmark, fields: ['申请金额', '用途说明', '预计归还日'] },
  { key: 'project_purchase', label: '项目采购', icon: Package, fields: ['采购物品', '数量', '总价'] },
  { key: 'invoice', label: '开票申请', icon: FileText, fields: ['含税金额', '发票类型', '收款阶段'] },
  { key: 'contract', label: '合同审批', icon: FileSignature, fields: ['合同金额', '项目类型', '合同类型'] },
  { key: 'seal', label: '用章申请', icon: Stamp, fields: ['用章类型', '用章事由', '用章份数'] },
  { key: 'project_initiation', label: '项目立项', icon: FolderPlus, fields: ['项目名称', '客户', '成本预算', '项目负责人'] },
  { key: 'project_complete', label: '项目完成', icon: CheckSquare, fields: ['项目名称', '客户'] },
  { key: 'project_change', label: '项目变更', icon: FilePen, fields: ['变更内容'] },
  { key: 'project_execution_content', label: '项目执行内容', icon: ListChecks, fields: ['Sheet名称', '条目摘要'] },
];

// Approver mode options
const APPROVER_MODES = [
  { value: 'applicant_dept_head', label: '申请人所在部门负责人' },
  { value: 'project_manager', label: '项目负责人' },
  { value: 'dept_head', label: '指定部门负责人' },
  { value: 'specific', label: '指定人员' },
];

export { evaluateCondition, buildStepsFromWorkflow, INIT_WORKFLOWS };

export default function WorkflowEditor() {
  const qc = useQueryClient();
  const [activeWorkflow, setActiveWorkflow] = useState(0);
  const [workflows, setWorkflows] = useState(INIT_WORKFLOWS);
  const [selectedNode, setSelectedNode] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved'

  // Load saved workflows from DB on mount
  const { data: savedWorkflows = [] } = useQuery({
    queryKey: ['workflow-templates'],
    queryFn: () => api.entities.WorkflowTemplate.list('-created_date'),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.entities.Department.list('-created_date'),
  });

  const activeDepartments = departments.filter((d) => d.status !== '停用');
  const deptHeadMap = buildDeptHeadMap(activeDepartments);

  useEffect(() => {
    if (savedWorkflows.length === 0) return;
    setWorkflows(prev => prev.map(wf => {
      const saved = savedWorkflows.find(s => s.name === wf.name || s.approval_type === wf.approvalType);
      if (!saved) return wf;
      try {
        return {
          ...wf,
          dbId: saved.id,
          nodes: JSON.parse(saved.nodes || '[]').length > 0 ? JSON.parse(saved.nodes) : wf.nodes,
          connections: JSON.parse(saved.connections || '[]').length > 0 ? JSON.parse(saved.connections) : wf.connections,
        };
      } catch { return wf; }
    }));
  }, [savedWorkflows]);

  const saveMutation = useMutation({
    mutationFn: async (wf) => {
      const payload = {
        name: wf.name,
        approval_type: wf.approvalType,
        nodes: JSON.stringify(wf.nodes),
        connections: JSON.stringify(wf.connections),
        status: '已发布',
      };
      if (wf.dbId) {
        return api.entities.WorkflowTemplate.update(wf.dbId, payload);
      } else {
        return api.entities.WorkflowTemplate.create(payload);
      }
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['workflow-templates'] });
      // Update local dbId
      setWorkflows(prev => prev.map((w, i) => i === activeWorkflow ? { ...w, dbId: result.id } : w));
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2000);
    },
  });
  const [dragging, setDragging] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.85);
  const [connectMode, setConnectMode] = useState(false);
  const [connectFrom, setConnectFrom] = useState(null);
  const canvasRef = useRef(null);

  const wf = workflows[activeWorkflow];
  const updateWf = (updater) => setWorkflows(prev => prev.map((w, i) => i !== activeWorkflow ? w : updater(w)));

  const onMouseDown = useCallback((e, nodeId) => {
    if (connectMode) return;
    e.stopPropagation();
    const node = wf.nodes.find(n => n.id === nodeId);
    const rect = canvasRef.current.getBoundingClientRect();
    setDragging(nodeId);
    setDragOffset({ x: e.clientX / zoom - rect.left / zoom - node.x, y: e.clientY / zoom - rect.top / zoom - node.y });
    setSelectedNode(nodeId);
  }, [wf, zoom, connectMode]);

  const onMouseMove = useCallback((e) => {
    if (!dragging) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(20, e.clientX / zoom - rect.left / zoom - dragOffset.x);
    const y = Math.max(20, e.clientY / zoom - rect.top / zoom - dragOffset.y);
    updateWf(w => ({ ...w, nodes: w.nodes.map(n => n.id === dragging ? { ...n, x, y } : n) }));
  }, [dragging, dragOffset, zoom]);

  const onMouseUp = useCallback(() => setDragging(null), []);

  const handleNodeClick = (e, nodeId) => {
    e.stopPropagation();
    if (connectMode) {
      if (!connectFrom) { setConnectFrom(nodeId); }
      else if (connectFrom !== nodeId) {
        const exists = wf.connections.some(c => c.from === connectFrom && c.to === nodeId);
        if (!exists) updateWf(w => ({ ...w, connections: [...w.connections, { id: `c${Date.now()}`, from: connectFrom, to: nodeId, label: '' }] }));
        setConnectFrom(null);
      }
    } else { setSelectedNode(nodeId); }
  };

  const addNode = (type) => {
    const id = `n${Date.now()}`;
    updateWf(w => ({ ...w, nodes: [...w.nodes, { id, type, x: 150 + Math.random() * 200, y: 120 + Math.random() * 100, label: NODE_TYPES[type].label, config: {} }] }));
  };

  const deleteNode = (nodeId) => {
    updateWf(w => ({ ...w, nodes: w.nodes.filter(n => n.id !== nodeId), connections: w.connections.filter(c => c.from !== nodeId && c.to !== nodeId) }));
    setSelectedNode(null);
  };

  const deleteConnection = (connId) => updateWf(w => ({ ...w, connections: w.connections.filter(c => c.id !== connId) }));
  const updateNodeField = (nid, field, value) => updateWf(w => ({ ...w, nodes: w.nodes.map(n => n.id === nid ? { ...n, [field]: value } : n) }));
  const updateNodeConfig = (nid, key, value) => updateWf(w => ({ ...w, nodes: w.nodes.map(n => n.id === nid ? { ...n, config: { ...n.config, [key]: value } } : n) }));

  const handleApproverModeChange = (nid, mode) => {
    const config = { approverMode: mode };
    if (mode === 'applicant_dept_head') config.approver = '申请人所在部门负责人';
    else if (mode === 'project_manager') config.approver = '项目负责人';
    else if (mode === 'dept_head') {
      const firstDept = activeDepartments[0]?.name || '';
      config.dept = firstDept;
      config.approver = deptHeadMap[firstDept] || '';
    } else config.approver = '';
    updateWf(w => ({ ...w, nodes: w.nodes.map(n => n.id === nid ? { ...n, config: { ...n.config, ...config } } : n) }));
  };

  const getCenter = (nodeId) => {
    const node = wf.nodes.find(n => n.id === nodeId);
    return node ? { x: node.x + 90, y: node.y + 28 } : { x: 0, y: 0 };
  };

  const selNode = selectedNode ? wf.nodes.find(n => n.id === selectedNode) : null;
  const typeObj = APPROVAL_TYPES.find(t => t.key === wf.approvalType);

  const conditionPreview = selNode?.type === 'condition' ? (() => {
    const sampleFields = typeObj?.fields?.reduce((acc, f) => {
      acc[f] = f.includes('金额') || f.includes('总价') ? '6000' : '示例';
      return acc;
    }, {}) || {};
    return evaluateCondition(selNode.config.condition, sampleFields);
  })() : null;

  return (
    <div className="bg-white rounded-[2rem] shadow-sm border border-border/50 flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <h2 className="font-semibold text-lg shrink-0">审批流程编辑器</h2>
          <div className="flex-1 max-w-[260px]">
            <Select value={activeWorkflow.toString()} onValueChange={(v) => { setActiveWorkflow(parseInt(v)); setSelectedNode(null); setConnectFrom(null); }}>
              <SelectTrigger className="w-full bg-white rounded-full border-border/50 shadow-sm font-medium text-sm h-10 hover:border-primary transition-colors focus:ring-primary">
                <div className="flex items-center gap-2">
                  {(() => {
                     const wfItem = workflows[activeWorkflow];
                     const tItem = APPROVAL_TYPES.find(a => a.key === wfItem?.approvalType);
                     const Icon = tItem?.icon || FileText;
                     return <><Icon className="w-4 h-4 text-primary" /> <span>{wfItem?.name}</span></>;
                  })()}
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-border/50 shadow-xl max-h-[400px]">
                {workflows.map((w, i) => {
                  const t = APPROVAL_TYPES.find(a => a.key === w.approvalType);
                  const Icon = t?.icon || FileText;
                  return (
                    <SelectItem key={i} value={i.toString()} className="text-sm rounded-xl cursor-pointer py-2">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-muted-foreground" /> {w.name}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setConnectMode(v => !v); setConnectFrom(null); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium transition-colors border shadow-sm ${connectMode ? 'bg-primary text-white border-primary' : 'bg-white border-border/50 text-muted-foreground hover:border-border hover:bg-secondary/50'}`}>
            <Link className="w-3.5 h-3.5" />{connectMode ? (connectFrom ? '选目标...' : '点源节点') : '连线'}
          </button>
          <button onClick={() => setZoom(z => Math.max(0.4, z - 0.1))} className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center hover:bg-border transition-colors">
            <ZoomOut className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center hover:bg-border transition-colors">
            <ZoomIn className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button
            onClick={() => { setSaveStatus('saving'); saveMutation.mutate(wf); }}
            disabled={saveStatus === 'saving'}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-full text-xs font-medium hover:bg-primary/90 shadow-sm transition-colors disabled:opacity-60">
            <Save className="w-3.5 h-3.5" />
            {saveStatus === 'saving' ? '保存中...' : saveStatus === 'saved' ? '✓ 已保存' : '保存'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Toolbox */}
        <div className="w-44 border-r border-border p-3 flex flex-col gap-2 shrink-0 overflow-auto">
          <div className="flex items-center gap-2 px-1 mb-1">
            {typeObj?.icon && <typeObj.icon className="w-4 h-4 text-primary" />}
            <span className="text-xs font-medium text-foreground">{typeObj?.label}</span>
          </div>
          <p className="text-xs text-muted-foreground px-1 -mt-1 mb-1">对应审批类型</p>
          <div className="border-t border-border pt-2">
            <p className="text-xs font-medium text-muted-foreground px-1 mb-2">添加节点</p>
            {Object.entries(NODE_TYPES).map(([type, cfg]) => (
              <button key={type} onClick={() => addNode(type)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all hover:scale-105 active:scale-95 mb-1.5 ${cfg.color}`}>
                <cfg.icon className="w-3.5 h-3.5 shrink-0" />{cfg.label}<Plus className="w-3 h-3 ml-auto opacity-60" />
              </button>
            ))}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative overflow-hidden bg-secondary/20">
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
            <defs><pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#94a3b8" strokeWidth="0.5" />
            </pattern></defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
          <div ref={canvasRef} className="absolute inset-0"
            onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
            onClick={() => setSelectedNode(null)}
            style={{ cursor: dragging ? 'grabbing' : connectMode ? 'crosshair' : 'default' }}>
            <div style={{ transform: `scale(${zoom})`, transformOrigin: '0 0', position: 'absolute', inset: 0 }}>
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
                <defs>
                  <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" />
                  </marker>
                </defs>
                {wf.connections.map(conn => {
                  const from = getCenter(conn.from);
                  const to = getCenter(conn.to);
                  const mx = (from.x + to.x) / 2;
                  return (
                    <g key={conn.id}>
                      <path d={`M ${from.x} ${from.y} C ${mx} ${from.y} ${mx} ${to.y} ${to.x} ${to.y}`}
                        fill="none" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrow)" />
                      {conn.label && <text x={mx} y={(from.y + to.y) / 2 - 5} textAnchor="middle" fontSize="10" fill="#94a3b8">{conn.label}</text>}
                    </g>
                  );
                })}
              </svg>
              {wf.nodes.map(node => {
                const cfg = NODE_TYPES[node.type];
                const isSelected = selectedNode === node.id;
                const isConnectFrom = connectFrom === node.id;
                return (
                  <div key={node.id}
                    className={`workflow-node absolute rounded-2xl border-2 px-4 py-3 min-w-44 max-w-52 transition-all ${cfg.color} ${isConnectFrom ? 'shadow-lg shadow-orange-400/60 border-orange-400 scale-105' : isSelected ? 'shadow-lg shadow-lime-400/40 border-lime-400' : 'hover:shadow-md'}`}
                    style={{ left: node.x, top: node.y }}
                    onMouseDown={e => onMouseDown(e, node.id)}
                    onClick={e => handleNodeClick(e, node.id)}>
                    <div className="flex items-center gap-2">
                      <cfg.icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-xs font-semibold leading-tight">{node.label}</span>
                    </div>
                    {node.config.approver && <p className="text-xs opacity-60 mt-1 truncate">👤 {node.config.approver}</p>}
                    {node.config.condition && <p className="text-xs opacity-60 mt-1">⚡ {node.config.condition}</p>}
                    {node.config.channel && <p className="text-xs opacity-60 mt-1">📢 {node.config.channel}</p>}
                    {node.config.ccList?.length > 0 && <p className="text-xs opacity-60 mt-1 truncate">📋 {node.config.ccList.join(', ')}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Properties */}
        {selNode && (
          <div className="w-60 border-l border-border p-4 flex flex-col gap-3 shrink-0 animate-fade-in overflow-auto">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">节点属性</p>
              <button onClick={() => deleteNode(selNode.id)} className="p-1 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className={`px-3 py-2 rounded-xl text-xs font-medium border ${NODE_TYPES[selNode.type].color} flex items-center gap-1.5`}>
              {(() => { const Icon = NODE_TYPES[selNode.type].icon; return <Icon className="w-3.5 h-3.5" />; })()}
              {NODE_TYPES[selNode.type].label}
            </div>
            <div className="space-y-2.5">
              <div>
                <label className="text-xs text-muted-foreground">节点名称</label>
                <input value={selNode.label} onChange={e => updateNodeField(selNode.id, 'label', e.target.value)}
                  className="mt-1 w-full px-2.5 py-1.5 bg-secondary rounded-lg text-xs border-0 focus:outline-none focus:ring-2 focus:ring-lime-400" />
              </div>

              {selNode.type === 'approval' && (<>
                <div>
                  <label className="text-xs text-muted-foreground">审批人模式</label>
                  <Select value={selNode.config.approverMode || 'applicant_dept_head'} onValueChange={v => handleApproverModeChange(selNode.id, v)}>
                    <SelectTrigger className="mt-1 w-full bg-secondary rounded-xl text-xs border-0 focus:ring-primary h-8">
                      <SelectValue placeholder="审批人模式" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border/50 shadow-lg">
                      {APPROVER_MODES.map(m => <SelectItem key={m.value} value={m.value} className="text-xs rounded-lg cursor-pointer">{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {selNode.config.approverMode === 'applicant_dept_head' && (
                  <div className="p-2 bg-blue-50 rounded-lg text-xs text-blue-700">
                    <p className="font-medium">自动匹配申请人所在部门负责人</p>
                    <p className="mt-0.5 text-blue-500">若申请人本身是部门负责人，则自动跳过此节点</p>
                  </div>
                )}
                {selNode.config.approverMode === 'project_manager' && (
                  <div className="p-2 bg-green-50 rounded-lg text-xs text-green-700">
                    <p className="font-medium">自动匹配关联项目的负责人</p>
                    <p className="mt-0.5 text-green-500">若申请人本身是项目负责人，则自动跳过此节点</p>
                  </div>
                )}
                {selNode.config.approverMode === 'dept_head' && (
                  <div>
                    <label className="text-xs text-muted-foreground">选择部门</label>
                    <Select value={selNode.config.dept || ''} onValueChange={v => {
                      updateWf(w => ({ ...w, nodes: w.nodes.map(n => n.id === selNode.id ? { ...n, config: { ...n.config, dept: v, approver: deptHeadMap[v] || '' } } : n) }));
                    }}>
                      <SelectTrigger className="mt-1 w-full bg-secondary rounded-xl text-xs border-0 focus:ring-primary h-8">
                        <SelectValue placeholder="选择部门..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border/50 shadow-lg max-h-60">
                        {activeDepartments.map(d => <SelectItem key={d.id || d.name} value={d.name} className="text-xs rounded-lg cursor-pointer">{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {selNode.config.dept && (
                      <p className="text-xs text-muted-foreground mt-1">
                        负责人: <span className="font-medium text-foreground">{deptHeadMap[selNode.config.dept] || '未设置'}</span>
                      </p>
                    )}
                    {activeDepartments.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">请先在部门管理中添加部门并设置负责人</p>
                    )}
                  </div>
                )}
                {selNode.config.approverMode === 'specific' && (
                  <div>
                    <label className="text-xs text-muted-foreground">指定人员</label>
                    <EmployeePicker
                      value={selNode.config.approver || ''}
                      onChange={v => updateNodeConfig(selNode.id, 'approver', v)}
                      placeholder="选择审批人..."
                      className="mt-1"
                    />
                  </div>
                )}
              </>)}

              {selNode.type === 'condition' && (
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-muted-foreground">条件表达式</label>
                    <input value={selNode.config.condition || ''} onChange={e => updateNodeConfig(selNode.id, 'condition', e.target.value)}
                      className="mt-1 w-full px-2.5 py-1.5 bg-secondary rounded-lg text-xs border-0 focus:outline-none focus:ring-2 focus:ring-lime-400" placeholder="例：报销金额 > 5000" />
                    <p className="text-xs text-muted-foreground mt-1">支持：字段名 {'>'} {'<'} {'>='} {'<='} == 数值</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">满足时标签</label>
                      <input value={selNode.config.trueLabel || ''} onChange={e => updateNodeConfig(selNode.id, 'trueLabel', e.target.value)}
                        className="mt-1 w-full px-2.5 py-1.5 bg-secondary rounded-lg text-xs border-0 focus:outline-none focus:ring-2 focus:ring-lime-400" placeholder="> 5000" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">不满足标签</label>
                      <input value={selNode.config.falseLabel || ''} onChange={e => updateNodeConfig(selNode.id, 'falseLabel', e.target.value)}
                        className="mt-1 w-full px-2.5 py-1.5 bg-secondary rounded-lg text-xs border-0 focus:outline-none focus:ring-2 focus:ring-lime-400" placeholder="≤ 5000" />
                    </div>
                  </div>
                  {conditionPreview && typeObj && (
                    <div className={`p-2 rounded-lg text-xs ${conditionPreview.matched ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
                      <p className="font-medium">模拟预览（{typeObj.fields[0]}=6000）</p>
                      <p>{conditionPreview.matched ? `✓ 满足 → ${selNode.config.trueLabel}` : `✗ 不满足 → ${selNode.config.falseLabel}`}</p>
                    </div>
                  )}
                </div>
              )}

              {selNode.type === 'notify' && (
                <div>
                  <label className="text-xs text-muted-foreground">通知渠道</label>
                  <Select value={selNode.config.channel || '邮件'} onValueChange={v => updateNodeConfig(selNode.id, 'channel', v)}>
                    <SelectTrigger className="mt-1 w-full bg-secondary rounded-xl text-xs border-0 focus:ring-primary h-8">
                      <SelectValue placeholder="通知渠道" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border/50 shadow-lg">
                      {['邮件', '短信', '短信+邮件', '系统通知', '邮件+系统通知'].map(c => <SelectItem key={c} value={c} className="text-xs rounded-lg cursor-pointer">{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selNode.type === 'cc' && (
                <div>
                  <label className="text-xs text-muted-foreground">抄送人员</label>
                  <EmployeePicker
                    value={selNode.config.ccList || []}
                    onChange={v => updateNodeConfig(selNode.id, 'ccList', v)}
                    multiple
                    placeholder="+ 添加抄送人员..."
                    className="mt-1"
                  />
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">连接关系</p>
              {wf.connections.filter(c => c.from === selNode.id || c.to === selNode.id).map(conn => {
                const isOut = conn.from === selNode.id;
                const other = wf.nodes.find(n => n.id === (isOut ? conn.to : conn.from));
                return (
                  <div key={conn.id} className="flex items-center justify-between py-0.5">
                    <span className="text-xs text-muted-foreground truncate">{isOut ? '→' : '←'} {other?.label} {conn.label && `(${conn.label})`}</span>
                    <button onClick={() => deleteConnection(conn.id)} className="p-0.5 hover:text-red-400 text-muted-foreground ml-1 shrink-0">
                      <Unlink className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}