import { describe, expect, it } from 'vitest';
import { judge, monthlyBudget, runScenarios, suggestImprovements } from './analysis';
import { defaultChild, defaultPlan, normalizePlan } from './defaults';
import { loanSchedule } from './loan';
import { childAllowanceFor, childBaseCost, pensionAdjust, simulate } from './simulate';
import { MAN } from './standards';
import { takeHome } from './tax';
import type { Plan } from './types';

const plan = (): Plan => defaultPlan(new Date('2026-06-01'));

describe('tax', () => {
  it('年収500万円の会社員の手取りは概ね 380〜400万円', () => {
    const t = takeHome(500 * MAN, 'employee', 30);
    expect(t.net).toBeGreaterThan(375 * MAN);
    expect(t.net).toBeLessThan(405 * MAN);
  });
  it('年収0なら手取り0', () => {
    expect(takeHome(0, 'employee', 30).net).toBe(0);
  });
});

describe('loan', () => {
  it('元利均等: 3000万円 1% 35年 の返済総額は約3557万円で、完済時残高0', () => {
    const s = loanSchedule(3000 * MAN, 0.01, 35, 'equalPayment');
    expect(s).toHaveLength(35);
    const total = s.reduce((a, y) => a + y.payment, 0);
    expect(total / MAN).toBeCloseTo(3557, -1);
    expect(s[34].endBalance).toBeCloseTo(0, 0);
  });
  it('元金均等の方が総返済額は少ない', () => {
    const a = loanSchedule(3000 * MAN, 0.01, 35, 'equalPayment').reduce((s, y) => s + y.payment, 0);
    const b = loanSchedule(3000 * MAN, 0.01, 35, 'equalPrincipal').reduce((s, y) => s + y.payment, 0);
    expect(b).toBeLessThan(a);
  });
});

describe('children', () => {
  it('児童手当: 第3子以降は月3万円', () => {
    const cs = [defaultChild(2020, 'A'), defaultChild(2022, 'B'), defaultChild(2025, 'C')];
    // 2026年: A=6歳(1万), B=4歳(1万), C=1歳 第3子(3万)
    expect(childAllowanceFor(cs, 2026)).toBe((10_000 + 10_000 + 30_000) * 12);
  });
  it('私立文系の入学年は入学金を含む', () => {
    const c = defaultChild(2000, 'A');
    const p = plan();
    const y18 = childBaseCost(c, 2018, p.settings).education;
    const y19 = childBaseCost(c, 2019, p.settings).education;
    expect(y18 - y19).toBeCloseTo(22.5 * MAN);
  });
});

describe('pension', () => {
  it('繰下げ70歳は +42%、繰上げ60歳は −24%', () => {
    expect(pensionAdjust(70)).toBeCloseTo(1.42);
    expect(pensionAdjust(60)).toBeCloseTo(0.76);
  });
});

describe('simulate', () => {
  it('100歳まで1年1行で計算される', () => {
    const p = plan();
    const r = simulate(p);
    expect(r.rows[0].year).toBe(2026);
    expect(r.rows[r.rows.length - 1].ageSelf).toBe(100);
  });

  it('バッファ率を上げると支出が増える', () => {
    const p = plan();
    const a = simulate(p).rows[0].expenseTotal;
    p.settings.bufferRate = 1.2;
    const b = simulate(p).rows[0].expenseTotal;
    expect(b).toBeGreaterThan(a);
  });

  it('子供を追加するとバッファ込みの教育費が計上される', () => {
    const p = plan();
    p.children.push(defaultChild(2020, 'A'));
    const row = simulate(p).rows[0]; // 6歳 = 公立小学校
    expect(row.education).toBeCloseTo((33.6 * MAN + 20 * MAN) * 1.1, 0);
  });

  it('NISA は生涯1,800万円で積立が止まる', () => {
    const p = plan();
    p.assets.cash = 100_000_000; // 取り崩しが起きないようにする
    p.assets.accounts[0].monthly = 400_000;
    p.assets.accounts[0].contribEndAge = 90;
    const r = simulate(p);
    expect(r.warnings.some((w) => w.includes('NISA'))).toBe(true);
    const total = r.rows.reduce((s, x) => s + x.contribution, 0);
    expect(total).toBeLessThanOrEqual(18_000_000 + 1);
  });

  it('資金ショート中は積立を止める', () => {
    const p = plan();
    p.assets.cash = 0;
    p.assets.accounts[0].balance = 0;
    p.budget.variable[0].amount = 600_000;
    const r = simulate(p);
    const idx = r.rows.findIndex((x) => x.cash < 0);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(r.rows[idx + 1].contribution).toBe(0);
  });

  it('楽観 > 標準 > 悲観 の順に最終資産が大きい', () => {
    const s = runScenarios(plan());
    expect(s.optimistic.summary.finalFinancial).toBeGreaterThan(s.standard.summary.finalFinancial);
    expect(s.standard.summary.finalFinancial).toBeGreaterThan(s.pessimistic.summary.finalFinancial);
  });

  it('収入がなければ資金ショートと判定され、改善提案が出る', () => {
    const p = plan();
    p.self.income.annualGross = 250 * MAN;
    p.budget.variable[0].amount = 150_000;
    const s = runScenarios(p);
    const j = judge(s);
    expect(j.level).toBe('critical');
    const sug = suggestImprovements(p, j);
    expect(sug.length).toBeGreaterThan(0);
  });

  it('月の家計: 手取り − 住居 − 固定費 − 特別費 − 積立 = 変動費に使える額', () => {
    const p = plan();
    const s = simulate(p);
    const m = monthlyBudget(p, s);
    expect(m.variableBudget).toBeCloseTo(m.takeHome + m.childAllowance - m.housing - m.fixed - m.special - m.investment);
    expect(m.free).toBeCloseTo(m.variableBudget - m.variable);
  });
});

describe('normalizePlan', () => {
  it('欠けている項目を既定値で補う', () => {
    const p = normalizePlan({ settings: { endAge: 90 } });
    expect(p.settings.endAge).toBe(90);
    expect(p.settings.bufferRate).toBe(1.1);
    expect(p.self.income.retirementAge).toBe(60);
  });
});
