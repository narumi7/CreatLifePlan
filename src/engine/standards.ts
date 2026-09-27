// 世間一般の費用（標準値）マスタ。計算時にはバッファ率（初期値 1.1）と物価上昇を掛ける。
// 金額は公的統計・業界調査の値（2026年9月時点で確認）。出典の最新版で随時見直すこと。

import type { LifeEvent, Nursery, SchoolType, University } from './types';

export const MAN = 10_000;

export const SOURCES = {
  education: '文部科学省「子供の学習費調査」（令和5年度）',
  university: '文部科学省「私立大学等の令和7年度入学者に係る学生納付金等調査」、国立大学の標準額',
  upbringing: '国立成育医療研究センター「0〜18歳の子育て費用調査（2024年）」を参考に概算',
  wedding: 'リクルート「結婚マーケット調査2025」',
  care: '生命保険文化センター「2024年度 生命保険に関する全国実態調査」',
  birth: '厚生労働省「出産費用の見える化」（2024年度 正常分娩の平均 約52万円）',
  funeral: '鎌倉新書「葬儀費用の実態と納得度調査（2025年）」',
  household: '総務省「家計調査」',
  pension: '日本年金機構「令和8年度の年金額」（老齢基礎年金 満額 月70,608円）',
} as const;

/** 学校教育費＋学校外活動費（年額）。無償化後の実額。 */
export const SCHOOL_COST: Record<'kindergarten' | 'elementary' | 'juniorHigh' | 'highSchool', Record<SchoolType, number>> = {
  kindergarten: { public: 18.5 * MAN, private: 34.7 * MAN },
  elementary: { public: 33.6 * MAN, private: 182.8 * MAN },
  juniorHigh: { public: 54.2 * MAN, private: 156.0 * MAN },
  highSchool: { public: 59.8 * MAN, private: 103.0 * MAN },
};

/** 保育園（0〜2歳の保育料は自治体・世帯収入で大きく変わるため目安の値）。3〜5歳は無償化後の実費。 */
export const HOIKUEN_UNDER3 = 42 * MAN;
export const HOIKUEN_3TO5 = 12 * MAN;

/** 無償化を反映しない場合に上乗せする額（年額） */
export const NO_SUPPORT_EXTRA = {
  preschool3to5: 30 * MAN,
  // 高等学校等就学支援金（2026年4月から所得制限なし）の上限額
  highSchool: { public: 11.88 * MAN, private: 45.72 * MAN } as Record<SchoolType, number>,
};

export const UNIVERSITY: Record<Exclude<University, 'none'>, { label: string; admission: number; annual: number; years: number }> = {
  vocational: { label: '専門学校', admission: 20 * MAN, annual: 110 * MAN, years: 2 },
  national: { label: '国公立大学', admission: 28.2 * MAN, annual: 53.6 * MAN, years: 4 },
  // 私立は令和7年度の初年度納付金（文系 121.2万・理系 160.2万・医歯系 477.9万円）から入学料を分けた値
  privateArts: { label: '私立文系', admission: 22.5 * MAN, annual: 99 * MAN, years: 4 },
  privateScience: { label: '私立理系', admission: 25 * MAN, annual: 135 * MAN, years: 4 },
  privateMedical: { label: '私立医歯系', admission: 100 * MAN, annual: 378 * MAN, years: 6 },
};

/** 下宿時の仕送り（年額） */
export const LIVING_AWAY_ALLOWANCE = 120 * MAN;

/** 教育費以外の養育費（食費・衣類・医療・お小遣い等、年額） */
export function upbringingCost(age: number): number {
  if (age < 0) return 0;
  if (age <= 5) return 55 * MAN;
  if (age <= 11) return 65 * MAN;
  if (age <= 14) return 75 * MAN;
  return 80 * MAN;
}

/** 出産費用と出産育児一時金 */
export const BIRTH_COST = 52 * MAN;
export const BIRTH_ALLOWANCE = 50 * MAN;

export const NURSERY_LABEL: Record<Nursery, string> = {
  home: '家庭保育',
  hoikuen: '保育園',
  kindergartenPublic: '公立幼稚園',
  kindergartenPrivate: '私立幼稚園',
};

export const SCHOOL_LABEL: Record<SchoolType, string> = { public: '公立', private: '私立' };

export const UNIVERSITY_LABEL: Record<University, string> = {
  none: '進学しない',
  vocational: UNIVERSITY.vocational.label,
  national: UNIVERSITY.national.label,
  privateArts: UNIVERSITY.privateArts.label,
  privateScience: UNIVERSITY.privateScience.label,
  privateMedical: UNIVERSITY.privateMedical.label,
};

/** 家計の標準値（2人以上世帯の平均を参考にした月額） */
export const STANDARD_BUDGET = {
  fixed: [
    { name: '水道光熱費', amount: 24_000 },
    { name: '通信費', amount: 12_000 },
    { name: '保険料', amount: 20_000 },
    { name: 'サブスク', amount: 3_000 },
  ],
  variable: [
    { name: '食費', amount: 80_000 },
    { name: '日用品', amount: 10_000 },
    { name: '交通費', amount: 8_000 },
    { name: '被服', amount: 8_000 },
    { name: '医療費', amount: 12_000 },
    { name: '交際費', amount: 15_000 },
    { name: '趣味・娯楽', amount: 25_000 },
  ],
  special: [
    { name: '帰省・冠婚葬祭', amount: 15 * MAN },
    { name: '家電・家具の買替', amount: 10 * MAN },
  ],
};

export type EventTemplate = {
  key: string;
  label: string;
  icon: string;
  build: (year: number) => Omit<LifeEvent, 'id'>[];
};

const ev = (e: Partial<Omit<LifeEvent, 'id'>> & Pick<LifeEvent, 'name' | 'year' | 'amount'>): Omit<LifeEvent, 'id'> => ({
  icon: '📌',
  kind: 'expense',
  repeatEvery: 0,
  endYear: e.year,
  buffer: true,
  inflate: true,
  ...e,
});

export const EVENT_TEMPLATES: EventTemplate[] = [
  {
    key: 'wedding',
    label: '結婚',
    icon: '💍',
    build: (y) => [
      ev({ name: '結婚式・披露宴', icon: '💍', year: y, amount: 300 * MAN }),
      ev({ name: '新生活準備', icon: '💍', year: y, amount: 50 * MAN }),
      ev({ name: 'ご祝儀', icon: '💍', year: y, amount: 187 * MAN, kind: 'income', buffer: false }),
    ],
  },
  {
    key: 'car',
    label: '車の購入（10年ごと）',
    icon: '🚗',
    build: (y) => [ev({ name: '車の購入', icon: '🚗', year: y, amount: 300 * MAN, repeatEvery: 10, endYear: y + 30 })],
  },
  { key: 'moving', label: '引越し', icon: '📦', build: (y) => [ev({ name: '引越し', icon: '📦', year: y, amount: 30 * MAN })] },
  { key: 'reform', label: 'リフォーム', icon: '🔨', build: (y) => [ev({ name: 'リフォーム', icon: '🔨', year: y, amount: 300 * MAN })] },
  {
    key: 'travel',
    label: '家族旅行（毎年）',
    icon: '✈️',
    build: (y) => [ev({ name: '家族旅行', icon: '✈️', year: y, amount: 30 * MAN, repeatEvery: 1, endYear: y + 20 })],
  },
  {
    key: 'childWedding',
    label: '子供の結婚援助',
    icon: '🎁',
    build: (y) => [ev({ name: '子供の結婚援助', icon: '🎁', year: y, amount: 180 * MAN })],
  },
  {
    key: 'care',
    label: '介護（親・自分）',
    icon: '🧓',
    build: (y) => [
      ev({ name: '介護 一時費用', icon: '🧓', year: y, amount: 47 * MAN }),
      // 月9.0万円 × 平均55か月（4年7か月）を、年108万円 × 5年として計上
      ev({ name: '介護 月額費用', icon: '🧓', year: y, amount: 108 * MAN, repeatEvery: 1, endYear: y + 4 }),
    ],
  },
  { key: 'funeral', label: '葬儀・お墓', icon: '🕯️', build: (y) => [ev({ name: '葬儀・お墓', icon: '🕯️', year: y, amount: 118.5 * MAN })] },
  {
    key: 'inheritance',
    label: '相続・贈与（収入）',
    icon: '💴',
    build: (y) => [ev({ name: '相続', icon: '💴', year: y, amount: 500 * MAN, kind: 'income', buffer: false, inflate: false })],
  },
  { key: 'custom', label: '自由入力', icon: '📌', build: (y) => [ev({ name: '新しいイベント', year: y, amount: 100 * MAN, buffer: false })] },
];

/** 年金 */
export const BASIC_PENSION_FULL = 847_300; // 老齢基礎年金 満額（令和8年度・年額）
export const PENSION_EARNINGS_RATE = 5.481 / 1000; // 報酬比例部分の乗率
export const PENSION_NET_RATIO = 0.9; // 年金にかかる税・社会保険料を差し引いた手取り割合（概算）

/** 児童手当（月額） */
export const CHILD_ALLOWANCE = { under3: 15_000, over3: 10_000, thirdOrLater: 30_000 };

/** NISA / iDeCo の上限 */
export const NISA_ANNUAL_LIMIT = 3_600_000;
export const NISA_LIFETIME_LIMIT = 18_000_000;
// iDeCo の掛金上限（月額）。2027年1月から会社員・公務員 6.2万円、自営業 7.5万円に引き上げ、加入は70歳まで。
// 会社員・公務員は企業年金などの掛金と合算の上限のため、それらがある場合は実際の上限はもっと少ない。
export const IDECO_REFORM_YEAR = 2027;
const IDECO_LIMIT_BEFORE: Record<string, number> = { employee: 23_000, civilServant: 20_000, selfEmployed: 68_000, none: 23_000 };
const IDECO_LIMIT_AFTER: Record<string, number> = { employee: 62_000, civilServant: 62_000, selfEmployed: 75_000, none: 23_000 };
export function idecoMonthlyLimit(employment: string, year: number): number {
  const table = year >= IDECO_REFORM_YEAR ? IDECO_LIMIT_AFTER : IDECO_LIMIT_BEFORE;
  return table[employment] ?? 23_000;
}
export function idecoContribEndAge(year: number): number {
  return year >= IDECO_REFORM_YEAR ? 70 : 65;
}
export const IDECO_WITHDRAW_AGE = 60;

/** 特定口座の譲渡益課税 */
export const CAPITAL_GAINS_TAX = 0.20315;
