import { monthlyBudget } from '../engine/analysis';
import { standardBudgetItems, uid } from '../engine/defaults';
import { SOURCES } from '../engine/standards';
import type { BudgetItem } from '../engine/types';
import { SERIES } from '../ui/charts';
import { Card, Grid, Note, NumberField } from '../ui/fields';
import { yen } from '../ui/format';
import { useStore } from '../ui/store';

type Kind = 'fixed' | 'variable' | 'special';
const TITLE: Record<Kind, string> = {
  fixed: '固定費（毎月）',
  variable: '変動費（毎月）',
  special: '特別費（年額：帰省・家電・車検など）',
};

function ItemList({ kind }: { kind: Kind }) {
  const { plan, update } = useStore();
  const items = plan.budget[kind];
  const B = plan.settings.bufferRate;
  const set = (id: string, m: (i: BudgetItem) => void) => update((d) => m(d.budget[kind].find((x) => x.id === id)!));
  const total = items.reduce((s, i) => s + i.amount * (i.buffer ? B : 1), 0);
  return (
    <Card
      title={TITLE[kind]}
      actions={
        <>
          <button className="btn ghost" onClick={() => update((d) => void (d.budget[kind] = standardBudgetItems(kind)))}>
            標準値で入力
          </button>
          <button className="btn" onClick={() => update((d) => d.budget[kind].push({ id: uid(), name: '新しい項目', amount: 0, buffer: false }))}>
            ＋ 追加
          </button>
        </>
      }
    >
      <table className="edit-table">
        <thead>
          <tr>
            <th>項目</th>
            <th className="num">{kind === 'special' ? '年額（円）' : '月額（円）'}</th>
            <th title="世間一般の標準値を使う項目は ON（×バッファ率）">×{B}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id}>
              <td>
                <input aria-label="項目名" value={i.name} onChange={(e) => set(i.id, (x) => void (x.name = e.target.value))} />
              </td>
              <td className="num">
                <input
                  aria-label={`${i.name}の金額`}
                  type="number"
                  inputMode="numeric"
                  value={i.amount}
                  onChange={(e) => set(i.id, (x) => void (x.amount = Number(e.target.value) || 0))}
                />
              </td>
              <td className="center">
                <input aria-label="バッファを掛ける" type="checkbox" checked={i.buffer} onChange={(e) => set(i.id, (x) => void (x.buffer = e.target.checked))} />
              </td>
              <td>
                <button className="btn ghost danger small" aria-label="削除" onClick={() => update((d) => void (d.budget[kind] = d.budget[kind].filter((x) => x.id !== i.id)))}>
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>合計（バッファ込み）</td>
            <td className="num">{yen(total)}</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </Card>
  );
}

export function BudgetPage() {
  const { plan, update, scenarios } = useStore();
  const mb = monthlyBudget(plan, scenarios.standard);
  const lines: [string, number, string?][] = [
    ['手取り収入（給与・年金）', mb.takeHome],
    ['児童手当', mb.childAllowance],
    ['− 住居費', -mb.housing],
    ['− 固定費', -mb.fixed],
    ['− 特別費（月割り）', -mb.special],
    ['− 積立投資（先取り）', -mb.investment],
  ];
  const parts = [
    { label: '住居費', v: mb.housing },
    { label: '固定費', v: mb.fixed },
    { label: '特別費', v: mb.special },
    { label: '積立投資', v: mb.investment },
    { label: '変動費', v: mb.variable },
    { label: '余裕', v: Math.max(0, mb.free) },
  ];
  const partsTotal = parts.reduce((s, p) => s + p.v, 0) || 1;

  return (
    <div className="page">
      <Card title={`今月いくら使える？（${plan.settings.startYear}年）`}>
        <div className="budget-flow">
          {lines.map(([k, v]) => (
            <div key={k} className="flow-row">
              <span>{k}</span>
              <span className="num">{yen(v)}</span>
            </div>
          ))}
          <div className="flow-row total">
            <span>＝ 変動費に使える額</span>
            <span className="num">{yen(mb.variableBudget)}</span>
          </div>
          <div className="flow-row">
            <span>− 変動費（今の支出）</span>
            <span className="num">{yen(-mb.variable)}</span>
          </div>
          <div className={`flow-row total big ${mb.free < 0 ? 'neg' : 'pos'}`}>
            <span>＝ 自由に使える余裕（毎月）</span>
            <span className="num">{yen(mb.free)}</span>
          </div>
          <p className="muted small">
            支出はバッファ（×{plan.settings.bufferRate}）込み。うちバッファ分 {yen(mb.bufferPortion)}/月。
            {mb.free < 0 ? ' 赤字です。変動費を見直すか、積立額を調整しましょう。' : ''}
          </p>
        </div>
        <div className="stackbar" role="img" aria-label="手取りの使い道の内訳">
          {parts.map((p, i) =>
            p.v > 0 ? (
              <div key={p.label} style={{ width: `${(p.v / partsTotal) * 100}%`, background: SERIES[i] }} title={`${p.label} ${yen(p.v)}`} />
            ) : null,
          )}
        </div>
        <ul className="legend">
          {parts.map((p, i) => (
            <li key={p.label}>
              <span className="swatch" style={{ background: SERIES[i] }} />
              {p.label} {yen(p.v)}（{((p.v / partsTotal) * 100).toFixed(0)}%）
            </li>
          ))}
        </ul>
      </Card>

      <ItemList kind="fixed" />
      <ItemList kind="variable" />
      <ItemList kind="special" />

      <Card title="老後の生活費">
        <Grid>
        <NumberField
          label="退職後の生活費（現役時の何%）"
          unit="%"
          value={plan.budget.retirementRatio}
          onChange={(v) => update((d) => void (d.budget.retirementRatio = v))}
          hint="一般的に現役時の70%程度と言われます。住居費・子供の費用は別に計算します。"
        />
        </Grid>
      </Card>
      <Note>
        住居費（家賃・ローン）は「住まい」、子供の費用は「家族」で入力します。ここには含めないでください。標準値は{SOURCES.household}を参考にした目安です。
      </Note>
    </div>
  );
}
