// シナリオ（楽観/標準/悲観）、総合判定、改善提案。

import { finalWorkAge, livingBase, salaryFor, simulate, type SimResult } from './simulate';
import { idecoMonthlyLimit } from './standards';
import type { Plan } from './types';

export type ScenarioKey = 'optimistic' | 'standard' | 'pessimistic';
export const SCENARIO_LABEL: Record<ScenarioKey, string> = {
  optimistic: '楽観',
  standard: '標準',
  pessimistic: '悲観',
};

export type Scenarios = Record<ScenarioKey, SimResult>;

export function runScenarios(plan: Plan): Scenarios {
  const d = plan.settings.scenarioSpread;
  return {
    optimistic: simulate(plan, { returnOffset: d }),
    standard: simulate(plan),
    pessimistic: simulate(plan, { returnOffset: -d }),
  };
}

export type Level = 'good' | 'warning' | 'critical';

export interface Judgement {
  level: Level;
  title: string;
  reasons: string[];
}

export function judge(s: Scenarios): Judgement {
  const std = s.standard.summary;
  const pes = s.pessimistic.summary;
  if (std.shortageYear !== null) {
    return {
      level: 'critical',
      title: 'このままだとお金が足りません',
      reasons: [`${std.shortageYear}年（${std.shortageAge}歳）に資金がショートします（標準シナリオ）。`],
    };
  }
  const reasons: string[] = [];
  if (pes.shortageYear !== null) {
    reasons.push(`運用が悲観シナリオの場合、${pes.shortageYear}年（${pes.shortageAge}歳）に資金がショートします。`);
  }
  if (std.belowEmergencyYears > 0) {
    reasons.push(`生活防衛資金を下回る年が ${std.belowEmergencyYears} 年あります。`);
  }
  if (reasons.length > 0) return { level: 'warning', title: '足りますが、余裕は大きくありません', reasons };
  return {
    level: 'good',
    title: 'お金は足りる見込みです',
    reasons: ['標準・悲観どちらのシナリオでも資金はショートしません。'],
  };
}

export interface Suggestion {
  title: string;
  detail: string;
}

type Tweak = (plan: Plan, x: number) => Plan;

/** f(x) が成立する最小の x を二分探索（x は step 刻み） */
function minimal(ok: (x: number) => boolean, lo: number, hi: number, step: number): number | null {
  if (!ok(hi)) return null;
  if (ok(lo)) return lo;
  while (hi - lo > step) {
    const mid = Math.round((lo + hi) / 2 / step) * step;
    if (mid === lo || mid === hi) break;
    if (ok(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

const clone = (p: Plan): Plan => structuredClone(p);

const addSaving: Tweak = (plan, x) => {
  const p = clone(plan);
  const age = p.settings.startYear - p.self.birthYear;
  p.assets.accounts.push({
    id: 'suggest',
    name: '追加の積立',
    type: 'taxable',
    owner: 'self',
    balance: 0,
    principal: 0,
    monthly: x,
    contribStartAge: age,
    contribEndAge: finalWorkAge(p.self),
    expectedReturn: averageReturn(plan),
  });
  return p;
};

const cutLiving: Tweak = (plan, x) => {
  const p = clone(plan);
  p.budget.variable.push({ id: 'suggest', name: '削減', amount: -x, buffer: false });
  return p;
};

const workLonger: Tweak = (plan, n) => {
  const p = clone(plan);
  p.self.income.retirementAge += n;
  if (p.self.income.reemployment) p.self.income.reemploymentUntilAge += n;
  return p;
};

const deferPension: Tweak = (plan, age) => {
  const p = clone(plan);
  p.self.pension.startAge = age;
  if (p.spouse.enabled) p.spouse.pension.startAge = age;
  return p;
};

function averageReturn(plan: Plan): number {
  const accs = plan.assets.accounts;
  const weight = accs.reduce((s, a) => s + a.monthly, 0);
  if (weight === 0) return 0.03;
  return accs.reduce((s, a) => s + a.expectedReturn * a.monthly, 0) / weight;
}

const yen = (v: number) => `${Math.round(v).toLocaleString()}円`;

export function suggestImprovements(plan: Plan, j: Judgement): Suggestion[] {
  if (j.level === 'good') return [];
  const offset = j.level === 'critical' ? 0 : -plan.settings.scenarioSpread;
  const target = j.level === 'critical' ? '標準シナリオ' : '悲観シナリオ';
  const ok = (p: Plan) => simulate(p, { returnOffset: offset }).summary.shortageYear === null;
  const out: Suggestion[] = [];

  const saving = minimal((x) => ok(addSaving(plan, x)), 0, 500_000, 1_000);
  if (saving !== null && saving > 0) {
    out.push({
      title: `毎月あと ${yen(saving)} 積み立てる`,
      detail: `退職まで、利回り ${(averageReturn(plan) * 100).toFixed(1)}% で追加積立すると${target}でも足ります。`,
    });
  }

  const monthlyLiving = livingBase(plan.budget, plan.settings.bufferRate).total / 12;
  const cut = minimal((x) => ok(cutLiving(plan, x)), 0, Math.max(1_000, Math.floor(monthlyLiving)), 1_000);
  if (cut !== null && cut > 0) {
    out.push({
      title: `生活費を毎月 ${yen(cut)} 下げる`,
      detail: `現在の生活費（月 ${yen(monthlyLiving)}）の ${((cut / monthlyLiving) * 100).toFixed(0)}% の削減で${target}でも足ります。`,
    });
  }

  for (let n = 1; n <= 10; n++) {
    if (ok(workLonger(plan, n))) {
      out.push({
        title: `${n}年長く働く`,
        detail: `働く期間を ${finalWorkAge(plan.self)}歳 → ${finalWorkAge(plan.self) + n}歳 に延ばすと${target}でも足ります。`,
      });
      break;
    }
  }

  const current = plan.self.pension.startAge;
  for (let age = Math.max(66, current + 1); age <= 75; age++) {
    if (ok(deferPension(plan, age))) {
      out.push({
        title: `年金の受給開始を ${age}歳 にする`,
        detail: `繰下げ受給で年金額が ${((age - 65) * 12 * 0.7).toFixed(1)}% 増え、${target}でも足ります。`,
      });
      break;
    }
  }

  if (out.length === 0) {
    out.push({
      title: '単独の対策では解消できません',
      detail: '積立の増額・生活費の見直し・働く期間の延長を組み合わせるか、大きな支出（住宅・教育・イベント）を見直してください。',
    });
  }
  return out;
}

export interface MonthlyBudgetView {
  takeHome: number;
  childAllowance: number;
  housing: number;
  fixed: number;
  special: number;
  investment: number;
  variableBudget: number; // 変動費に使える額
  variable: number;
  free: number; // 自由に使える余裕
  bufferPortion: number;
}

/** 今年の「月いくら使えるか」 */
export function monthlyBudget(plan: Plan, standard: SimResult): MonthlyBudgetView {
  const { settings, budget, housing } = plan;
  const B = settings.bufferRate;
  const row = standard.rows[0];
  const self = salaryFor(plan.self, settings.startYear, settings.startYear).net;
  const spouse = plan.spouse.enabled ? salaryFor(plan.spouse, settings.startYear, settings.startYear).net : 0;
  const sum = (items: { amount: number; buffer: boolean }[]) => items.reduce((s, i) => s + i.amount * (i.buffer ? B : 1), 0);
  const bufferOf = (items: { amount: number; buffer: boolean }[]) =>
    items.reduce((s, i) => s + (i.buffer ? i.amount * (B - 1) : 0), 0);

  let housingMonthly = 0;
  if (housing.currentType === 'rent') housingMonthly = housing.rentMonthly;
  else housingMonthly = row ? row.housing / 12 : 0;

  const takeHome = (self + spouse + (row?.pension ?? 0)) / 12;
  const childAllowance = (row?.childAllowance ?? 0) / 12;
  const fixed = sum(budget.fixed);
  const special = sum(budget.special) / 12;
  const investment = (row?.contribution ?? 0) / 12;
  const variableBudget = takeHome + childAllowance - housingMonthly - fixed - special - investment;
  const variable = sum(budget.variable);
  return {
    takeHome,
    childAllowance,
    housing: housingMonthly,
    fixed,
    special,
    investment,
    variableBudget,
    variable,
    free: variableBudget - variable,
    bufferPortion: bufferOf(budget.fixed) + bufferOf(budget.variable) + bufferOf(budget.special) / 12,
  };
}

export function idecoLimitMonthly(employment: string, year: number): number {
  return idecoMonthlyLimit(employment, year);
}
