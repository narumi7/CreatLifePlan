import { SAFE_REPAYMENT_RATIO, withPurchasePrice, type PriceCheck } from '../engine/affordability';
import { STATUS } from './charts';
import { Card, Note } from './fields';
import { man, yen } from './format';
import { useStore } from './store';

function Row({ label, tone, c }: { label: string; tone: string; c: PriceCheck }) {
  return (
    <tr>
      <td>
        <span className="swatch" style={{ background: tone }} /> {label}
      </td>
      <td className="num strong">{man(c.price)}</td>
      <td className="num">{man(c.loanAmount)}</td>
      <td className="num">{yen(c.monthlyPayment)}</td>
      <td className={`num ${c.repaymentRatio > SAFE_REPAYMENT_RATIO ? 'neg' : ''}`}>{(c.repaymentRatio * 100).toFixed(1)}%</td>
      <td className={`num ${c.retireFinancial < 0 ? 'neg' : ''}`}>{man(c.retireFinancial)}</td>
    </tr>
  );
}

/** いくらの家なら買えるか（安心ライン・上限）と、アドバイス */
export function AffordabilityCard() {
  const { plan, update, affordability: a } = useStore();
  const pur = plan.housing.purchase;
  const planned = pur.enabled ? pur.price : null;
  const scaleMax = Math.max(a.max?.price ?? 0, a.ratioLimit?.price ?? 0, planned ?? 0) * 1.15 || 1;
  const pos = (v: number) => `${Math.min(100, (v / scaleMax) * 100)}%`;

  const apply = (price: number) =>
    update((d) => {
      const p = withPurchasePrice(d, price).housing.purchase;
      d.housing.purchase = p;
    });

  return (
    <Card title="🏠 いくらの家なら買える？">
      <p className="muted small">
        {a.purchaseYear}年（{a.purchaseAge}歳）に頭金 {man(a.downPayment)}・金利 {(pur.loanRate * 100).toFixed(2)}%・{pur.loanYears}年ローン
        （完済 {a.payoffAge}歳）で買う場合を、今のライフプラン（子供・イベント・老後まで）に組み込んで試算しています。条件は下の「住宅購入の予定」で変えられます。
      </p>

      {a.max ? (
        <>
          <div className="afford-headline">
            {a.safe && (
              <div>
                <span className="stat-label">安心して買える価格</span>
                <strong style={{ color: STATUS.good }}>〜{man(a.safe.price)}</strong>
              </div>
            )}
            <div>
              <span className="stat-label">資金が足りる上限</span>
              <strong>〜{man(a.max.price)}</strong>
            </div>
            {planned !== null && (
              <div>
                <span className="stat-label">今の予定</span>
                <strong
                  style={{
                    color: planned <= (a.safe?.price ?? 0) ? STATUS.good : planned <= a.max.price ? STATUS.warning : STATUS.critical,
                  }}
                >
                  {man(planned)}
                </strong>
                <span className="stat-sub">
                  {planned <= (a.safe?.price ?? 0) ? '✅ 安心ライン内' : planned <= a.max.price ? '⚠️ 注意ゾーン' : '⛔ 上限超え'}
                </span>
              </div>
            )}
          </div>

          <div className="afford-scale" role="img" aria-label="価格帯の目安">
            <div className="zone" style={{ width: pos(a.safe?.price ?? 0), background: STATUS.good }} />
            <div className="zone" style={{ width: `calc(${pos(a.max.price)} - ${pos(a.safe?.price ?? 0)})`, background: STATUS.warning }} />
            <div className="zone rest" style={{ background: STATUS.critical }} />
            {planned !== null && <div className="marker" style={{ left: pos(planned) }} title={`今の予定 ${man(planned)}`} />}
          </div>
          <ul className="legend">
            <li>
              <span className="swatch" style={{ background: STATUS.good }} />
              安心：悲観シナリオでも資金が尽きず、返済が手取りの{Math.round(SAFE_REPAYMENT_RATIO * 100)}%以内
            </li>
            <li>
              <span className="swatch" style={{ background: STATUS.warning }} />
              注意：標準シナリオなら足りる
            </li>
            <li>
              <span className="swatch" style={{ background: STATUS.critical }} />
              不足：標準シナリオでも資金がショート
            </li>
          </ul>

          <div className="table-scroll">
            <table className="mini">
              <thead>
                <tr>
                  <th />
                  <th className="num">価格</th>
                  <th className="num">借入額</th>
                  <th className="num">毎月の返済</th>
                  <th className="num">返済負担率</th>
                  <th className="num">退職時の金融資産</th>
                </tr>
              </thead>
              <tbody>
                {a.safe && <Row label="安心ライン" tone={STATUS.good} c={a.safe} />}
                <Row label="上限" tone={STATUS.warning} c={a.max} />
                {a.ratioLimit && a.ratioLimit.price !== a.safe?.price && (
                  <Row label={`返済が手取りの${Math.round(SAFE_REPAYMENT_RATIO * 100)}%`} tone="#9a9993" c={a.ratioLimit} />
                )}
              </tbody>
            </table>
          </div>
          <p className="muted small">
            返済負担率 = 年間返済額 ÷ 購入年の世帯の手取り年収（{man(a.netIncome)}）。退職時の金融資産は標準シナリオ・名目の金額です。
          </p>
          <div className="btn-row">
            {a.safe && (
              <button className="btn primary" onClick={() => apply(a.safe!.price)}>
                安心ラインの {man(a.safe.price)} で試算する
              </button>
            )}
            <button className="btn" onClick={() => apply(a.max!.price)}>
              上限の {man(a.max.price)} で試算する
            </button>
          </div>
        </>
      ) : null}

      <h3>アドバイス</h3>
      <ul className="advice">
        {a.advice.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <Note>
        価格に合わせて固定資産税も増減させ、諸費用・修繕費には ×{plan.settings.bufferRate} のバッファを掛けています。購入すると家賃はかからなくなるため、賃貸より老後資金が増えるケースもあります。
      </Note>
    </Card>
  );
}
