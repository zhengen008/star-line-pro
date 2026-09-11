import { Receipt, ShoppingCart, CreditCard, Landmark, Package, FileText, FileSignature, Stamp, FolderPlus, CheckSquare, FilePen, TrendingUp, TrendingDown, Minus, ListChecks } from 'lucide-react';

// Centralized approval type definitions for the Approval Center
export const APPROVAL_CATEGORIES = [
  {
    key: 'reimbursement',
    label: '报销申请',
    icon: Receipt,
    direction: '支出',
    needProject: 'optional',
    subTypes: ['日常垫付', '差旅报销', '项目垫付', '加班车费'],
    fields: [
      { key: 'sub_type', label: '报销类型', type: 'select', options: ['日常垫付', '差旅报销', '项目垫付', '加班车费'], required: true },
      { key: 'month', label: '报销月份', type: 'month', required: true },
      { key: 'amount', label: '报销金额', type: 'currency', required: true },
      { key: 'description', label: '报销说明', type: 'textarea' },
      { key: 'invoice_attachment', label: '发票附件', type: 'file' },
    ],
  },
  {
    key: 'purchase',
    label: '采购申请',
    icon: ShoppingCart,
    direction: '支出',
    needProject: 'optional',
    fields: [
      { key: 'items', label: '采购物品', type: 'text', required: true },
      { key: 'quantity', label: '数量', type: 'number', required: true },
      { key: 'unit_price', label: '单价 (¥)', type: 'currency' },
      { key: 'supplier', label: '供应商', type: 'text' },
      { key: 'amount', label: '总价 (¥)', type: 'currency', required: true },
    ],
  },
  {
    key: 'project_expense',
    label: '项目支出申请',
    icon: TrendingDown,
    direction: '支出',
    needProject: 'required',
    isGroup: true,
    children: [
      {
        key: 'project_payment',
        label: '付款申请',
        icon: CreditCard,
        direction: '支出',
        needProject: 'required',
        fields: [
          { key: 'amount', label: '付款金额 (¥)', type: 'currency', required: true },
          { key: 'payee', label: '付款对象', type: 'text', required: true },
          { key: 'reason', label: '付款事由', type: 'textarea', required: true },
        ],
      },
      {
        key: 'project_reserve',
        label: '备用金申请',
        icon: Landmark,
        direction: '支出',
        needProject: 'required',
        fields: [
          { key: 'amount', label: '申请金额 (¥)', type: 'currency', required: true },
          { key: 'usage', label: '用途说明', type: 'textarea', required: true },
          { key: 'return_date', label: '预计归还日', type: 'date' },
        ],
      },
      {
        key: 'project_purchase',
        label: '项目采购申请',
        icon: Package,
        direction: '支出',
        needProject: 'required',
        fields: [
          { key: 'items', label: '采购物品', type: 'text', required: true },
          { key: 'quantity', label: '数量', type: 'number' },
          { key: 'supplier', label: '供应商', type: 'text' },
          { key: 'amount', label: '总价 (¥)', type: 'currency', required: true },
        ],
      },
    ],
  },
  {
    key: 'invoice',
    label: '开票申请',
    icon: FileText,
    direction: '收入',
    needProject: 'required',
    needContract: true,
    fields: [
      { key: 'amount', label: '含税金额 (¥)', type: 'currency', required: true },
      { key: 'invoice_type', label: '发票类型', type: 'select', options: ['普票', '专票'], required: true },
      { key: 'payment_stage', label: '收款阶段', type: 'text', required: true },
      { key: 'customer_info', label: '客户信息', type: 'text' },
    ],
  },
  {
    key: 'contract',
    label: '合同审批',
    icon: FileSignature,
    direction: '无',
    needProject: 'select',
    fields: [
      { key: 'project_type', label: '项目类型', type: 'select', options: ['年框', '杜蕾', '策略', '公关', '专项', '其它'], required: true },
      { key: 'amount', label: '合同金额 (¥)', type: 'currency', required: true },
      { key: 'tax_rate', label: '税率%', type: 'select', options: ['1', '3', '6', '10', '12'], required: true },
      { key: 'start_date', label: '开始时间', type: 'date', required: true, group: '关键信息' },
      { key: 'end_date', label: '结束时间', type: 'date', required: true, group: '关键信息' },
      { key: 'contract_party', label: '合同类型', type: 'select', options: ['客户', '供应商'], required: true },
      { key: 'settlement', label: '结算方式', type: 'select', options: ['年度', '季度', '月度', '预付', '现结'], required: true },
      { key: 'contract_attachment', label: '合同附件', type: 'file' },
    ],
  },
  {
    key: 'seal',
    label: '用章申请',
    icon: Stamp,
    direction: '无',
    needProject: 'optional',
    fields: [
      { key: 'seal_type', label: '用章类型', type: 'select', options: ['公章', '合同章', '财务章', '法人章'], required: true },
      { key: 'reason', label: '用章事由', type: 'textarea', required: true },
      { key: 'copies', label: '用章份数', type: 'number', required: true },
    ],
  },
];

// 仅项目内发起、不在审批中心弹窗展示的审批类型（供详情/工作流 lookup）
export const PROJECT_ONLY_APPROVAL_TYPES = [
  { key: 'project_initiation', label: '项目立项', icon: FolderPlus, direction: '无' },
  { key: 'project_execution_content', label: '项目执行内容', icon: ListChecks, direction: '无' },
];

// Flatten all approval types (including children) for lookup
export function getAllApprovalTypes() {
  const result = [];
  APPROVAL_CATEGORIES.forEach(cat => {
    if (cat.isGroup && cat.children) {
      cat.children.forEach(child => result.push(child));
    } else if (!cat.isGroup) {
      result.push(cat);
    }
  });
  PROJECT_ONLY_APPROVAL_TYPES.forEach(t => result.push(t));
  return result;
}

// Find a specific type config by key
export function getApprovalTypeConfig(key) {
  return getAllApprovalTypes().find(t => t.key === key);
}

// All type labels for filter dropdown
export function getAllTypeLabels() {
  return getAllApprovalTypes().map(t => t.label);
}

export const STATUS_CONFIG = {
  '待审核': { color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-400' },
  '审核中': { color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-400' },
  '已通过': { color: 'bg-green-100 text-green-700', dot: 'bg-green-400' },
  '已拒绝': { color: 'bg-red-100 text-red-700', dot: 'bg-red-400' },
  '已付款': { color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-400' },
};