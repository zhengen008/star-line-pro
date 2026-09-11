import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import prisma from './lib/prisma.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_DIR = join(__dirname, '..', '..', 'database', 'Datasheet Reference');

const MODEL_MAP = {
  'Employee': 'employee',
  'Department': 'department',
  'Role': 'role',
  'Bid': 'bid',
  'Project': 'project',
  'ProjectLog': 'projectLog',
  'Approval': 'approval',
  'ProjectApproval': 'projectApproval',
  'WorkflowTemplate': 'workflowTemplate',
  'Notice': 'notice',
  'Notification': 'notification',
  'Banner': 'banner',
  'CheckIn': 'checkIn',
};

const DATE_FIELDS = ['created_date', 'updated_date', 'deleted_at'];
const BOOL_FIELDS = ['is_pinned', 'is_deleted', 'is_read', 'is_archived', 'feishu_sent', 'is_system'];
const INT_FIELDS = ['member_count', 'sort_order', 'order'];
const DECIMAL_FIELDS = ['base_salary', 'bid_amount', 'deposit_amount', 'contract_amount',
  'budget_cost', 'remaining_budget', 'amount'];
const ARRAY_FIELDS = ['members', 'read_by', 'cc_list'];

function parseCSV(content) {
  const rows = [];
  let row = [];
  let field = '';
  let inQ = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1];
    if (inQ) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') { inQ = false; }
      else { field += ch; }
    } else {
      if (ch === '"') { inQ = true; }
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        row.push(field); field = '';
        if (row.length > 0 && row.some(c => c !== '')) rows.push(row);
        row = [];
        if (ch === '\r') i++;
      } else if (ch === '\r') {
        row.push(field); field = '';
        if (row.length > 0 && row.some(c => c !== '')) rows.push(row);
        row = [];
      } else { field += ch; }
    }
  }
  if (field || row.length > 0) {
    row.push(field);
    if (row.length > 0 && row.some(c => c !== '')) rows.push(row);
  }
  return rows;
}

function toDate(val) {
  if (!val) return null;
  const cleaned = val.replace(/(\.\d{3})\d*/, '$1') + 'Z';
  const d = new Date(cleaned);
  return isNaN(d.getTime()) ? null : d;
}

function parseValue(value, fieldName) {
  if (value === '' || value === undefined || value === null) return null;
  if (DATE_FIELDS.includes(fieldName)) return toDate(value);
  if (BOOL_FIELDS.includes(fieldName)) return value === 'true' || value === true;
  if (INT_FIELDS.includes(fieldName)) { const n = parseInt(value); return isNaN(n) ? null : n; }
  if (DECIMAL_FIELDS.includes(fieldName)) { const n = parseFloat(value); return isNaN(n) ? null : n; }
  if (ARRAY_FIELDS.includes(fieldName)) {
    try { const p = JSON.parse(value); return Array.isArray(p) ? p : [value]; }
    catch { return value.split(',').map(s => s.trim().replace(/^"|"$/g, '')); }
  }
  return value;
}

async function main() {
  // Exact filename order ensures parents import before children
  const FILE_ORDER = [
    'Employee_export.csv', 'Department_export.csv', 'Role_export.csv',
    'Bid_export.csv', 'Project_export.csv', 'ProjectLog_export.csv',
    'Approval_export.csv', 'ProjectApproval_export.csv',
    'WorkflowTemplate_export.csv', 'Notice_export.csv',
    'Notification_export.csv', 'Banner_export.csv', 'CheckIn_export.csv',
  ];
  const files = readdirSync(CSV_DIR).filter(f => f.endsWith('_export.csv'));
  files.sort((a, b) => FILE_ORDER.indexOf(a) - FILE_ORDER.indexOf(b));
  console.log('Import order:', files.map(f => f.replace('_export.csv', '')).join(' → '), '\n');

  let total = 0, errors = 0;

  for (const file of files) {
    const prefix = file.replace('_export.csv', '');
    const model = MODEL_MAP[prefix];
    if (!model) { console.log(`  Skip: ${file}`); continue; }

    const content = readFileSync(join(CSV_DIR, file), 'utf-8');
    const rows = parseCSV(content);
    if (rows.length < 2) { console.log(`  Empty: ${file}`); continue; }

    const headers = rows[0];
    let inserted = 0, errs = 0;

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const data = {};
      for (let i = 0; i < headers.length; i++) {
        if (headers[i] === 'is_sample') continue;
        data[headers[i]] = parseValue(row[i] ?? '', headers[i]);
      }
      try {
        await prisma[model].create({ data });
        inserted++;
      } catch (e) {
        // Retry with bid_id cleared for FK issues
        if (e.message?.includes('Foreign key') && data.bid_id) {
          try {
            delete data.bid_id;
            await prisma[model].create({ data });
            inserted++;
            continue;
          } catch {}
        }
        // Skip ProjectLog rows with missing project FK
        if (model === 'projectLog' && e.message?.includes('Foreign key')) {
          errs++;
          continue;
        }
        errs++;
        if (errs <= 2) console.log(`  ${prefix} row ${r} error: ${e.message.slice(0, 150)}`);
      }
    }

    console.log(`  ${prefix}: ${inserted} rows${errs > 0 ? ` (${errs} errors)` : ''}`);
    total += inserted;
    errors += errs;
  }

  console.log(`\nDone. ${total} rows imported, ${errors} errors.`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
