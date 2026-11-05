import XLSX from 'xlsx';

const COLUMN_MAP = {
  '序号ID': 'seq_id',
  '序号': 'seq_id',
  '项目名称': 'project_name',
  '内容': 'content',
  '详细说明': 'detail',
  '单位': 'unit',
  '数量': 'quantity',
  '立项金额单价（含税）': 'init_price',
  '立项金额总价（含税）': 'init_total',
  '预算金额单价（含税）': 'budget_price',
  '预算金额总价（含税）': 'budget_total',
};

const NUMBER_FIELDS = ['quantity', 'init_price', 'init_total', 'budget_price', 'budget_total'];
const TEXT_FIELDS = ['seq_id', 'project_name', 'content', 'detail', 'unit'];

function toNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[¥￥,\s]/g, ''));
  return isNaN(n) ? null : n;
}

function toText(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

/**
 * 解析执行内容 Excel（首个工作表）。
 * @returns {{ rows: object[], skipped: number, total: number }}
 */
export function parseExecutionRows(buffer) {
  let workbook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' });
  } catch {
    throw new Error('Excel 文件解析失败，请上传 .xlsx 格式');
  }
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('Excel 文件为空');

  const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (raw.length === 0) throw new Error('Excel 中没有数据行');

  const rows = [];
  let skipped = 0;
  for (const r of raw) {
    const field = {};
    for (const [colName, key] of Object.entries(COLUMN_MAP)) {
      const value = r[colName];
      if (value === undefined || value === '') continue;
      field[key] = NUMBER_FIELDS.includes(key) ? toNumber(value) : toText(value);
    }
    if (!field.content) { skipped++; continue; }
    const row = {};
    TEXT_FIELDS.forEach((k) => { row[k] = field[k] || null; });
    NUMBER_FIELDS.forEach((k) => { row[k] = field[k] ?? null; });
    row.content = field.content;
    rows.push(row);
  }
  return { rows, skipped, total: raw.length };
}
