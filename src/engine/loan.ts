import type { LoanMethod } from './types';

export interface LoanYear {
  payment: number; // その年の返済額
  interest: number;
  endBalance: number; // 年末残高
}

/** 月次返済で計算し、年単位に集計したローン返済表 */
export function loanSchedule(principal: number, annualRate: number, years: number, method: LoanMethod): LoanYear[] {
  const result: LoanYear[] = [];
  if (principal <= 0 || years <= 0) return result;
  const n = Math.round(years * 12);
  const r = annualRate / 12;
  const equalPayment = r === 0 ? principal / n : (principal * r) / (1 - Math.pow(1 + r, -n));
  const principalPart = principal / n;
  let balance = principal;
  let year: LoanYear = { payment: 0, interest: 0, endBalance: balance };
  for (let m = 0; m < n; m++) {
    const interest = balance * r;
    const pay = method === 'equalPayment' ? equalPayment : principalPart + interest;
    balance = Math.max(0, balance + interest - pay);
    year.payment += pay;
    year.interest += interest;
    year.endBalance = balance;
    if (m % 12 === 11 || m === n - 1) {
      result.push(year);
      year = { payment: 0, interest: 0, endBalance: balance };
    }
  }
  return result;
}
