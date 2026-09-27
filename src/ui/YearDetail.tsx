import type { YearRow } from '../engine/simulate';
import { man } from './format';

export function YearDetail({ row, real, onClose }: { row: YearRow; real: boolean; onClose?: () => void }) {
  const d = real ? row.deflator : 1;
  const m = (v: number) => man(v / d, 1);
  const income: [string, number][] = [
    ['給与（本人・手取り）', row.salarySelf],
    ['給与（配偶者・手取り）', row.salarySpouse],
    ['年金（手取り）', row.pension],
    ['退職金', row.severance],
    ['児童手当', row.childAllowance],
    ['住宅ローン控除', row.loanDeduction],
    ['その他収入', row.otherIncome],
  ];
  const expense: [string, number][] = [
    ['生活費', row.living],
    ['住居費', row.housing],
    ['教育費・出産', row.education],
    ['養育費', row.childLiving],
    ['ライフイベント', row.events],
  ];
  return (
    <div className="year-detail">
      <div className="year-detail-head">
        <h3>
          {row.year}年 の内訳（本人 {row.ageSelf}歳{row.ageSpouse !== null ? `・配偶者 ${row.ageSpouse}歳` : ''}）
          {real && <small>（現在価値）</small>}
        </h3>
        {onClose && (
          <button className="btn ghost" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        )}
      </div>
      {row.eventLabels.length > 0 && <p className="events-line">{row.eventLabels.join(' / ')}</p>}
      <div className="detail-grid">
        <table className="mini">
          <thead>
            <tr>
              <th>収入</th>
              <th className="num">金額</th>
            </tr>
          </thead>
          <tbody>
            {income.filter(([, v]) => v !== 0).map(([k, v]) => (
              <tr key={k}>
                <td>{k}</td>
                <td className="num">{m(v)}</td>
              </tr>
            ))}
            <tr className="total">
              <td>収入合計</td>
              <td className="num">{m(row.incomeTotal)}</td>
            </tr>
          </tbody>
        </table>
        <table className="mini">
          <thead>
            <tr>
              <th>支出</th>
              <th className="num">金額</th>
            </tr>
          </thead>
          <tbody>
            {expense.filter(([, v]) => v !== 0).map(([k, v]) => (
              <tr key={k}>
                <td>{k}</td>
                <td className="num">{m(v)}</td>
              </tr>
            ))}
            <tr className="total">
              <td>支出合計</td>
              <td className="num">{m(row.expenseTotal)}</td>
            </tr>
            <tr>
              <td className="muted">うちバッファ分</td>
              <td className="num muted">{m(row.bufferPortion)}</td>
            </tr>
          </tbody>
        </table>
        <table className="mini">
          <thead>
            <tr>
              <th>お金の動き・残高</th>
              <th className="num">金額</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>積立投資</td>
              <td className="num">{m(row.contribution)}</td>
            </tr>
            <tr>
              <td>年間収支（収入−支出−積立）</td>
              <td className={`num ${row.cashFlow < 0 ? 'neg' : ''}`}>{m(row.cashFlow)}</td>
            </tr>
            <tr>
              <td>投資からの取り崩し</td>
              <td className="num">{m(row.withdrawal)}</td>
            </tr>
            <tr className="total">
              <td>現金残高</td>
              <td className={`num ${row.cash < 0 ? 'neg' : ''}`}>{m(row.cash)}</td>
            </tr>
            <tr>
              <td>投資残高（NISA / iDeCo / 特定）</td>
              <td className="num">{m(row.invest)}</td>
            </tr>
            <tr>
              <td className="muted">　NISA / iDeCo / 特定</td>
              <td className="num muted">
                {m(row.investByType.nisa)} / {m(row.investByType.ideco)} / {m(row.investByType.taxable)}
              </td>
            </tr>
            {row.loanBalance > 0 && (
              <tr>
                <td>ローン残高</td>
                <td className="num">{m(row.loanBalance)}</td>
              </tr>
            )}
            <tr className="total">
              <td>純資産</td>
              <td className="num">{m(row.netWorth)}</td>
            </tr>
            <tr>
              <td className="muted">生活防衛資金の目安</td>
              <td className="num muted">{m(row.emergencyTarget)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {row.children.length > 0 && (
        <table className="mini">
          <thead>
            <tr>
              <th>子供</th>
              <th>年齢</th>
              <th>段階</th>
              <th className="num">教育費</th>
              <th className="num">養育費</th>
            </tr>
          </thead>
          <tbody>
            {row.children.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.age < 0 ? '—' : `${c.age}歳`}</td>
                <td>{c.stage}</td>
                <td className="num">{m(c.education + c.birth)}</td>
                <td className="num">{m(c.living)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
