// Excel（.xlsx）出力。Google スプレッドシートにアップロードしても開ける形式。
// ファイルはブラウザ内で生成してダウンロードするだけで、外部には送信しない。

import type { Workbook, Worksheet } from 'exceljs';
import { monthlyBudget, SCENARIO_LABEL, type Judgement, type Scenarios, type Suggestion } from '../engine/analysis';
import { estimatePension65, finalWorkAge } from '../engine/simulate';
import {
  BIRTH_COST,
  HOIKUEN_3TO5,
  HOIKUEN_UNDER3,
  LIVING_AWAY_ALLOWANCE,
  SCHOOL_COST,
  SOURCES,
  UNIVERSITY,
  upbringingCost,
} from '../engine/standards';
import type { Plan } from '../engine/types';
import { CF_COLUMNS } from '../ui/cfColumns';

const YEN = '#,##0';
const PCT = '0.0%';
const HEAD_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FB' } } as const;

function header(ws: Worksheet, values: string[]) {
  const row = ws.addRow(values);
  row.font = { bold: true };
  row.eachCell((c) => {
    c.fill = HEAD_FILL;
    c.border = { bottom: { style: 'thin' } };
  });
  return row;
}

function kv(ws: Worksheet, rows: [string, string | number, string?][]) {
  for (const [k, v, fmt] of rows) {
    const r = ws.addRow([k, v]);
    if (fmt) r.getCell(2).numFmt = fmt;
    r.getCell(1).font = { bold: true };
  }
}

export interface ExportInput {
  name: string;
  plan: Plan;
  scenarios: Scenarios;
  judgement: Judgement;
  suggestions: Suggestion[];
}

export async function buildWorkbook({ name, plan, scenarios, judgement, suggestions }: ExportInput): Promise<Workbook> {
  const mod = await import('exceljs');
  const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CreatLifePlan';
  wb.created = new Date();
  const std = scenarios.standard;
  const s = std.summary;
  const B = plan.settings.bufferRate;

  // ---- サマリー ----
  const sum = wb.addWorksheet('サマリー');
  sum.columns = [{ width: 32 }, { width: 60 }];
  sum.addRow([`ライフプラン：${name}`]).font = { bold: true, size: 14 };
  sum.addRow([`作成日：${new Date().toLocaleDateString('ja-JP')}`]);
  sum.addRow([]);
  kv(sum, [
    ['判定', judgement.title],
    ...judgement.reasons.map((r, i) => [i === 0 ? '理由' : '', r] as [string, string]),
    ['資金ショート（標準）', s.shortageYear ? `${s.shortageYear}年（${s.shortageAge}歳）` : 'なし'],
    [`退職時（${finalWorkAge(plan.self)}歳）の金融資産`, Math.round(s.retireFinancial), YEN],
    [`${plan.settings.endAge}歳時点の金融資産`, Math.round(s.finalFinancial), YEN],
    ['金融資産が最も少ない年', `${s.minFinancialYear}年（${Math.round(s.minFinancial).toLocaleString()}円）`],
  ]);
  sum.addRow([]);
  header(sum, ['シナリオ', `${plan.settings.endAge}歳時点の金融資産`]);
  (Object.keys(SCENARIO_LABEL) as (keyof typeof SCENARIO_LABEL)[]).forEach((k) => {
    const r = sum.addRow([`${SCENARIO_LABEL[k]}（資金ショート: ${scenarios[k].summary.shortageYear ?? 'なし'}）`, Math.round(scenarios[k].summary.finalFinancial)]);
    r.getCell(2).numFmt = YEN;
  });
  if (suggestions.length) {
    sum.addRow([]);
    header(sum, ['改善提案', '内容']);
    suggestions.forEach((x) => sum.addRow([x.title, x.detail]));
  }
  if (std.warnings.length) {
    sum.addRow([]);
    header(sum, ['注意', '']);
    std.warnings.forEach((w) => sum.addRow(['', w]));
  }

  // ---- 前提条件 ----
  const pre = wb.addWorksheet('前提条件');
  pre.columns = [{ width: 34 }, { width: 22 }, { width: 22 }];
  header(pre, ['項目', '値', '']);
  const st = plan.settings;
  kv(pre, [
    ['開始年', st.startYear],
    ['シミュレーション終了年齢', st.endAge],
    ['物価上昇率', st.inflationRate, PCT],
    ['バッファ率（標準費用に掛ける倍率）', B],
    ['年金のマクロ経済スライド', st.pensionSlide, PCT],
    ['シナリオの利回り差（±）', st.scenarioSpread, PCT],
    ['幼保・高校無償化を反映', st.publicSupport ? 'する' : 'しない'],
  ]);
  pre.addRow([]);
  header(pre, ['家族・収入', plan.self.name, plan.spouse.enabled ? plan.spouse.name : '（配偶者なし）']);
  const people = plan.spouse.enabled ? [plan.self, plan.spouse] : [plan.self];
  const line = (label: string, get: (p: (typeof people)[number]) => string | number, fmt?: string) => {
    const r = pre.addRow([label, ...people.map(get)]);
    if (fmt) people.forEach((_, i) => (r.getCell(i + 2).numFmt = fmt));
  };
  line('生まれ年', (p) => p.birthYear);
  line('年収（額面/手取り）', (p) => (p.income.mode === 'gross' ? p.income.annualGross : p.income.annualNet), YEN);
  line('入力方法', (p) => (p.income.mode === 'gross' ? '額面' : '手取り'));
  line('昇給率', (p) => p.income.raiseRate, PCT);
  line('昇給が止まる年齢', (p) => p.income.raiseUntilAge);
  line('定年', (p) => p.income.retirementAge);
  line('再雇用', (p) => (p.income.reemployment ? `${p.income.reemploymentUntilAge}歳まで（${Math.round(p.income.reemploymentRatio * 100)}%）` : 'なし'));
  line('退職金', (p) => p.income.severancePay, YEN);
  line('年金見込額（65歳・額面・年額）', (p) => Math.round(estimatePension65(p, st)), YEN);
  line('年金受給開始年齢', (p) => p.pension.startAge);
  pre.addRow([]);
  header(pre, ['住まい', '', '']);
  const h = plan.housing;
  kv(pre, [
    ['現在', h.currentType === 'rent' ? `賃貸（月${h.rentMonthly.toLocaleString()}円）` : '持ち家'],
    ['住宅購入', h.purchase.enabled ? `${h.purchase.year}年 ${h.purchase.price.toLocaleString()}円（頭金 ${h.purchase.downPayment.toLocaleString()}円）` : 'なし'],
    ...(h.purchase.enabled
      ? ([
          ['ローン', `金利 ${(h.purchase.loanRate * 100).toFixed(2)}% / ${h.purchase.loanYears}年`],
        ] as [string, string][])
      : []),
  ]);
  pre.addRow([]);
  header(pre, ['投資口座', '毎月の積立', '想定利回り']);
  plan.assets.accounts.forEach((a) => {
    const r = pre.addRow([`${a.name}（${a.contribStartAge}〜${a.contribEndAge}歳）`, a.monthly, a.expectedReturn]);
    r.getCell(2).numFmt = YEN;
    r.getCell(3).numFmt = PCT;
  });
  kv(pre, [
    ['現在の預貯金', plan.assets.cash, YEN],
    ['生活防衛資金', `${plan.assets.emergencyMonths}か月分`],
  ]);

  // ---- 月次家計 ----
  const mb = monthlyBudget(plan, std);
  const mon = wb.addWorksheet('月次家計');
  mon.columns = [{ width: 30 }, { width: 16 }, { width: 12 }, { width: 16 }];
  header(mon, ['項目', '月額（円）', '', '']);
  const flow: [string, number][] = [
    ['手取り収入', mb.takeHome],
    ['児童手当', mb.childAllowance],
    ['住居費', -mb.housing],
    ['固定費', -mb.fixed],
    ['特別費（月割り）', -mb.special],
    ['積立投資', -mb.investment],
    ['変動費に使える額', mb.variableBudget],
    ['変動費', -mb.variable],
    ['自由に使える余裕', mb.free],
  ];
  flow.forEach(([k, v]) => (mon.addRow([k, Math.round(v)]).getCell(2).numFmt = YEN));
  mon.addRow([]);
  header(mon, ['内訳', '入力額（円）', 'バッファ', 'バッファ込み（円）']);
  (['fixed', 'variable', 'special'] as const).forEach((kind) => {
    const title = { fixed: '【固定費・月額】', variable: '【変動費・月額】', special: '【特別費・年額】' }[kind];
    mon.addRow([title]).font = { bold: true };
    plan.budget[kind].forEach((i) => {
      const r = mon.addRow([i.name, i.amount, i.buffer ? `×${B}` : '', Math.round(i.amount * (i.buffer ? B : 1))]);
      r.getCell(2).numFmt = YEN;
      r.getCell(4).numFmt = YEN;
    });
  });

  // ---- キャッシュフロー表 ----
  const cf = wb.addWorksheet('キャッシュフロー表', { views: [{ state: 'frozen', xSplit: 2, ySplit: 1 }] });
  const childCols = plan.children.map((c) => `${c.name}の年齢`);
  const cols = ['年', `${plan.self.name}の年齢`, ...(plan.spouse.enabled ? [`${plan.spouse.name}の年齢`] : []), ...childCols, 'イベント', ...CF_COLUMNS.map((c) => c.label), '物価指数'];
  header(cf, cols);
  cf.columns = cols.map((c, i) => ({ width: i === 0 ? 8 : c === 'イベント' ? 36 : Math.max(10, c.length * 2 + 2) }));
  const fixedCount = cols.length - CF_COLUMNS.length - 1;
  std.rows.forEach((r) => {
    const values = [
      r.year,
      r.ageSelf,
      ...(plan.spouse.enabled ? [r.ageSpouse] : []),
      ...plan.children.map((c) => {
        const a = r.year - c.birthYear;
        return a >= 0 && a <= 25 ? a : '';
      }),
      r.eventLabels.join(' / '),
      ...CF_COLUMNS.map((c) => Math.round(c.get(r))),
      Math.round(r.deflator * 1000) / 1000,
    ];
    const row = cf.addRow(values);
    for (let i = fixedCount + 1; i <= fixedCount + CF_COLUMNS.length; i++) {
      const cell = row.getCell(i);
      cell.numFmt = YEN;
      if (typeof cell.value === 'number' && cell.value < 0) cell.font = { color: { argb: 'FFD03B3B' } };
    }
    if (r.shortage) row.getCell(1).font = { bold: true, color: { argb: 'FFD03B3B' } };
  });
  CF_COLUMNS.forEach((c, i) => {
    if (c.bold) cf.getColumn(fixedCount + 1 + i).font = { bold: true };
  });

  // ---- 教育費 ----
  const edu = wb.addWorksheet('教育費');
  edu.columns = [{ width: 8 }, { width: 14 }, { width: 8 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }];
  header(edu, ['年', '子供', '年齢', '段階', '教育費・出産（円）', '養育費（円）', '合計（円）']);
  std.rows.forEach((r) =>
    r.children
      .filter((c) => c.age >= 0 && c.stage !== '独立')
      .forEach((c) => {
        const row = edu.addRow([r.year, c.name, c.age, c.stage, Math.round(c.education + c.birth), Math.round(c.living), Math.round(c.education + c.birth + c.living)]);
        [5, 6, 7].forEach((i) => (row.getCell(i).numFmt = YEN));
      }),
  );

  // ---- ライフイベント ----
  const ev = wb.addWorksheet('ライフイベント');
  ev.columns = [{ width: 24 }, { width: 8 }, { width: 8 }, { width: 16 }, { width: 14 }, { width: 10 }, { width: 10 }];
  header(ev, ['イベント', '種類', '年', '金額（今の物価）', '繰り返し', 'バッファ', '物価上昇']);
  [...plan.events]
    .sort((a, b) => a.year - b.year)
    .forEach((e) => {
      const r = ev.addRow([
        `${e.icon} ${e.name}`,
        e.kind === 'income' ? '収入' : '支出',
        e.year,
        e.amount,
        e.repeatEvery > 0 ? `${e.repeatEvery}年ごと〜${e.endYear}年` : '1回',
        e.kind === 'expense' && e.buffer ? `×${B}` : '',
        e.inflate ? 'あり' : 'なし',
      ]);
      r.getCell(4).numFmt = YEN;
    });

  // ---- シナリオ比較 ----
  const sc = wb.addWorksheet('シナリオ比較');
  sc.columns = [{ width: 8 }, { width: 8 }, { width: 18 }, { width: 18 }, { width: 18 }];
  header(sc, ['年', '年齢', '楽観 金融資産', '標準 金融資産', '悲観 金融資産']);
  std.rows.forEach((r, i) => {
    const row = sc.addRow([
      r.year,
      r.ageSelf,
      Math.round(scenarios.optimistic.rows[i].financial),
      Math.round(r.financial),
      Math.round(scenarios.pessimistic.rows[i].financial),
    ]);
    [3, 4, 5].forEach((c) => (row.getCell(c).numFmt = YEN));
  });

  // ---- 標準費用マスタ ----
  const ms = wb.addWorksheet('標準費用マスタ');
  ms.columns = [{ width: 32 }, { width: 16 }, { width: 18 }, { width: 50 }];
  header(ms, ['項目', '標準値（円/年）', `×${B}（円/年）`, '出典']);
  const master: [string, number, string][] = [
    ['保育園（0〜2歳）', HOIKUEN_UNDER3, '世帯収入で変動'],
    ['保育園（3〜5歳・無償化後）', HOIKUEN_3TO5, ''],
    ['幼稚園 公立', SCHOOL_COST.kindergarten.public, SOURCES.education],
    ['幼稚園 私立', SCHOOL_COST.kindergarten.private, SOURCES.education],
    ['小学校 公立', SCHOOL_COST.elementary.public, SOURCES.education],
    ['小学校 私立', SCHOOL_COST.elementary.private, SOURCES.education],
    ['中学校 公立', SCHOOL_COST.juniorHigh.public, SOURCES.education],
    ['中学校 私立', SCHOOL_COST.juniorHigh.private, SOURCES.education],
    ['高校 公立', SCHOOL_COST.highSchool.public, SOURCES.education],
    ['高校 私立', SCHOOL_COST.highSchool.private, SOURCES.education],
    ...Object.values(UNIVERSITY).flatMap((u) => [
      [`${u.label} 入学金`, u.admission, SOURCES.university] as [string, number, string],
      [`${u.label} 年間（${u.years}年）`, u.annual, SOURCES.university] as [string, number, string],
    ]),
    ['下宿の仕送り', LIVING_AWAY_ALLOWANCE, ''],
    ['養育費 未就学', upbringingCost(0), SOURCES.upbringing],
    ['養育費 小学生', upbringingCost(6), SOURCES.upbringing],
    ['養育費 中学生', upbringingCost(12), SOURCES.upbringing],
    ['養育費 高校生以上', upbringingCost(15), SOURCES.upbringing],
    ['出産費用（出産育児一時金50万円を差し引く前）', BIRTH_COST, ''],
  ];
  master.forEach(([k, v, src]) => {
    const r = ms.addRow([k, v, Math.round(v * B), src]);
    r.getCell(2).numFmt = YEN;
    r.getCell(3).numFmt = YEN;
  });

  return wb;
}

function download(data: BlobPart, filename: string, type: string) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

export async function exportExcel(input: ExportInput): Promise<void> {
  const wb = await buildWorkbook(input);
  const buf = await wb.xlsx.writeBuffer();
  download(buf, `lifeplan_${stamp()}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

export function exportCsv(input: ExportInput): void {
  const rows = input.scenarios.standard.rows;
  const head = ['年', '本人年齢', 'イベント', ...CF_COLUMNS.map((c) => c.label)];
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [head, ...rows.map((r) => [r.year, r.ageSelf, r.eventLabels.join(' / '), ...CF_COLUMNS.map((c) => Math.round(c.get(r)))])].map((l) =>
    l.map(esc).join(','),
  );
  download('\uFEFF' + lines.join('\r\n'), `lifeplan-cashflow_${stamp()}.csv`, 'text/csv;charset=utf-8');
}

export function downloadText(text: string, filename: string): void {
  download(text, filename, 'application/json');
}
