import { useEffect, useState } from 'react';
import { AssetsPage } from './pages/AssetsPage';
import { BudgetPage } from './pages/BudgetPage';
import { ChartsPage } from './pages/ChartsPage';
import { ComparePage } from './pages/ComparePage';
import { Dashboard } from './pages/Dashboard';
import { EventsPage } from './pages/EventsPage';
import { FamilyPage } from './pages/FamilyPage';
import { HousingPage } from './pages/HousingPage';
import { IncomePage } from './pages/IncomePage';
import { SettingsPage } from './pages/SettingsPage';
import { TablePage } from './pages/TablePage';
import { useStore } from './ui/store';

const PAGES = [
  { key: 'dashboard', label: 'ダッシュボード', icon: '🏠' },
  { key: 'family', label: '家族・子供', icon: '👨‍👩‍👧' },
  { key: 'income', label: '収入・年金', icon: '💼' },
  { key: 'budget', label: '月の家計', icon: '🧾' },
  { key: 'housing', label: '住まい', icon: '🏡' },
  { key: 'assets', label: '貯蓄・投資', icon: '📈' },
  { key: 'events', label: 'ライフイベント', icon: '🎉' },
  { key: 'charts', label: 'グラフ詳細', icon: '📊' },
  { key: 'table', label: 'キャッシュフロー表', icon: '📋' },
  { key: 'compare', label: 'プラン比較', icon: '⚖️' },
  { key: 'settings', label: '保存・出力・設定', icon: '💾' },
] as const;

type PageKey = (typeof PAGES)[number]['key'];

const fromHash = (): PageKey => {
  const k = window.location.hash.replace('#', '');
  return (PAGES.find((p) => p.key === k)?.key ?? 'dashboard') as PageKey;
};

export function App() {
  const [page, setPage] = useState<PageKey>(fromHash);
  const { state, active, selectPlan, prefs, setPrefs, savedAt, saveError, judgement } = useStore();

  useEffect(() => {
    const on = () => setPage(fromHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const go = (p: string) => {
    window.location.hash = p;
    window.scrollTo(0, 0);
  };
  const current = PAGES.find((p) => p.key === page)!;
  const badge = { good: '✅', warning: '⚠️', critical: '⛔' }[judgement.level];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span aria-hidden>🌱</span> ライフプラン
        </div>
        <label className="plan-select">
          <span className="sr-only">プラン</span>
          <select value={active.id} onChange={(e) => selectPlan(e.target.value)}>
            {state.plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <div className="view-toggles">
          <div className="seg" role="group" aria-label="金額の表示">
            <button className={!prefs.realValue ? 'on' : ''} onClick={() => setPrefs({ realValue: false })}>
              名目
            </button>
            <button className={prefs.realValue ? 'on' : ''} onClick={() => setPrefs({ realValue: true })} title="将来の金額を今のお金の価値に換算して表示">
              今の価値
            </button>
          </div>
          <div className="seg" role="group" aria-label="横軸">
            <button className={prefs.axis === 'year' ? 'on' : ''} onClick={() => setPrefs({ axis: 'year' })}>
              西暦
            </button>
            <button className={prefs.axis === 'age' ? 'on' : ''} onClick={() => setPrefs({ axis: 'age' })}>
              年齢
            </button>
          </div>
        </div>
        <div className={`save-status ${saveError ? 'error' : ''}`} title="データはこのブラウザ内だけに保存され、外部には送信されません">
          {saveError ? '⚠️ 保存できません' : `🔒 端末内に保存${savedAt ? ` ${savedAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}` : ''}`}
        </div>
      </header>
      <div className="layout">
        <nav className="sidenav" aria-label="メニュー">
          {PAGES.map((p) => (
            <a key={p.key} href={`#${p.key}`} className={p.key === page ? 'active' : ''} onClick={() => window.scrollTo(0, 0)}>
              <span aria-hidden>{p.icon}</span>
              <span>{p.label}</span>
              {p.key === 'dashboard' && <span className="nav-badge">{badge}</span>}
            </a>
          ))}
        </nav>
        <main>
          <h1>
            {current.icon} {current.label}
            <span className="plan-name">{active.name}</span>
          </h1>
          {page === 'dashboard' && <Dashboard go={go} />}
          {page === 'family' && <FamilyPage />}
          {page === 'income' && <IncomePage />}
          {page === 'budget' && <BudgetPage />}
          {page === 'housing' && <HousingPage />}
          {page === 'assets' && <AssetsPage />}
          {page === 'events' && <EventsPage />}
          {page === 'charts' && <ChartsPage />}
          {page === 'table' && <TablePage />}
          {page === 'compare' && <ComparePage go={go} />}
          {page === 'settings' && <SettingsPage />}
        </main>
      </div>
    </div>
  );
}
