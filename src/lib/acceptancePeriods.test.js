import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveAcceptanceCycle,
  buildAcceptancePeriods,
  summarizeAcceptances,
} from './acceptancePeriods.js';

describe('resolveAcceptanceCycle', () => {
  it('maps settlement methods to cycles', () => {
    assert.equal(resolveAcceptanceCycle('月付'), 'month');
    assert.equal(resolveAcceptanceCycle('月结'), 'month');
    assert.equal(resolveAcceptanceCycle('月度'), 'month');
    assert.equal(resolveAcceptanceCycle('季付'), 'quarter');
    assert.equal(resolveAcceptanceCycle('季度'), 'quarter');
    assert.equal(resolveAcceptanceCycle('半年付'), 'half');
    assert.equal(resolveAcceptanceCycle('年付'), 'year');
    assert.equal(resolveAcceptanceCycle('年度'), 'year');
    assert.equal(resolveAcceptanceCycle('结束后支付'), 'once');
    assert.equal(resolveAcceptanceCycle('里程碑付款'), 'once');
    assert.equal(resolveAcceptanceCycle(''), 'once');
    assert.equal(resolveAcceptanceCycle(undefined), 'once');
  });
});

describe('buildAcceptancePeriods', () => {
  it('splits monthly across years and clips first/last period', () => {
    const rows = buildAcceptancePeriods({
      startDate: '2026-11-15', endDate: '2027-01-10', paymentMethod: '月付', contractAmount: 300,
    });
    assert.deepEqual(rows, [
      { seq: 1, period_label: '2026年11月', period_start: '2026-11-15', period_end: '2026-11-30', planned_amount: 100 },
      { seq: 2, period_label: '2026年12月', period_start: '2026-12-01', period_end: '2026-12-31', planned_amount: 100 },
      { seq: 3, period_label: '2027年1月', period_start: '2027-01-01', period_end: '2027-01-10', planned_amount: 100 },
    ]);
  });

  it('splits by calendar quarter', () => {
    const rows = buildAcceptancePeriods({
      startDate: '2026-02-01', endDate: '2026-12-31', paymentMethod: '季付', contractAmount: 0,
    });
    assert.deepEqual(rows.map((r) => [r.period_label, r.period_start, r.period_end]), [
      ['2026 Q1', '2026-02-01', '2026-03-31'],
      ['2026 Q2', '2026-04-01', '2026-06-30'],
      ['2026 Q3', '2026-07-01', '2026-09-30'],
      ['2026 Q4', '2026-10-01', '2026-12-31'],
    ]);
  });

  it('splits by half year', () => {
    const rows = buildAcceptancePeriods({
      startDate: '2026-03-01', endDate: '2027-02-28', paymentMethod: '半年付', contractAmount: 0,
    });
    assert.deepEqual(rows.map((r) => [r.period_label, r.period_start, r.period_end]), [
      ['2026上半年', '2026-03-01', '2026-06-30'],
      ['2026下半年', '2026-07-01', '2026-12-31'],
      ['2027上半年', '2027-01-01', '2027-02-28'],
    ]);
  });

  it('splits by year', () => {
    const rows = buildAcceptancePeriods({
      startDate: '2026-06-01', endDate: '2027-05-31', paymentMethod: '年付', contractAmount: 0,
    });
    assert.deepEqual(rows.map((r) => [r.period_label, r.period_start, r.period_end]), [
      ['2026年度', '2026-06-01', '2026-12-31'],
      ['2027年度', '2027-01-01', '2027-05-31'],
    ]);
  });

  it('uses a single period for one-off settlement', () => {
    const rows = buildAcceptancePeriods({
      startDate: '2026-01-01', endDate: '2026-12-31', paymentMethod: '结束后支付', contractAmount: 5000,
    });
    assert.deepEqual(rows, [
      { seq: 1, period_label: '全周期', period_start: '2026-01-01', period_end: '2026-12-31', planned_amount: 5000 },
    ]);
  });

  it('puts rounding remainder on the last period', () => {
    const rows = buildAcceptancePeriods({
      startDate: '2026-01-01', endDate: '2026-03-31', paymentMethod: '月付', contractAmount: 100,
    });
    assert.deepEqual(rows.map((r) => r.planned_amount), [33.33, 33.33, 33.34]);
  });

  it('returns empty for missing or inverted dates', () => {
    assert.deepEqual(buildAcceptancePeriods({ startDate: '', endDate: '2026-01-01', paymentMethod: '月付' }), []);
    assert.deepEqual(buildAcceptancePeriods({ startDate: '2026-05-01', endDate: '2026-04-01', paymentMethod: '月付' }), []);
  });
});

describe('summarizeAcceptances', () => {
  it('aggregates accepted, invoiced and received amounts', () => {
    const s = summarizeAcceptances([
      { status: '已验收', accepted_amount: 100, invoice_status: '已开票', invoice_amount: 100, received_amount: 60 },
      { status: '已验收', accepted_amount: 50, invoice_status: '未开票', invoice_amount: 20, received_amount: 0 },
      { status: '待验收', accepted_amount: 999, invoice_status: '未开票', invoice_amount: null, received_amount: null },
    ]);
    assert.deepEqual(s, {
      totalPeriods: 3,
      acceptedPeriods: 2,
      acceptedAmount: 150,
      invoicedAmount: 100,
      uninvoicedAcceptedAmount: 50,
      receivedAmount: 60,
      unreceivedAmount: 90,
    });
  });

  it('never reports negative outstanding amounts', () => {
    const s = summarizeAcceptances([
      { status: '已验收', accepted_amount: 10, invoice_status: '已开票', invoice_amount: 20, received_amount: 30 },
    ]);
    assert.equal(s.uninvoicedAcceptedAmount, 0);
    assert.equal(s.unreceivedAmount, 0);
  });

  it('handles empty input', () => {
    assert.equal(summarizeAcceptances([]).totalPeriods, 0);
    assert.equal(summarizeAcceptances(undefined).acceptedAmount, 0);
  });
});
