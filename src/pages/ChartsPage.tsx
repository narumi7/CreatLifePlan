import { useState } from 'react';
import { AssetChart, CashflowChart, ExpenseChart, IncomeChart, InvestChart, ScenarioChart } from '../ui/charts';
import { Card } from '../ui/fields';
import { useStore } from '../ui/store';
import { YearDetail } from '../ui/YearDetail';

export function ChartsPage() {
  const { scenarios, prefs } = useStore();
  const std = scenarios.standard;
  const [year, setYear] = useState<number>(std.rows[0].year);
  const row = std.rows.find((r) => r.year === year) ?? std.rows[0];
  const common = { rows: std.rows, prefs, onSelectYear: setYear };

  return (
    <div className="page charts-page">
      <p className="muted small">どのグラフも、クリックした年の内訳が下に表示されます。グラフ下のバーをドラッグすると期間を絞り込めます。</p>
      <div className="charts-layout">
        <div className="charts-col">
          <Card title="資産の推移">
            <AssetChart {...common} result={std} />
          </Card>
          <Card title="年間の収入と支出">
            <CashflowChart {...common} />
          </Card>
          <Card title="支出の内訳">
            <ExpenseChart {...common} />
          </Card>
          <Card title="収入の内訳">
            <IncomeChart {...common} />
          </Card>
          <Card title="投資の元本と運用益">
            <InvestChart {...common} />
          </Card>
          <Card title="運用シナリオ別の金融資産">
            <ScenarioChart scenarios={scenarios} prefs={prefs} />
          </Card>
        </div>
        <aside className="detail-col">
          <Card>
            <div className="year-picker">
              <button className="btn ghost" onClick={() => setYear((y) => Math.max(std.rows[0].year, y - 1))} aria-label="前の年">
                ◀
              </button>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="年を選択">
                {std.rows.map((r) => (
                  <option key={r.year} value={r.year}>
                    {r.year}年（{r.ageSelf}歳）
                  </option>
                ))}
              </select>
              <button className="btn ghost" onClick={() => setYear((y) => Math.min(std.rows[std.rows.length - 1].year, y + 1))} aria-label="次の年">
                ▶
              </button>
            </div>
            <YearDetail row={row} real={prefs.realValue} />
          </Card>
        </aside>
      </div>
    </div>
  );
}
