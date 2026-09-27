import { MAN, STANDARD_BUDGET } from './standards';
import type { BudgetItem, Child, InvestAccount, Person, Plan } from './types';

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export function defaultPerson(birthYear: number, name: string): Person {
  return {
    name,
    birthYear,
    employment: 'employee',
    income: {
      mode: 'gross',
      annualGross: 500 * MAN,
      annualNet: 390 * MAN,
      raiseRate: 0.015,
      raiseUntilAge: 50,
      retirementAge: 60,
      reemployment: true,
      reemploymentUntilAge: 65,
      reemploymentRatio: 0.7,
      severancePay: 1000 * MAN,
      workStartAge: 22,
      changes: [],
    },
    pension: { mode: 'auto', annualAmount: 180 * MAN, startAge: 65 },
  };
}

export function defaultChild(birthYear: number, name: string): Child {
  return {
    id: uid(),
    name,
    birthYear,
    nursery: 'hoikuen',
    elementary: 'public',
    juniorHigh: 'public',
    highSchool: 'public',
    university: 'privateArts',
    livingAway: false,
    extraAnnual: 20 * MAN,
    includeLivingCost: true,
  };
}

export const standardBudgetItems = (kind: 'fixed' | 'variable' | 'special'): BudgetItem[] =>
  STANDARD_BUDGET[kind].map((i) => ({ id: uid(), name: i.name, amount: i.amount, buffer: true }));

export function defaultAccount(type: InvestAccount['type'], age: number): InvestAccount {
  const names = { nisa: 'NISA', ideco: 'iDeCo', taxable: '特定口座' };
  return {
    id: uid(),
    name: names[type],
    type,
    owner: 'self',
    balance: 0,
    principal: 0,
    monthly: type === 'ideco' ? 23_000 : 30_000,
    contribStartAge: age,
    contribEndAge: type === 'ideco' ? 65 : 60,
    expectedReturn: 0.04,
  };
}

export function defaultPlan(now = new Date()): Plan {
  const year = now.getFullYear();
  const selfBirth = year - 30;
  return {
    version: 1,
    settings: {
      startYear: year,
      endAge: 100,
      inflationRate: 0.015,
      bufferRate: 1.1,
      pensionSlide: 0.005,
      scenarioSpread: 0.02,
      publicSupport: true,
    },
    self: defaultPerson(selfBirth, '本人'),
    spouse: (() => {
      const sp = { ...defaultPerson(selfBirth, '配偶者'), enabled: true };
      sp.income = { ...sp.income, annualGross: 400 * MAN, annualNet: 315 * MAN, severancePay: 500 * MAN };
      return sp;
    })(),
    children: [],
    otherIncomes: [],
    budget: {
      fixed: standardBudgetItems('fixed'),
      variable: standardBudgetItems('variable'),
      special: standardBudgetItems('special'),
      retirementRatio: 0.7,
    },
    housing: {
      currentType: 'rent',
      rentMonthly: 90_000,
      rentInflation: false,
      existingLoan: { balance: 0, rate: 0.01, remainingYears: 30, method: 'equalPayment' },
      ownPropertyTax: 12 * MAN,
      ownMaintenance: 30 * MAN,
      purchase: {
        enabled: false,
        year: year + 5,
        price: 4500 * MAN,
        downPayment: 500 * MAN,
        costRate: 0.08,
        loanRate: 0.01,
        loanYears: 35,
        method: 'equalPayment',
        propertyTax: 15 * MAN,
        maintenance: 30 * MAN,
        loanDeduction: true,
        deductionCap: 3000 * MAN,
        deductionYears: 13,
      },
    },
    assets: {
      cash: 300 * MAN,
      cashRate: 0.002,
      accounts: [defaultAccount('nisa', year - selfBirth)],
      emergencyMonths: 6,
      autoCover: true,
      withdrawal: { mode: 'none', startAge: 65, monthlyAmount: 10 * MAN, rate: 0.04 },
    },
    events: [],
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** 既定値と深くマージする（古い保存データに新しい項目を補う） */
function mergeDefaults<T>(def: T, value: unknown): T {
  if (!isObject(def) || !isObject(value)) {
    if (value === undefined || value === null) return def;
    if (typeof def !== typeof value) return def;
    if (Array.isArray(def) !== Array.isArray(value)) return def;
    return value as T;
  }
  const out: Record<string, unknown> = { ...(def as Record<string, unknown>) };
  for (const k of Object.keys(value)) {
    out[k] = k in out ? mergeDefaults(out[k], value[k]) : value[k];
  }
  return out as T;
}

export function normalizePlan(raw: unknown): Plan {
  const def = defaultPlan();
  const plan = mergeDefaults(def, raw);
  plan.version = 1;
  return plan;
}
