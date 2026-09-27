// 額面年収 → 手取りの概算（所得税・住民税・社会保険料）。
// 配偶者控除・扶養控除・医療費控除などは考慮しない簡易計算。

import type { Employment } from './types';

export interface TakeHome {
  gross: number;
  socialInsurance: number;
  incomeTax: number;
  residentTax: number;
  net: number;
}

/** 給与所得控除（2025年分以降） */
export function employmentDeduction(gross: number): number {
  if (gross <= 1_900_000) return Math.min(gross, 650_000);
  if (gross <= 3_600_000) return gross * 0.3 + 80_000;
  if (gross <= 6_600_000) return gross * 0.2 + 440_000;
  if (gross <= 8_500_000) return gross * 0.1 + 1_100_000;
  return 1_950_000;
}

/** 所得税の基礎控除（2025年分以降の特例を含む） */
function basicDeductionIncomeTax(income: number): number {
  if (income <= 1_320_000) return 950_000;
  if (income <= 3_360_000) return 880_000;
  if (income <= 4_890_000) return 680_000;
  if (income <= 6_550_000) return 630_000;
  if (income <= 23_500_000) return 580_000;
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
    const nationalPension = age < 60 ? 17_510 * 12 : 0;
    const nhi = Math.min(Math.max(0, gross - 430_000) * 0.1, 1_060_000);
    return nationalPension + nhi;
  }
  if (employment === 'none') return 0;
  const health = Math.min(gross, 16_000_000) * 0.05;
  const care = age >= 40 && age < 65 ? Math.min(gross, 16_000_000) * 0.008 : 0;
  const pension = Math.min(gross, 9_000_000) * 0.0915;
  const employmentIns = gross * 0.0055;
  return health + care + pension + employmentIns;
}

export function takeHome(gross: number, employment: Employment, age: number): TakeHome {
  if (gross <= 0) return { gross: 0, socialInsurance: 0, incomeTax: 0, residentTax: 0, net: 0 };
  const si = socialInsurance(gross, employment, age);
  // 自営業は青色申告特別控除 65万円を想定し、給与所得控除の代わりとする
  const income = employment === 'selfEmployed' ? Math.max(0, gross - 650_000) : Math.max(0, gross - employmentDeduction(gross));
  const incomeTax = incomeTaxOn(income - si - basicDeductionIncomeTax(income));
  const residentTaxable = Math.max(0, income - si - 430_000);
  const residentTax = residentTaxable > 0 ? residentTaxable * 0.1 + 5_000 : 0;
  const net = gross - si - incomeTax - residentTax;
  return { gross, socialInsurance: si, incomeTax, residentTax, net };
}
