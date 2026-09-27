// ライフプランの入力データ（1プラン分）。金額はすべて「円」、率は小数（1.5% = 0.015）。
// 将来の金額は特記がない限り「今の物価での金額」で入力し、計算時に物価上昇を掛ける。

export type Employment = 'employee' | 'civilServant' | 'selfEmployed' | 'none';

export interface IncomeChange {
  id: string;
  label: string;
  startYear: number;
  endYear: number; // この年まで（含む）
  ratio: number; // 手取り給与に掛ける倍率（育休 0.75 など）
}

export interface PersonIncome {
  mode: 'gross' | 'net'; // 額面から自動計算 or 手取り直接入力
  annualGross: number;
  annualNet: number;
  raiseRate: number; // 昇給率（名目）
  raiseUntilAge: number; // この年齢で昇給が止まる
  retirementAge: number; // 定年
  reemployment: boolean;
  reemploymentUntilAge: number;
  reemploymentRatio: number; // 定年前年収に対する倍率
  severancePay: number; // 退職金（手取り、定年の年に受取）
  workStartAge: number; // 就職年齢（年金の概算に使用）
  changes: IncomeChange[];
}

export interface Pension {
  mode: 'auto' | 'manual';
  annualAmount: number; // manual: ねんきん定期便の65歳時点見込額（年額・額面）
  startAge: number; // 受給開始年齢（60〜75）
}

export interface Person {
  name: string;
  birthYear: number;
  employment: Employment;
  income: PersonIncome;
  pension: Pension;
}

export type Nursery = 'home' | 'hoikuen' | 'kindergartenPublic' | 'kindergartenPrivate';
export type SchoolType = 'public' | 'private';
export type University =
  | 'none'
  | 'vocational'
  | 'national'
  | 'privateArts'
  | 'privateScience'
  | 'privateMedical';

export interface Child {
  id: string;
  name: string;
  birthYear: number;
  nursery: Nursery;
  elementary: SchoolType;
  juniorHigh: SchoolType;
  highSchool: SchoolType;
  university: University;
  livingAway: boolean; // 大学等で下宿（仕送り）
  extraAnnual: number; // 塾・習い事など（年額、6〜17歳）
  includeLivingCost: boolean; // 生活費としての養育費を計上（既に家計に含むなら OFF）
}

export interface BudgetItem {
  id: string;
  name: string;
  amount: number; // fixed/variable: 月額、special: 年額
  buffer: boolean; // バッファ（×1.1）を掛けるか
}

export interface Budget {
  fixed: BudgetItem[];
  variable: BudgetItem[];
  special: BudgetItem[];
  retirementRatio: number; // 老後の生活費 = 現役時 × この倍率
}

export type LoanMethod = 'equalPayment' | 'equalPrincipal';

export interface Housing {
  currentType: 'rent' | 'own';
  rentMonthly: number;
  rentInflation: boolean;
  existingLoan: { balance: number; rate: number; remainingYears: number; method: LoanMethod };
  ownPropertyTax: number; // 年額
  ownMaintenance: number; // 年額（管理費・修繕積立・修繕費）
  purchase: {
    enabled: boolean;
    year: number;
    price: number;
    downPayment: number;
    costRate: number; // 諸費用率
    loanRate: number;
    loanYears: number;
    method: LoanMethod;
    propertyTax: number;
    maintenance: number;
    loanDeduction: boolean; // 住宅ローン控除
    deductionCap: number; // 控除対象の借入限度額
    deductionYears: number;
  };
}

export type AccountType = 'nisa' | 'ideco' | 'taxable';

export interface InvestAccount {
  id: string;
  name: string;
  type: AccountType;
  owner: 'self' | 'spouse';
  balance: number; // 現在の評価額
  principal: number; // 現在の元本
  monthly: number; // 毎月の積立額
  contribStartAge: number;
  contribEndAge: number; // この年齢になったら積立終了
  expectedReturn: number;
}

export interface Assets {
  cash: number;
  cashRate: number;
  accounts: InvestAccount[];
  emergencyMonths: number; // 生活防衛資金（生活費の◯か月分）
  autoCover: boolean; // 現金不足時に投資から取り崩す
  withdrawal: {
    mode: 'none' | 'fixed' | 'rate';
    startAge: number;
    monthlyAmount: number; // fixed: 今の物価での月額
    rate: number; // rate: 年率
  };
}

export interface LifeEvent {
  id: string;
  name: string;
  icon: string;
  kind: 'expense' | 'income';
  year: number;
  amount: number; // 1回あたり（今の物価）
  repeatEvery: number; // 0 = 1回のみ
  endYear: number; // 繰り返しの最終年
  buffer: boolean;
  inflate: boolean;
}

export interface OtherIncome {
  id: string;
  name: string;
  annualAmount: number; // 手取り年額
  startYear: number;
  endYear: number;
}

export interface Settings {
  startYear: number;
  endAge: number;
  inflationRate: number;
  bufferRate: number;
  pensionSlide: number; // 年金の実質目減り（物価上昇 − この値 で年金が増える）
  scenarioSpread: number; // 楽観/悲観シナリオの利回り差
  publicSupport: boolean; // 幼保・高校無償化を反映
}

export interface Plan {
  version: 1;
  settings: Settings;
  self: Person;
  spouse: Person & { enabled: boolean };
  children: Child[];
  otherIncomes: OtherIncome[];
  budget: Budget;
  housing: Housing;
  assets: Assets;
  events: LifeEvent[];
}
