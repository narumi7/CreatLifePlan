import { useMemo, useState } from 'react';
import { judge, runScenarios } from '../engine/analysis';
import { CompareChart, SERIES } from '../ui/charts';
import { Card, Note } from '../ui/fields';
import { man } from '../ui/format';
import { useStore } from '../ui/store';

const LEVEL = { good: '✅ 安心', warning: '⚠️ 注意', critical: '⛔ 不足' } as const;

export function ComparePage({ go }: { go: (p: string) => void }) {
  const { state, prefs, duplicatePlan, active } = useStore();
  const [selected, setSelected] = useState<string[]>(() => state.plans.slice(0, 4).map((p) => p.id));
  const chosen = state.plans.filter((p) => selected.includes(p.id));
  const results = useMemo(
    () =>
      chosen.map((p) => {
        const s = runScenarios(p.plan);
        return { name: p.name, plan: p.plan, result: s.standard, judgement: judge(s) };
      }),
    [chosen.map((p) => p.id + p.updatedAt).join()],
  );

  return (
    <div className="page">
      <Card
        title="比較するプラン"
        actions={
          <button
            className="btn"
            onClick={() => {
              duplicatePlan(active.id);
              go('family');
            }}
          >
            ＋ 今のプランを複製して別案を作る
          </button>
        }
      >
        {state.plans.length < 2 && <Note>「今のプランを複製」で別案（子供の人数・賃貸と持ち家・私立と公立など）を作ると、ここで比較できます。</Note>}
        <div className="chips">
          {state.plans.map((p) => {
            const i = chosen.findIndex((c) => c.id === p.id);
            return (
              <label key={p.id} className="chip">
                <input
                  type="checkbox"
                  checked={selected.includes(p.id)}
                  onChange={(e) => setSelected((s) => (e.target.checked ? [...s, p.id] : s.filter((x) => x !== p.id)))}
                />
                {i >= 0 && <span className="swatch" style={{ background: SERIES[i % SERIES.length] }} />}
                {p.name}
              </label>
            );
          })}
        </div>
      </Card>

      {results.length > 0 && (
        <>
          <Card title="金融資産の推移（標準シナリオ）">
            <CompareChart plans={results} prefs={prefs} />
          </Card>
          <Card title="比較表">
            <div className="table-scroll">
              <table className="mini">
                <thead>
                  <tr>
                    <th>プラン</th>
                    <th>判定</th>
                    <th>資金ショート</th>
                    <th className="num">退職時の金融資産</th>
                    <th className="num">最終の金融資産</th>
                    <th className="num">教育費の総額</th>
                    <th className="num">住居費の総額</th>
                    <th className="num">イベント費の総額</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => {
                    const sum = (k: 'education' | 'housing' | 'events') => r.result.rows.reduce((s, x) => s + x[k] / (prefs.realValue ? x.deflator : 1), 0);
                    const last = r.result.rows[r.result.rows.length - 1];
                    const retire = r.result.rows.find((x) => x.year === r.result.summary.retireYear)!;
                    const d = (x: typeof last) => (prefs.realValue ? x.deflator : 1);
                    return (
                      <tr key={r.name}>
                        <td>{r.name}</td>
                        <td>{LEVEL[r.judgement.level]}</td>
                        <td>{r.result.summary.shortageYear ? `${r.result.summary.shortageYear}年（${r.result.summary.shortageAge}歳）` : 'なし'}</td>
                        <td className="num">{man(retire.financial / d(retire))}</td>
                        <td className="num">{man(last.financial / d(last))}</td>
                        <td className="num">{man(sum('education'))}</td>
                        <td className="num">{man(sum('housing'))}</td>
                        <td className="num">{man(sum('events'))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
