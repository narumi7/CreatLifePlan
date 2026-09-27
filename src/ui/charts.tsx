import {
  Area,
  Bar,
  Brush,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Scenarios } from '../engine/analysis';
import type { SimResult, YearRow } from '../engine/simulate';
import type { Plan } from '../engine/types';
import { axisMan, man } from './format';
import type { ViewPrefs } from './store';

// 検証済みのカテゴリカル配色（固定順で割り当てる）
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
export const STATUS = { good: '#0ca30c', warning: '#fab219', critical: '#d03b3b' };
const GRID = '#e6e5e0';
const AXIS = '#6b6a66';

export type Point = Record<string, number | string | string[]> & { label: string; year: number };

/** 行データをグラフ用に変換（現在価値表示なら物価で割り戻す） */
export function toPoints(rows: YearRow[], prefs: ViewPrefs, pick: (r: YearRow) => Record<string, number>): Point[] {
  return rows.map((r) => {
    const d = prefs.realValue ? r.deflator : 1;
    const values = pick(r);
    const out: Point = { label: prefs.axis === 'age' ? `${r.ageSelf}歳` : String(r.year), year: r.year, markers: r.markers };
    for (const [k, v] of Object.entries(values)) out[k] = v / d;
    return out;
  });
}

function TooltipBox({
  active,
  payload,
  label,
  rows,
}: {
  active?: boolean;
  payload?: readonly { name?: string | number; value?: unknown; color?: string }[];
  label?: string | number;
  rows: YearRow[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = rows.find((r) => String(r.year) === String(label) || `${r.ageSelf}歳` === String(label));
  return (
    <div className="tooltip">
      <div className="tooltip-title">
        {row ? `${row.year}年（${row.ageSelf}歳${row.ageSpouse !== null ? `・配偶者${row.ageSpouse}歳` : ''}）` : label}
      </div>
      {payload.map((p) => (
        <div key={String(p.name)} className="tooltip-row">
          <span className="swatch" style={{ background: p.color }} />
          <span>{p.name}</span>
          <strong>{man(Number(p.value))}</strong>
        </div>
      ))}
      {row && row.eventLabels.length > 0 && <div className="tooltip-events">{row.eventLabels.join(' / ')}</div>}
      <div className="tooltip-hint">クリックで内訳を表示</div>
    </div>
  );
}

interface BaseProps {
  rows: YearRow[];
  prefs: ViewPrefs;
  onSelectYear?: (year: number) => void;
  height?: number;
  brush?: boolean;
}

function useCommon({ rows, onSelectYear }: BaseProps, data: Point[]) {
  const onClick = (state: { activeLabel?: string | number } | null) => {
    if (!state || state.activeLabel === undefined || !onSelectYear) return;
    const p = data.find((d) => d.label === String(state.activeLabel));
    if (p) onSelectYear(p.year);
  };
  const markers = data
    .filter((d) => Array.isArray(d.markers) && (d.markers as string[]).length > 0)
    .map((d) => (
      <ReferenceLine
        key={`m-${d.label}`}
        x={d.label}
        stroke={GRID}
        strokeDasharray="2 4"
        label={{ value: (d.markers as string[]).slice(0, 2).join(''), position: 'insideTop', fontSize: 14 }}
      />
    ));
  const tooltip = <Tooltip content={(p) => <TooltipBox {...p} rows={rows} />} cursor={{ stroke: AXIS, strokeWidth: 1 }} />;
  return { onClick, markers, tooltip };
}

const axes = (
  <>
    <CartesianGrid stroke={GRID} vertical={false} />
    <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 12 }} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={16} />
    <YAxis tickFormatter={axisMan} tick={{ fill: AXIS, fontSize: 12 }} tickLine={false} axisLine={false} width={64} unit="万" />
  </>
);

/** 資産推移（現金＋投資の積み上げ、ローン残高、純資産） */
export function AssetChart(props: BaseProps & { result: SimResult }) {
  const { rows, prefs, height = 360, brush = true, result } = props;
  const data = toPoints(rows, prefs, (r) => ({ cash: r.cash, invest: r.invest, loan: -r.loanBalance, netWorth: r.netWorth }));
  const { onClick, markers, tooltip } = useCommon(props, data);
  const short = result.summary.shortageYear;
  const shortLabel = short ? data.find((d) => d.year === short)?.label : undefined;
  const hasLoan = rows.some((r) => r.loanBalance > 0);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} onClick={onClick} margin={{ top: 20, right: 12, left: 0, bottom: 0 }} stackOffset="sign">
        {axes}
        {tooltip}
        <Legend itemSorter={null} />
        <Area type="monotone" dataKey="cash" name="現金" stackId="a" stroke={SERIES[0]} fill={SERIES[0]} fillOpacity={0.35} strokeWidth={2} />
        <Area type="monotone" dataKey="invest" name="投資" stackId="a" stroke={SERIES[1]} fill={SERIES[1]} fillOpacity={0.35} strokeWidth={2} />
        {hasLoan && (
          <Area type="monotone" dataKey="loan" name="ローン残高" stackId="a" stroke={SERIES[2]} fill={SERIES[2]} fillOpacity={0.25} strokeWidth={2} />
        )}
        <Line type="monotone" dataKey="netWorth" name="純資産" stroke={SERIES[6]} strokeWidth={2} dot={false} />
        <ReferenceLine y={0} stroke={AXIS} />
        {markers}
        {shortLabel && (
          <ReferenceLine x={shortLabel} stroke={STATUS.critical} strokeWidth={2} label={{ value: '⚠ 資金ショート', fill: STATUS.critical, position: 'insideBottomLeft', fontSize: 12 }} />
        )}
        {brush && <Brush dataKey="label" height={24} stroke={AXIS} travellerWidth={8} />}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** 楽観・標準・悲観の金融資産推移 */
export function ScenarioChart({ scenarios, prefs, height = 300 }: { scenarios: Scenarios; prefs: ViewPrefs; height?: number }) {
  const rows = scenarios.standard.rows;
  const data = rows.map((r, i) => {
    const d = prefs.realValue ? r.deflator : 1;
    return {
      label: prefs.axis === 'age' ? `${r.ageSelf}歳` : String(r.year),
      year: r.year,
      optimistic: scenarios.optimistic.rows[i].financial / d,
      standard: r.financial / d,
      pessimistic: scenarios.pessimistic.rows[i].financial / d,
    };
  });
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
        {axes}
        <Tooltip content={(p) => <TooltipBox {...p} rows={rows} />} />
        <Legend itemSorter={null} />
        <Line type="monotone" dataKey="optimistic" name="楽観" stroke={SERIES[2]} strokeWidth={2} dot={false} strokeDasharray="6 3" />
        <Line type="monotone" dataKey="standard" name="標準" stroke={SERIES[0]} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="pessimistic" name="悲観" stroke={SERIES[1]} strokeWidth={2} dot={false} strokeDasharray="2 3" />
        <ReferenceLine y={0} stroke={AXIS} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** 年間の収入・支出と収支 */
export function CashflowChart(props: BaseProps) {
  const { rows, prefs, height = 320, brush = true } = props;
  const data = toPoints(rows, prefs, (r) => ({
    income: r.incomeTotal,
    expense: -(r.expenseTotal + r.contribution),
    balance: r.cashFlow,
  }));
  const { onClick, markers, tooltip } = useCommon(props, data);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} onClick={onClick} margin={{ top: 20, right: 12, left: 0, bottom: 0 }} barGap={2}>
        {axes}
        {tooltip}
        <Legend itemSorter={null} />
        <Bar dataKey="income" name="収入" fill={SERIES[0]} radius={[4, 4, 0, 0]} />
        <Bar dataKey="expense" name="支出＋積立" fill={SERIES[1]} radius={[0, 0, 4, 4]} />
        <Line type="monotone" dataKey="balance" name="年間収支" stroke={SERIES[6]} strokeWidth={2} dot={false} />
        <ReferenceLine y={0} stroke={AXIS} />
        {markers}
        {brush && <Brush dataKey="label" height={24} stroke={AXIS} travellerWidth={8} />}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** 支出の内訳（積み上げ）とバッファ分 */
export function ExpenseChart(props: BaseProps) {
  const { rows, prefs, height = 320, brush = true } = props;
  const data = toPoints(rows, prefs, (r) => ({
    living: r.living,
    housing: r.housing,
    education: r.education,
    childLiving: r.childLiving,
    events: r.events,
    contribution: r.contribution,
    buffer: r.bufferPortion,
  }));
  const { onClick, markers, tooltip } = useCommon(props, data);
  const stack = [
    ['living', '生活費'],
    ['housing', '住居費'],
    ['education', '教育費'],
    ['childLiving', '養育費'],
    ['events', 'ライフイベント'],
    ['contribution', '積立投資'],
  ] as const;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} onClick={onClick} margin={{ top: 20, right: 12, left: 0, bottom: 0 }}>
        {axes}
        {tooltip}
        <Legend itemSorter={null} />
        {stack.map(([k, n], i) => (
          <Bar key={k} dataKey={k} name={n} stackId="e" fill={SERIES[i]} stroke="#fff" strokeWidth={1} />
        ))}
        <Line type="monotone" dataKey="buffer" name="うちバッファ分" stroke={SERIES[7]} strokeWidth={2} dot={false} strokeDasharray="4 3" />
        {markers}
        {brush && <Brush dataKey="label" height={24} stroke={AXIS} travellerWidth={8} />}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** 収入の内訳 */
export function IncomeChart(props: BaseProps) {
  const { rows, prefs, height = 320, brush = true } = props;
  const data = toPoints(rows, prefs, (r) => ({
    salarySelf: r.salarySelf,
    salarySpouse: r.salarySpouse,
    pension: r.pension,
    severance: r.severance,
    other: r.childAllowance + r.loanDeduction + r.otherIncome,
  }));
  const { onClick, markers, tooltip } = useCommon(props, data);
  const stack = [
    ['salarySelf', '給与（本人）'],
    ['salarySpouse', '給与（配偶者）'],
    ['pension', '年金'],
    ['severance', '退職金'],
    ['other', '手当・その他'],
  ] as const;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} onClick={onClick} margin={{ top: 20, right: 12, left: 0, bottom: 0 }}>
        {axes}
        {tooltip}
        <Legend itemSorter={null} />
        {stack.map(([k, n], i) => (
          <Bar key={k} dataKey={k} name={n} stackId="i" fill={SERIES[i]} stroke="#fff" strokeWidth={1} />
        ))}
        {markers}
        {brush && <Brush dataKey="label" height={24} stroke={AXIS} travellerWidth={8} />}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** 投資の元本と運用益 */
export function InvestChart(props: BaseProps) {
  const { rows, prefs, height = 320, brush = true } = props;
  const data = toPoints(rows, prefs, (r) => ({
    principal: Math.min(r.investPrincipal, r.invest),
    gain: Math.max(0, r.invest - r.investPrincipal),
  }));
  const { onClick, tooltip } = useCommon(props, data);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} onClick={onClick} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
        {axes}
        {tooltip}
        <Legend itemSorter={null} />
        <Area type="monotone" dataKey="principal" name="元本" stackId="v" stroke={SERIES[0]} fill={SERIES[0]} fillOpacity={0.35} strokeWidth={2} />
        <Area type="monotone" dataKey="gain" name="運用益" stackId="v" stroke={SERIES[1]} fill={SERIES[1]} fillOpacity={0.35} strokeWidth={2} />
        {brush && <Brush dataKey="label" height={24} stroke={AXIS} travellerWidth={8} />}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** 複数プランの純資産推移の比較（年で揃える） */
export function CompareChart({
  plans,
  prefs,
  height = 360,
}: {
  plans: { name: string; plan: Plan; result: SimResult }[];
  prefs: ViewPrefs;
  height?: number;
}) {
  const years = new Set<number>();
  plans.forEach((p) => p.result.rows.forEach((r) => years.add(r.year)));
  const data = [...years]
    .sort((a, b) => a - b)
    .map((year) => {
      const pt: Record<string, number | string> = { label: String(year), year };
      plans.forEach((p, i) => {
        const r = p.result.rows.find((x) => x.year === year);
        if (r) pt[`p${i}`] = r.financial / (prefs.realValue ? r.deflator : 1);
      });
      return pt;
    });
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
        {axes}
        <Tooltip formatter={(v) => man(Number(v))} />
        <Legend itemSorter={null} />
        {plans.map((p, i) => (
          <Line key={i} type="monotone" dataKey={`p${i}`} name={p.name} stroke={SERIES[i % SERIES.length]} strokeWidth={2} dot={false} />
        ))}
        <ReferenceLine y={0} stroke={AXIS} />
        <Brush dataKey="label" height={24} stroke={AXIS} travellerWidth={8} />
      </LineChart>
    </ResponsiveContainer>
  );
}
