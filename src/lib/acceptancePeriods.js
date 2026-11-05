/**
 * 验收期次：按结算方式把项目起止区间切成自然月 / 季 / 半年 / 年，或整期一次验收。
 * 纯函数，无外部依赖（供 node --test 直接加载）。
 */

const CYCLE_MONTHS = { month: 1, quarter: 3, half: 6, year: 12 };

export function resolveAcceptanceCycle(paymentMethod) {
  const m = String(paymentMethod || '');
  if (m.includes('半年')) return 'half';
  if (m.includes('月')) return 'month';
  if (m.includes('季')) return 'quarter';
  if (m.includes('年')) return 'year';
  return 'once';
}

function parseDate(s) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  if (!match) return null;
  return { y: +match[1], m: +match[2], d: +match[3] };
}

const pad = (n) => String(n).padStart(2, '0');
const fmt = ({ y, m, d }) => `${y}-${pad(m)}-${pad(d)}`;
const toKey = ({ y, m, d }) => y * 10000 + m * 100 + d;
const lastDayOfMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

function labelFor(cycle, y, startMonth) {
  if (cycle === 'month') return `${y}年${startMonth}月`;
  if (cycle === 'quarter') return `${y} Q${(startMonth - 1) / 3 + 1}`;
  if (cycle === 'half') return `${y}${startMonth === 1 ? '上' : '下'}半年`;
  return `${y}年度`;
}

function splitAmount(total, n) {
  const cents = Math.round((Number(total) || 0) * 100);
  const base = Math.floor(cents / n);
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? cents - base * (n - 1) : base) / 100);
}

export function buildAcceptancePeriods({ startDate, endDate, paymentMethod, contractAmount } = {}) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end || toKey(end) < toKey(start)) return [];

  const cycle = resolveAcceptanceCycle(paymentMethod);
  const ranges = [];

  if (cycle === 'once') {
    ranges.push({ label: '全周期', from: start, to: end });
  } else {
    const len = CYCLE_MONTHS[cycle];
    let y = start.y;
    let blockStart = Math.floor((start.m - 1) / len) * len + 1;
    let from = start;
    while (true) {
      const blockEndMonth = blockStart + len - 1;
      const blockEnd = { y, m: blockEndMonth, d: lastDayOfMonth(y, blockEndMonth) };
      const to = toKey(blockEnd) < toKey(end) ? blockEnd : end;
      ranges.push({ label: labelFor(cycle, y, blockStart), from, to });
      if (to === end) break;
      blockStart += len;
      if (blockStart > 12) { blockStart = 1; y += 1; }
      from = { y, m: blockStart, d: 1 };
    }
  }

  const amounts = splitAmount(contractAmount, ranges.length);
  return ranges.map((r, i) => ({
    seq: i + 1,
    period_label: r.label,
    period_start: fmt(r.from),
    period_end: fmt(r.to),
    planned_amount: amounts[i],
  }));
}

const num = (v) => Number(v) || 0;
const round2 = (v) => Math.round(v * 100) / 100;

export function summarizeAcceptances(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  const accepted = list.filter((r) => r.status === '已验收');
  const acceptedAmount = round2(accepted.reduce((s, r) => s + num(r.accepted_amount), 0));
  const invoicedAmount = round2(list.filter((r) => r.invoice_status === '已开票').reduce((s, r) => s + num(r.invoice_amount), 0));
  const receivedAmount = round2(list.reduce((s, r) => s + num(r.received_amount), 0));
  return {
    totalPeriods: list.length,
    acceptedPeriods: accepted.length,
    acceptedAmount,
    invoicedAmount,
    uninvoicedAcceptedAmount: Math.max(0, round2(acceptedAmount - invoicedAmount)),
    receivedAmount,
    unreceivedAmount: Math.max(0, round2(acceptedAmount - receivedAmount)),
  };
}
