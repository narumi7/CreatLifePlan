// 「いくらの家なら買えるか」の試算。
// 今のライフプランに住宅購入を組み込み、価格を変えながらシミュレーションして、
// 資金がショートしない上限価格を探す。

import { loanSchedule } from './loan';
import { salaryFor, simulate } from './simulate';
import { MAN } from './standards';
import type { Plan } from './types';

/** 返済負担率（年間返済額 ÷ 世帯の手取り年収）の目安 */
export const SAFE_REPAYMENT_RATIO = 0.25;

export interface PriceCheck {
  price: number;
  loanAmount: number;
  monthlyPayment: number; // 初年度の毎月返済額
  repaymentRatio: number; // 年間返済額 ÷ 購入年の世帯手取り
  cashAtPurchase: number; // 購入時に必要な現金（頭金＋諸費用、バッファ込み）
  retireFinancial: number; // 退職時の金融資産（標準シナリオ、名目）
  finalFinancial: number; // 最終年の金融資産（標準シナリオ、名目）
}

export interface Affordability {
  purchaseYear: number;
  purchaseAge: number;
  payoffAge: number; // ローン完済時の本人の年齢
  downPayment: number;
  netIncome: number; // 購入年の世帯手取り年収
  /** 悲観シナリオでもショートせず、返済負担率も目安以内の価格（安心ライン） */
  safe: PriceCheck | null;
  /** 標準シナリオでショートしない上限価格 */
  max: PriceCheck | null;
  /** 返済負担率 25% になる価格（家計簿の目安による上限） */
  ratioLimit: PriceCheck | null;
  /** 上限を少し超えたときに最初に資金がショートする年と本人の年齢 */
  overLimitShortage: { year: number; age: number } | null;
  /** 住宅を買わなくても資金がショートする */
  shortWithoutHouse: boolean;
  advice: string[];
}

const STEP = 50 * MAN;
const MAX_PRICE = 30_000 * MAN;

/** 価格を差し替えた住宅購入プランを作る。固定資産税は価格に比例させる */
export function withPurchasePrice(plan: Plan, price: number): Plan {
  const p = structuredClone(plan);
  const base = plan.housing.purchase;
  const taxPerYen = base.price > 0 ? base.propertyTax / base.price : 0.003;
  p.housing.purchase = {
    ...base,
    enabled: true,
    price,
    downPayment: Math.min(base.downPayment, price),
    propertyTax: price * taxPerYen,
  };
  return p;
}

function householdNet(plan: Plan, year: number): number {
  const start = plan.settings.startYear;
  const self = salaryFor(plan.self, year, start).net;
  const spouse = plan.spouse.enabled ? salaryFor(plan.spouse, year, start).net : 0;
  return self + spouse;
}

function check(plan: Plan, price: number): PriceCheck {
  const p = withPurchasePrice(plan, price);
  const pur = p.housing.purchase;
  const loanAmount = Math.max(0, price - pur.downPayment);
  const first = loanSchedule(loanAmount, pur.loanRate, pur.loanYears, pur.method)[0];
  const annual = first?.payment ?? 0;
  const net = householdNet(plan, pur.year);
  const f = Math.pow(1 + plan.settings.inflationRate, pur.year - plan.settings.startYear);
  const r = simulate(p);
  return {
    price,
    loanAmount,
    monthlyPayment: annual / 12,
    repaymentRatio: net > 0 ? annual / net : Infinity,
    cashAtPurchase: pur.downPayment + price * pur.costRate * f * plan.settings.bufferRate,
    retireFinancial: r.summary.retireFinancial,
    finalFinancial: r.summary.finalFinancial,
  };
}

/** ok(price) が成り立つ最大の価格（STEP 刻み）。一度も成り立たなければ null */
function maxPrice(ok: (price: number) => boolean, lo: number): number | null {
  if (!ok(lo)) return null;
  let hi = MAX_PRICE;
  if (ok(hi)) return hi;
  while (hi - lo > STEP) {
    const mid = Math.round((lo + hi) / 2 / STEP) * STEP;
    if (mid <= lo || mid >= hi) break;
    if (ok(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

const noShortage = (plan: Plan, offset: number) => (price: number) =>
  simulate(withPurchasePrice(plan, price), { returnOffset: offset }).summary.shortageYear === null;

const man = (v: number) => `${Math.round(v / MAN).toLocaleString('ja-JP')}万円`;

export function assessAffordability(plan: Plan): Affordability {
  const pur = plan.housing.purchase;
  const purchaseAge = pur.year - plan.self.birthYear;
  const payoffAge = purchaseAge + pur.loanYears;
  const lo = Math.max(STEP, Math.ceil(pur.downPayment / STEP) * STEP);
  const net = householdNet(plan, pur.year);

  // 住宅を買わない場合（賃貸のまま等）でショートするか
  const noHouse = structuredClone(plan);
  noHouse.housing.purchase.enabled = false;
  const shortWithoutHouse = simulate(noHouse).summary.shortageYear !== null;

  const maxStd = maxPrice(noShortage(plan, 0), lo);
  const maxPes = maxPrice(noShortage(plan, -plan.settings.scenarioSpread), lo);

  // 返済負担率が目安以内になる最大価格
  const ratioOk = (price: number) => {
    const loanAmount = Math.max(0, price - Math.min(pur.downPayment, price));
    const first = loanSchedule(loanAmount, pur.loanRate, pur.loanYears, pur.method)[0];
    return net > 0 && (first?.payment ?? 0) / net <= SAFE_REPAYMENT_RATIO;
  };
  const maxRatio = maxPrice(ratioOk, lo);

  const safePrice = maxPes !== null && maxRatio !== null ? Math.min(maxPes, maxRatio) : null;

  let overLimitShortage: Affordability['overLimitShortage'] = null;
  if (maxStd !== null && maxStd < MAX_PRICE) {
    const s = simulate(withPurchasePrice(plan, maxStd + STEP)).summary;
    if (s.shortageYear !== null && s.shortageAge !== null) overLimitShortage = { year: s.shortageYear, age: s.shortageAge };
  }

  const result: Affordability = {
    purchaseYear: pur.year,
    purchaseAge,
    payoffAge,
    downPayment: pur.downPayment,
    netIncome: net,
    safe: safePrice !== null ? check(plan, safePrice) : null,
    max: maxStd !== null ? check(plan, maxStd) : null,
    ratioLimit: maxRatio !== null ? check(plan, maxRatio) : null,
    overLimitShortage,
    shortWithoutHouse,
    advice: [],
  };
  result.advice = buildAdvice(plan, result);
  return result;
}

function buildAdvice(plan: Plan, a: Affordability): string[] {
  const pur = plan.housing.purchase;
  const out: string[] = [];
  if (a.max === null) {
    out.push(
      a.shortWithoutHouse
        ? '住宅を買わなくても資金がショートする見込みです。まずは家計や積立の見直しを優先しましょう（ダッシュボードの改善提案を参照）。'
        : `${pur.year}年に頭金 ${man(pur.downPayment)} で購入すると、どの価格でも資金がショートします。購入時期を遅らせるか、頭金を減らして手元資金を残すことを検討しましょう。`,
    );
    return out;
  }
  if (a.safe) {
    out.push(
      `安心して買えるのは ${man(a.safe.price)} までです（運用がうまくいかない悲観シナリオでも資金が尽きず、返済が手取りの${Math.round(SAFE_REPAYMENT_RATIO * 100)}%以内）。`,
    );
  }
  const when = a.overLimitShortage ? `${a.overLimitShortage.year}年（${a.overLimitShortage.age}歳）ごろに` : '';
  out.push(`${man(a.max.price)} を超えると、標準シナリオでも${when}資金がショートします。これが上限です。`);
  if (a.safe && a.max.price - a.safe.price >= 500 * MAN) {
    out.push(
      `安心ラインと上限の間（${man(a.safe.price)}〜${man(a.max.price)}）は、運用が想定を下回ったり収入が減ったりすると苦しくなるゾーンです。`,
    );
  }
  if (a.payoffAge > 75) {
    out.push(
      `ローン完済が ${a.payoffAge}歳 になります。退職後も返済が続くため、退職金での繰上げ返済や、返済期間を短くすることも検討しましょう。`,
    );
  }
  if (a.max.cashAtPurchase > 0 && a.safe && a.safe.cashAtPurchase > 0) {
    out.push(
      `購入時には頭金と諸費用で約 ${man(a.safe.cashAtPurchase)} の現金が必要です。生活防衛資金が残るか確認しましょう。`,
    );
  }
  if (plan.housing.purchase.loanRate < 0.015) {
    out.push(
      `金利 ${(pur.loanRate * 100).toFixed(2)}% で試算しています。変動金利の場合は、金利が上がったとき（例：2%）でも払えるか、金利を変えて確認しておくと安心です。`,
    );
  }
  return out;
}
