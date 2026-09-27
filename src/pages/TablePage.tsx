import type { YearRow } from '../engine/simulate';
import { CF_COLUMNS } from '../ui/cfColumns';
import { useStore } from '../ui/store';


export function TablePage() {
  const { scenarios, prefs, plan } = useStore();
  const rows = scenarios.standard.rows;
  const fmt = (v: number, r: YearRow) => Math.round((prefs.realValue ? v / r.deflator : v) / 10_000).toLocaleString('ja-JP');
  return (
    <div className="page">
      <p className="muted small">
        単位：万円（{prefs.realValue ? '現在価値' : '名目'}・標準シナリオ）。横にスクロールできます。赤字は資金不足の年です。
      </p>
      <div className="cf-wrap">
        <table className="cf">
          <thead>
            <tr>
              <th className="sticky">年</th>
              {rows.map((r) => (
                <th key={r.year} className={r.shortage ? 'short' : ''}>
                  {r.year}
                </th>
              ))}
            </tr>
            <tr>
              <th className="sticky">{plan.self.name}</th>
              {rows.map((r) => (
                <th key={r.year}>{r.ageSelf}</th>
              ))}
            </tr>
            {plan.spouse.enabled && (
              <tr>
                <th className="sticky">{plan.spouse.name}</th>
                {rows.map((r) => (
                  <th key={r.year}>{r.ageSpouse}</th>
                ))}
              </tr>
            )}
            {plan.children.map((c) => (
              <tr key={c.id}>
                <th className="sticky">{c.name}</th>
                {rows.map((r) => {
                  const a = r.year - c.birthYear;
                  return <th key={r.year}>{a >= 0 && a <= 25 ? a : ''}</th>;
                })}
              </tr>
            ))}
            <tr>
              <th className="sticky">イベント</th>
              {rows.map((r) => (
                <th key={r.year} className="ev" title={r.eventLabels.join(' / ')}>
                  {r.markers.join('')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CF_COLUMNS.map((c) => (
              <tr key={c.key} className={`${c.group} ${c.bold ? 'bold' : ''}`}>
                <th className="sticky">{c.label}</th>
                {rows.map((r) => {
                  const v = c.get(r);
                  return (
                    <td key={r.year} className={v < 0 ? 'neg' : ''}>
                      {v === 0 ? '' : fmt(v, r)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
