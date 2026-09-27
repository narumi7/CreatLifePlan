// 年単位のライフプラン・シミュレーション本体。純粋関数のみで構成する。

import { loanSchedule, type LoanYear } from './loan';
import {
  BASIC_PENSION_FULL,
  BIRTH_ALLOWANCE,
  BIRTH_COST,
  CAPITAL_GAINS_TAX,
  CHILD_ALLOWANCE,
  HOIKUEN_3TO5,
  HOIKUEN_UNDER3,
  IDECO_WITHDRAW_AGE,
  idecoContribEndAge,
  idecoMonthlyLimit,
  LIVING_AWAY_ALLOWANCE,
  NISA_ANNUAL_LIMIT,
  NISA_LIFETIME_LIMIT,
  NO_SUPPORT_EXTRA,
  PENSION_EARNINGS_RATE,
  PENSION_NET_RATIO,
  SCHOOL_COST,
  UNIVERSITY,
  upbringingCost,
} from './standards';
import { takeHome } from './tax';
import type { Budget, Child, InvestAccount, LifeEvent, Person, Plan, Settings } from './types';

export interface ChildYear {
  id: string;
  name: string;
  age: number;
  stage: string;
  education: number;
  living: number;
  birth: number;
}

export interface YearRow {
  year: number;
  ageSelf: number;
  ageSpouse: number | null;
  deflator: number; // (1 + 物価上昇率)^経過年数。現在価値 = 名目 / deflator

  salarySelf: number;
  salarySpouse: number;
  pension: number;
  severance: number;
  childAllowance: number;
  loanDeduction: number;
  otherIncome: number; // その他収入＋収入イベント
  incomeTotal: number;

  living: number;
  housing: number;
  education: number; // 教育費＋出産費用
  childLiving: number;
  events: number;
  expenseTotal: number;
  bufferPortion: number; // 支出のうちバッファ（×1.1 の 0.1 部分）

  contribution: number;
  withdrawal: number; // 投資から現金への取り崩し（手取り）
  cashFlow: number; // 収入 − 支出 − 積立

  cash: number;
  invest: number;
  investPrincipal: number;
  investByType: { nisa: number; ideco: number; taxable: number };
  loanBalance: number;
  financial: number; // 現金＋投資
  netWorth: number; // 金融資産 − ローン残高
  emergencyTarget: number;

  shortage: boolean; // 取り崩しても現金がマイナス
  belowEmergency: boolean;
  eventLabels: string[];
  markers: string[]; // グラフ上に表示するアイコン（毎年のような頻繁なイベントは除く）
  children: ChildYear[];
}

export interface SimSummary {
  shortageYear: number | null;
  shortageAge: number | null;
  finalFinancial: number;
  finalNetWorth: number;
  minFinancial: number;
  minFinancialYear: number;
  retireYear: number;
  retireFinancial: number;
  belowEmergencyYears: number;
}

export interface SimResult {
  rows: YearRow[];
  summary: SimSummary;
  warnings: string[];
}

export interface SimOptions {
  returnOffset?: number;
}

const ageAt = (p: Person, year: number) => year - p.birthYear;

export function finalWorkAge(p: Person): number {
  const inc = p.income;
  return inc.reemployment ? Math.max(inc.retirementAge, inc.reemploymentUntilAge) : inc.retirementAge;
}

/** 昇給・定年・再雇用を考慮した年収の倍率（今年 = 1） */
function incomeFactor(p: Person, year: number, startYear: number): number {
  const inc = p.income;
  const age = ageAt(p, year);
  const age0 = ageAt(p, startYear);
  const growth = (a: number) =>
    Math.pow(1 + inc.raiseRate, Math.max(0, Math.min(a, inc.raiseUntilAge) - Math.min(age0, inc.raiseUntilAge)));
  if (age < inc.retirementAge) return growth(age);
  if (inc.reemployment && age < inc.reemploymentUntilAge) return growth(inc.retirementAge - 1) * inc.reemploymentRatio;
  return 0;
}

export function salaryFor(p: Person, year: number, startYear: number): { gross: number; net: number } {
  const f = incomeFactor(p, year, startYear);
  if (f === 0) return { gross: 0, net: 0 };
  let gross: number;
  let net: number;
  if (p.income.mode === 'gross') {
    gross = p.income.annualGross * f;
    net = takeHome(gross, p.employment, ageAt(p, year)).net;
  } else {
    net = p.income.annualNet * f;
    gross = net / 0.78;
  }
  for (const c of p.income.changes) {
    if (year >= c.startYear && year <= c.endYear) net *= c.ratio;
  }
  return { gross, net };
}

/** 年金額（今の物価、額面、65歳受給開始ベース） */
export function estimatePension65(p: Person, settings: Settings): number {
  if (p.pension.mode === 'manual') return p.pension.annualAmount;
  const basic = BASIC_PENSION_FULL;
  if (p.employment !== 'employee' && p.employment !== 'civilServant') return basic;
  const inc = p.income;
  const endAge = Math.min(finalWorkAge(p), 70);
  const age0 = ageAt(p, settings.startYear);
  let total = 0;
  let count = 0;
  for (let a = inc.workStartAge; a < endAge; a++) {
    const year = settings.startYear + (a - age0);
    let gross: number;
    if (a <= age0) {
      const base = inc.mode === 'gross' ? inc.annualGross : inc.annualNet / 0.78;
      const back = Math.max(0, Math.min(age0, inc.raiseUntilAge) - Math.min(a, inc.raiseUntilAge));
      gross = base / Math.pow(1 + inc.raiseRate, back);
    } else {
      gross = salaryFor(p, year, settings.startYear).gross / Math.pow(1 + settings.inflationRate, a - age0);
    }
    total += Math.min(gross, 10_000_000);
    count++;
  }
  if (count === 0) return basic;
  const avgMonthly = total / count / 12;
  return basic + avgMonthly * PENSION_EARNINGS_RATE * count * 12;
}

/** 繰上げ（1か月 −0.4%）・繰下げ（1か月 +0.7%）の調整率 */
export function pensionAdjust(startAge: number): number {
  const months = (startAge - 65) * 12;
  return months < 0 ? 1 + months * 0.004 : 1 + months * 0.007;
}

function pensionFor(p: Person, year: number, settings: Settings): number {
  if (ageAt(p, year) < p.pension.startAge) return 0;
  const growth = Math.pow(1 + Math.max(0, settings.inflationRate - settings.pensionSlide), year - settings.startYear);
  return estimatePension65(p, settings) * pensionAdjust(p.pension.startAge) * growth * PENSION_NET_RATIO;
}

export function childStage(child: Child, age: number): string {
  if (age < 0) return '誕生前';
  if (age <= 2) return child.nursery === 'hoikuen' ? '保育園' : '未就学';
  if (age <= 5) return child.nursery === 'home' ? '未就学' : child.nursery === 'hoikuen' ? '保育園' : '幼稚園';
  if (age <= 11) return '小学生';
  if (age <= 14) return '中学生';
  if (age <= 17) return '高校生';
  if (child.university !== 'none') {
    const u = UNIVERSITY[child.university];
    if (age - 18 < u.years) return u.label;
  }
  return '独立';
}

function independenceAge(child: Child): number {
  return child.university === 'none' ? 18 : 18 + UNIVERSITY[child.university].years;
}

/** 子供1人の年間費用（今の物価、バッファ前） */
export function childBaseCost(child: Child, year: number, settings: Settings): { education: number; living: number; birth: number } {
  const age = year - child.birthYear;
  let education = 0;
  let living = 0;
  let birth = 0;
  if (age === 0 && child.birthYear >= settings.startYear) birth = BIRTH_COST;
  if (age < 0) return { education, living, birth };

  if (age <= 2) {
    if (child.nursery === 'hoikuen') education = HOIKUEN_UNDER3;
  } else if (age <= 5) {
    if (child.nursery === 'hoikuen') education = HOIKUEN_3TO5;
    else if (child.nursery === 'kindergartenPublic') education = SCHOOL_COST.kindergarten.public;
    else if (child.nursery === 'kindergartenPrivate') education = SCHOOL_COST.kindergarten.private;
    if (!settings.publicSupport && child.nursery !== 'home') education += NO_SUPPORT_EXTRA.preschool3to5;
  } else if (age <= 11) {
    education = SCHOOL_COST.elementary[child.elementary];
  } else if (age <= 14) {
    education = SCHOOL_COST.juniorHigh[child.juniorHigh];
  } else if (age <= 17) {
    education = SCHOOL_COST.highSchool[child.highSchool];
    if (!settings.publicSupport) education += NO_SUPPORT_EXTRA.highSchool[child.highSchool];
  } else if (child.university !== 'none') {
    const u = UNIVERSITY[child.university];
    const idx = age - 18;
    if (idx < u.years) {
      education = u.annual + (idx === 0 ? u.admission : 0) + (child.livingAway ? LIVING_AWAY_ALLOWANCE : 0);
    }
  }
  if (age >= 6 && age <= 17) education += child.extraAnnual;

  const studyingAway = child.livingAway && child.university !== 'none' && age >= 18;
  if (child.includeLivingCost && age < independenceAge(child) && !studyingAway) living = upbringingCost(age);
  return { education, living, birth };
}

/** 児童手当（年額）。第3子以降のカウントは22歳年度末までの子を対象とする */
export function childAllowanceFor(children: Child[], year: number): number {
  const counted = children
    .filter((c) => {
      const a = year - c.birthYear;
      return a >= 0 && a <= 21;
    })
    .sort((a, b) => a.birthYear - b.birthYear);
  let total = 0;
  counted.forEach((c, i) => {
    const age = year - c.birthYear;
    if (age > 17) return;
    const monthly = i >= 2 ? CHILD_ALLOWANCE.thirdOrLater : age < 3 ? CHILD_ALLOWANCE.under3 : CHILD_ALLOWANCE.over3;
    total += monthly * 12;
  });
  return total;
}

/** 生活費（年額、今の物価）とそのうちのバッファ分 */
export function livingBase(budget: Budget, bufferRate: number): { total: number; buffer: number } {
  let total = 0;
  let buffer = 0;
  const add = (amount: number, useBuffer: boolean) => {
    const b = useBuffer ? amount * (bufferRate - 1) : 0;
    total += amount + b;
    buffer += b;
  };
  for (const i of budget.fixed) add(i.amount * 12, i.buffer);
  for (const i of budget.variable) add(i.amount * 12, i.buffer);
  for (const i of budget.special) add(i.amount, i.buffer);
  return { total, buffer };
}

export function eventOccurs(e: LifeEvent, year: number): boolean {
  if (year < e.year) return false;
  if (e.repeatEvery <= 0) return year === e.year;
  return year <= e.endYear && (year - e.year) % e.repeatEvery === 0;
}

function isAccessible(acc: InvestAccount, ownerAge: number): boolean {
  return acc.type !== 'ideco' || ownerAge >= IDECO_WITHDRAW_AGE;
}

const WITHDRAW_ORDER: Record<InvestAccount['type'], number> = { taxable: 0, ideco: 1, nisa: 2 };

interface AccState {
  acc: InvestAccount;
  balance: number;
  principal: number;
}

/** 投資口座から手取り needNet 円を取り崩す。実際に得られた手取り額を返す */
function withdrawFrom(states: AccState[], needNet: number, ownerAge: (a: InvestAccount) => number): number {
  let got = 0;
  const ordered = [...states].sort((a, b) => WITHDRAW_ORDER[a.acc.type] - WITHDRAW_ORDER[b.acc.type]);
  for (const s of ordered) {
    if (got >= needNet) break;
    if (s.balance <= 0 || !isAccessible(s.acc, ownerAge(s.acc))) continue;
    const gainRatio = s.acc.type === 'taxable' ? Math.max(0, 1 - s.principal / s.balance) : 0;
    const netPerUnit = 1 - gainRatio * CAPITAL_GAINS_TAX;
    const gross = Math.min(s.balance, (needNet - got) / netPerUnit);
    s.principal -= s.balance > 0 ? (gross * s.principal) / s.balance : 0;
    s.balance -= gross;
    got += gross * netPerUnit;
  }
  return got;
}

export function simulate(plan: Plan, opts: SimOptions = {}): SimResult {
  const { settings, self, budget, housing, assets } = plan;
  const spouse = plan.spouse.enabled ? plan.spouse : null;
  const offset = opts.returnOffset ?? 0;
  const B = settings.bufferRate;
  const startYear = settings.startYear;
  const endYear = self.birthYear + settings.endAge;
  const warnings = new Set<string>();

  const owner = (a: InvestAccount): Person | null => (a.owner === 'spouse' ? spouse : self);
  const states: AccState[] = assets.accounts
    .filter((a) => owner(a))
    .map((acc) => ({ acc, balance: acc.balance, principal: acc.principal }));
  const ownerAge = (a: InvestAccount, year: number) => ageAt(owner(a)!, year);

  // ローン返済表
  const p = housing.purchase;
  const purchased = (y: number) => p.enabled && y >= p.year;
  const existingLoan: LoanYear[] =
    housing.currentType === 'own' && housing.existingLoan.balance > 0
      ? loanSchedule(housing.existingLoan.balance, housing.existingLoan.rate, housing.existingLoan.remainingYears, housing.existingLoan.method)
      : [];
  const newLoan: LoanYear[] = p.enabled ? loanSchedule(Math.max(0, p.price - p.downPayment), p.loanRate, p.loanYears, p.method) : [];

  const living0 = livingBase(budget, B);
  const retireAge = finalWorkAge(self);

  let cash = assets.cash;
  const rows: YearRow[] = [];

  for (let year = startYear; year <= endYear; year++) {
    const t = year - startYear;
    const f = Math.pow(1 + settings.inflationRate, t);
    const ageSelf = ageAt(self, year);
    const ageSpouse = spouse ? ageAt(spouse, year) : null;
    const labels: string[] = [];
    const markers: string[] = [];
    let bufferPortion = 0;

    // ---- 収入 ----
    const sSelf = salaryFor(self, year, startYear);
    const sSpouse = spouse ? salaryFor(spouse, year, startYear) : { gross: 0, net: 0 };
    let pension = pensionFor(self, year, settings);
    if (spouse) pension += pensionFor(spouse, year, settings);
    let severance = 0;
    if (ageSelf === self.income.retirementAge && self.income.severancePay > 0) {
      severance += self.income.severancePay;
      labels.push('🎉 退職金');
    }
    if (spouse && ageSpouse === spouse.income.retirementAge && spouse.income.severancePay > 0) {
      severance += spouse.income.severancePay;
      labels.push('🎉 退職金（配偶者）');
    }
    if (ageSelf === self.income.retirementAge) {
      labels.push('🏁 定年');
      markers.push('🏁');
    }
    const childAllowance = childAllowanceFor(plan.children, year);
    let otherIncome = 0;
    for (const o of plan.otherIncomes) if (year >= o.startYear && year <= o.endYear) otherIncome += o.annualAmount;

    // ---- 住居費 ----
    let housingCost = 0;
    let loanBalance = 0;
    let loanDeduction = 0;
    if (housing.currentType === 'rent' && !purchased(year)) {
      housingCost += housing.rentMonthly * 12 * (housing.rentInflation ? f : 1);
    }
    if (housing.currentType === 'own' && !purchased(year)) {
      const ly = existingLoan[t];
      if (ly) {
        housingCost += ly.payment;
        loanBalance += ly.endBalance;
      }
      housingCost += housing.ownPropertyTax;
      const m = housing.ownMaintenance * f;
      housingCost += m * B;
      bufferPortion += m * (B - 1);
    }
    if (p.enabled && year >= p.year) {
      const idx = year - p.year;
      if (idx === 0) {
        const fees = p.price * p.costRate * f;
        housingCost += p.downPayment + fees * B;
        bufferPortion += fees * (B - 1);
        labels.push('🏠 住宅購入');
        markers.push('🏠');
      }
      const ly = newLoan[idx];
      if (ly) {
        housingCost += ly.payment;
        loanBalance += ly.endBalance;
        if (p.loanDeduction && idx < p.deductionYears) {
          let d = Math.min(ly.endBalance, p.deductionCap) * 0.007;
          if (self.income.mode === 'gross' && sSelf.gross > 0) {
            const th = takeHome(sSelf.gross, self.employment, ageSelf);
            d = Math.min(d, th.incomeTax + Math.min(th.residentTax, 97_500));
          } else if (sSelf.net === 0) {
            d = 0;
          }
          loanDeduction += d;
        }
      }
      housingCost += p.propertyTax;
      const m = p.maintenance * f;
      housingCost += m * B;
      bufferPortion += m * (B - 1);
    }

    // ---- 生活費 ----
    const retired = ageSelf >= retireAge;
    const livingRatio = retired ? budget.retirementRatio : 1;
    const living = living0.total * f * livingRatio;
    bufferPortion += living0.buffer * f * livingRatio;

    // ---- 子供 ----
    let education = 0;
    let childLiving = 0;
    const childRows: ChildYear[] = [];
    for (const c of plan.children) {
      const base = childBaseCost(c, year, settings);
      const age = year - c.birthYear;
      const birth = Math.max(0, base.birth * B * f - BIRTH_ALLOWANCE);
      const edu = base.education * B * f;
      const liv = base.living * B * f;
      education += edu + birth;
      childLiving += liv;
      bufferPortion += (base.education + base.living) * (B - 1) * f + (birth > 0 ? base.birth * (B - 1) * f : 0);
      if (age === 0 && c.birthYear >= startYear) {
        labels.push(`👶 ${c.name} 誕生`);
        markers.push('👶');
      }
      if (age === 6) labels.push(`🎒 ${c.name} 小学校入学`);
      if (age === 18 && c.university !== 'none') {
        labels.push(`🎓 ${c.name} ${UNIVERSITY[c.university].label}入学`);
        markers.push('🎓');
      }
      if (age >= -1) childRows.push({ id: c.id, name: c.name, age, stage: childStage(c, age), education: edu, living: liv, birth });
    }

    // ---- ライフイベント ----
    let eventsCost = 0;
    for (const e of plan.events) {
      if (!eventOccurs(e, year)) continue;
      const base = e.amount * (e.inflate ? f : 1);
      if (e.kind === 'income') {
        otherIncome += base;
      } else {
        const b = e.buffer ? base * (B - 1) : 0;
        eventsCost += base + b;
        bufferPortion += b;
      }
      labels.push(`${e.icon} ${e.name}`);
      if (e.repeatEvery === 0 || e.repeatEvery >= 5) markers.push(e.icon);
    }

    const incomeTotal = sSelf.net + sSpouse.net + pension + severance + childAllowance + loanDeduction + otherIncome;
    const expenseTotal = living + housingCost + education + childLiving + eventsCost;

    // ---- 積立投資 ----
    // 前年末に現金がマイナス（資金ショート中）なら積立は止める
    const paused = cash < 0;
    const contributing = (a: InvestAccount) => {
      const oAge = ownerAge(a, year);
      return !paused && oAge >= a.contribStartAge && oAge < a.contribEndAge;
    };
    let contribution = 0;
    const nisaUsed: Record<string, number> = { self: 0, spouse: 0 };
    for (const s of states) {
      const a = s.acc;
      const oAge = ownerAge(a, year);
      if (!contributing(a)) continue;
      let c = a.monthly * 12;
      if (a.type === 'ideco') {
        const limit = idecoMonthlyLimit(owner(a)!.employment, year) * 12;
        if (oAge >= idecoContribEndAge(year)) c = 0;
        if (c > limit) {
          warnings.add(`${a.name}: iDeCo の拠出上限（月${(limit / 12).toLocaleString()}円）に合わせて計算しています`);
          c = limit;
        }
      }
      if (a.type === 'nisa') {
        const held = states
          .filter((x) => x.acc.type === 'nisa' && x.acc.owner === a.owner)
          .reduce((sum, x) => sum + x.principal, 0);
        const room = Math.max(0, Math.min(NISA_ANNUAL_LIMIT - nisaUsed[a.owner], NISA_LIFETIME_LIMIT - held));
        if (c > room) {
          warnings.add(`${a.name}: NISA の上限（年360万円・生涯1,800万円）に達した分は積み立てていません`);
          c = room;
        }
        nisaUsed[a.owner] += c;
      }
      s.principal += c;
      contribution += c;
      const r = a.expectedReturn + offset;
      s.balance = s.balance * (1 + r) + c * (1 + r / 2);
    }
    // 積立していない口座の運用
    for (const s of states) {
      if (contributing(s.acc)) continue;
      s.balance *= 1 + s.acc.expectedReturn + offset;
    }

    const cashFlow = incomeTotal - expenseTotal - contribution;
    cash = cash * (cash > 0 ? 1 + assets.cashRate : 1) + cashFlow;

    // ---- 取り崩し ----
    let withdrawal = 0;
    const w = assets.withdrawal;
    if (w.mode !== 'none' && ageSelf >= w.startAge) {
      const accessible = states.filter((s) => isAccessible(s.acc, ownerAge(s.acc, year))).reduce((sum, s) => sum + s.balance, 0);
      const want = w.mode === 'fixed' ? w.monthlyAmount * 12 * f : accessible * w.rate;
      withdrawal += withdrawFrom(states, want, (a) => ownerAge(a, year));
    }
    cash += withdrawal;
    const recurringHousing = housingCost - (p.enabled && year === p.year ? p.downPayment + p.price * p.costRate * f * B : 0);
    const emergencyTarget = ((living + recurringHousing + childLiving) / 12) * assets.emergencyMonths;
    if (assets.autoCover && cash < emergencyTarget) {
      const got = withdrawFrom(states, emergencyTarget - cash, (a) => ownerAge(a, year));
      cash += got;
      withdrawal += got;
    }

    const invest = states.reduce((s, x) => s + x.balance, 0);
    const investPrincipal = states.reduce((s, x) => s + x.principal, 0);
    const byType = { nisa: 0, ideco: 0, taxable: 0 };
    for (const s of states) byType[s.acc.type] += s.balance;

    rows.push({
      year,
      ageSelf,
      ageSpouse,
      deflator: f,
      salarySelf: sSelf.net,
      salarySpouse: sSpouse.net,
      pension,
      severance,
      childAllowance,
      loanDeduction,
      otherIncome,
      incomeTotal,
      living,
      housing: housingCost,
      education,
      childLiving,
      events: eventsCost,
      expenseTotal,
      bufferPortion,
      contribution,
      withdrawal,
      cashFlow,
      cash,
      invest,
      investPrincipal,
      investByType: byType,
      loanBalance,
      financial: cash + invest,
      netWorth: cash + invest - loanBalance,
      emergencyTarget,
      shortage: cash < -1,
      belowEmergency: cash < emergencyTarget - 1,
      eventLabels: labels,
      markers: [...new Set(markers)],
      children: childRows,
    });
  }

  return { rows, summary: summarize(rows, self, retireAge), warnings: [...warnings] };
}

function summarize(rows: YearRow[], self: Person, retireAge: number): SimSummary {
  const short = rows.find((r) => r.shortage);
  let min = rows[0];
  for (const r of rows) if (r.financial < min.financial) min = r;
  const last = rows[rows.length - 1];
  const retireRow = rows.find((r) => r.ageSelf === retireAge) ?? rows[0];
  return {
    shortageYear: short ? short.year : null,
    shortageAge: short ? short.year - self.birthYear : null,
    finalFinancial: last.financial,
    finalNetWorth: last.netWorth,
    minFinancial: min.financial,
    minFinancialYear: min.year,
    retireYear: retireRow.year,
    retireFinancial: retireRow.financial,
    belowEmergencyYears: rows.filter((r) => r.belowEmergency).length,
  };
}
