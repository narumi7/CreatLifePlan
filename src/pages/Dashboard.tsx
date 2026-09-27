import { useState } from 'react';
import { monthlyBudget } from '../engine/analysis';
import { AssetChart, ScenarioChart, STATUS } from '../ui/charts';
import { Card } from '../ui/fields';
import { man, yen } from '../ui/format';
import { useStore } from '../ui/store';
import { YearDetail } from '../ui/YearDetail';

const ICON = { good: '✅', warning: '⚠️', critical: '⛔' } as const;

export function Dashboard({ go }: { go: (page: string) => void }) {
  const { plan, scenarios, judgement, suggestions, prefs } = useStore();
  const std = scenarios.standard;
  const s = std.summary;
  const mb = monthlyBudget(plan, std);
  const [year, setYear] = useState<number | null>(null);
  const row = year !== null ? std.rows.find((r) => r.year === year) : undefined;
  const last = std.rows[std.rows.length - 1];
  const retireRow = std.rows.find((r) => r.year === s.retireYear);
  const v = (x: number, r = std.rows[0]) => (prefs.realValue ? x / r.deflator : x);

  return (
    <div className="page">
      <section className={`judgement ${judgement.level}`} style={{ borderColor: STATUS[judgement.level] }}>
        <div className="judgement-icon" aria-hidden>
          {ICON[judgement.level]}
        </div>
        <div>
          <h2>{judgement.title}</h2>
          <ul>
            {judgement.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      </section>

      <div className="stats">
        <div className="stat">
          <span className="stat-label">毎月自由に使える余裕</span>
          <strong className={mb.free < 0 ? 'neg' : ''}>{yen(mb.free)}</strong>
          <button className="link" onClick={() => go('budget')}>
            家計の内訳 →
          </button>
        </div>
        <div className="stat">
          <span className="stat-label">資金ショート</span>
          <strong className={s.shortageYear ? 'neg' : ''}>{s.shortageYear ? `${s.shortageYear}年（${s.shortageAge}歳）` : 'なし'}</strong>
          <span className="stat-sub">標準シナリオ</span>
        </div>
        <div className="stat">
          <span className="stat-label">退職時（{retireRow?.ageSelf}歳）の金融資産</span>
          <strong>{man(v(s.retireFinancial, retireRow))}</strong>
          <span className="stat-sub">{prefs.realValue ? '現在価値' : '名目'}</span>
        </div>
        <div className="stat">
          <span className="stat-label">{last.ageSelf}歳時点の金融資産</span>
          <strong className={s.finalFinancial < 0 ? 'neg' : ''}>{man(v(s.finalFinancial, last))}</strong>
          <span className="stat-sub">{prefs.realValue ? '現在価値' : '名目'}</span>
        </div>
      </div>

      {suggestions.length > 0 && (
        <Card title="💡 改善提案（どれか1つで足りるようになります）">
          <ul className="suggestions">
            {suggestions.map((x) => (
              <li key={x.title}>
                <strong>{x.title}</strong>
                <span>{x.detail}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="資産の推移（標準シナリオ）" actions={<span className="muted small">グラフをクリックするとその年の内訳を表示</span>}>
        <AssetChart rows={std.rows} result={std} prefs={prefs} onSelectYear={setYear} />
        {row && <YearDetail row={row} real={prefs.realValue} onClose={() => setYear(null)} />}
      </Card>

      <Card title="運用シナリオ別の金融資産（楽観・標準・悲観）">
        <p className="muted small">
          利回りを ±{(plan.settings.scenarioSpread * 100).toFixed(1)}% 変えた場合。悲観シナリオでも0を下回らなければ安心です。
        </p>
        <ScenarioChart scenarios={scenarios} prefs={prefs} />
      </Card>

      {std.warnings.length > 0 && (
        <Card title="注意">
          <ul>
            {std.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
