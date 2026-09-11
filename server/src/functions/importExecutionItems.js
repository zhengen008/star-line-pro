import prisma from '../lib/prisma.js';
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

function toNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[¥￥,\s]/g, ''));
  return isNaN(n) ? null : n;
}

function toString(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

// POST multipart: file, project_id (optional — 缺省为服务管理目录)
export async function importExecutionItems(req, res) {
  try {
    const projectId = req.body?.project_id || null;
    let project = null;

    if (projectId) {
      project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) return res.status(404).json({ error: 'Project not found' });
    }

    const file = req.file;
    if (!file) return res.status(400).json({ error: '请上传 Excel 文件' });

    let workbook;
    try {
      workbook = XLSX.read(file.buffer, { type: 'buffer' });
    } catch {
      return res.status(400).json({ error: 'Excel 文件解析失败，请上传 .xlsx 格式' });
    }
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return res.status(400).json({ error: 'Excel 文件为空' });

    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (rows.length === 0) return res.status(400).json({ error: 'Excel 中没有数据行' });

    const normalizedMap = Object.entries(COLUMN_MAP).reduce((acc, [k, v]) => {
      acc[k.trim()] = v;
      return acc;
    }, {});

    let created = 0;
    let skipped = 0;
    const userInfo = {
      created_by: req.user?.email || req.user?.name || null,
      created_by_id: req.user?.open_id || null,
    };

    for (const row of rows) {
      const field = {};
      for (const [colName, fieldKey] of Object.entries(normalizedMap)) {
        const value = row[colName] !== undefined ? row[colName] : row[colName.trim()];
        if (value === undefined || value === '') continue;
        if (['quantity', 'init_price', 'init_total', 'budget_price', 'budget_total'].includes(fieldKey)) {
          field[fieldKey] = toNumber(value);
        } else {
          field[fieldKey] = toString(value);
        }
      }

      const content = field.content || toString(row['内容']);
      if (!content) { skipped++; continue; }

      await prisma.executionItem.create({
        data: {
          project_id: projectId || null,
          seq_id: field.seq_id || null,
          project_name: field.project_name || project?.name || null,
          content,
          detail: field.detail || null,
          unit: field.unit || null,
          quantity: field.quantity,
          init_price: field.init_price,
          init_total: field.init_total,
          budget_price: field.budget_price,
          budget_total: field.budget_total,
          is_service_addon: true,
          ...userInfo,
        },
      });
      created++;
    }

    res.json({ ok: true, imported: created, skipped, total: rows.length, catalog: !projectId });
  } catch (error) {
    console.error('importExecutionItems error:', error);
    res.status(500).json({ error: error.message });
  }
}
