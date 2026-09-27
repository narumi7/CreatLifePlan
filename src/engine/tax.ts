// 額面年収 → 手取りの概算（所得税・住民税・社会保険料）。令和8年（2026年）分の税制で計算する。
// 配偶者控除・扶養控除・医療費控除などは考慮しない簡易計算。
// 将来は基礎控除などが物価に連動して引き上げられる仕組みになったが、ここでは考慮しない（保守的な計算）。

import type { Employment } from './types';

export interface TakeHome {
  gross: number;
  socialInsurance: number;
  incomeTax: number;
  residentTax: number;
  net: number;
}

/**
 * 給与所得控除。最低保障額は 69万円（令和8・9年分の所得税は特例で 74万円）。
 * minimum を省略すると所得税用（74万円）で計算する。
 */
export function employmentDeduction(gross: number, minimum = 740_000): number {
  let d: number;
  if (gross <= 3_600_000) d = gross * 0.3 + 80_000;
  else if (gross <= 6_600_000) d = gross * 0.2 + 440_000;
  else if (gross <= 8_500_000) d = gross * 0.1 + 1_100_000;
  else d = 1_950_000;
  return Math.min(gross, Math.max(minimum, d));
}

/** 所得税の基礎控除（令和8年分以降。特例の上乗せを含む） */
function basicDeductionIncomeTax(income: number): number {
  if (income <= 4_890_000) return 1_040_000;
  if (income <= 6_550_000) return 670_000;
  if (income <= 23_500_000) return 620_000;
  if (income <= 24_000_000) return 480_000;
  if (income <= 24_500_000) return 320_000;
  if (income <= 25_000_000) return 160_000;
  return 0;
}

/** 所得税（復興特別所得税 2.1% を含む） */
export function incomeTaxOn(taxable: number): number {
  const t = Math.max(0, Math.floor(taxable / 1000) * 1000);
  const brackets: [number, number, number][] = [
    [1_950_000, 0.05, 0],
    [3_300_000, 0.1, 97_500],
    [6_950_000, 0.2, 427_500],
    [9_000_000, 0.23, 636_000],
    [18_000_000, 0.33, 1_536_000],
    [40_000_000, 0.4, 2_796_000],
    [Infinity, 0.45, 4_796_000],
  ];
  for (const [limit, rate, ded] of brackets) {
    if (t <= limit) return Math.max(0, t * rate - ded) * 1.021;
  }
  return 0;
}

export function socialInsurance(gross: number, employment: Employment, age: number): number {
  if (employment === 'selfEmployed') {
    const nationalPension = age < 60 ? 17_920 * 12 : 0; // 国民年金保険料（令和8年度）
    const nhi = Math.min(Math.max(0, gross - 430_000) * 0.1, 1_060_000);
    return nationalPension + nhi;
  }
  if (employment === 'none') return 0;
  // 健康保険 5%＋子ども・子育て支援金（2026年度から段階的に導入、本人負担 約0.2%で見込む）
  const health = Math.min(gross, 16_000_000) * 0.052;
  const care = age >= 40 && age < 65 ? Math.min(gross, 16_000_000) * 0.008 : 0;
  const pension = Math.min(gross, 9_000_000) * 0.0915;
  const employmentIns = gross * 0.0055;
  return health + care + pension + employmentIns;
}

export function takeHome(gross: number, employment: Employment, age: number): TakeHome {
  if (gross <= 0) return { gross: 0, socialInsurance: 0, incomeTax: 0, residentTax: 0, net: 0 };
  const si = socialInsurance(gross, employment, age);
  // 自営業は青色申告特別控除 65万円を想定し、給与所得控除の代わりとする
  const self = employment === 'selfEmployed';
  const income = self ? Math.max(0, gross - 650_000) : Math.max(0, gross - employmentDeduction(gross));
  const incomeTax = incomeTaxOn(income - si - basicDeductionIncomeTax(income));
  // 住民税は給与所得控除の最低保障額 69万円・基礎控除 43万円
  const residentIncome = self ? income : Math.max(0, gross - employmentDeduction(gross, 690_000));
  const residentTaxable = Math.max(0, residentIncome - si - 430_000);
  const residentTax = residentTaxable > 0 ? residentTaxable * 0.1 + 5_000 : 0;
  const net = gross - si - incomeTax - residentTax;
  return { gross, socialInsurance: si, incomeTax, residentTax, net };
}
