import { loanSchedule } from '../engine/loan';
import { AffordabilityCard } from '../ui/AffordabilityCard';
import type { LoanMethod } from '../engine/types';
import { Card, Grid, Note, NumberField, SelectField, Toggle } from '../ui/fields';
import { man, yen } from '../ui/format';
import { useStore } from '../ui/store';

const METHOD: Record<LoanMethod, string> = { equalPayment: '元利均等（毎月同額）', equalPrincipal: '元金均等' };

export function HousingPage() {
  const { plan, update } = useStore();
  const h = plan.housing;
  const p = h.purchase;
  const B = plan.settings.bufferRate;
  const loanAmount = Math.max(0, p.price - p.downPayment);
  const sched = p.enabled ? loanSchedule(loanAmount, p.loanRate, p.loanYears, p.method) : [];
  const totalPay = sched.reduce((s, y) => s + y.payment, 0);
  const exSched =
    h.currentType === 'own' && h.existingLoan.balance > 0
      ? loanSchedule(h.existingLoan.balance, h.existingLoan.rate, h.existingLoan.remainingYears, h.existingLoan.method)
      : [];

  return (
    <div className="page">
      <Card title="今の住まい">
        <SelectField
          label="住まいの種類"
          value={h.currentType}
          options={{ rent: '賃貸', own: '持ち家' }}
          onChange={(v) => update((d) => void (d.housing.currentType = v))}
        />
        {h.currentType === 'rent' ? (
          <Grid>
            <NumberField label="家賃（管理費込み・月額）" unit="円" value={h.rentMonthly} onChange={(v) => update((d) => void (d.housing.rentMonthly = v))} />
            <Toggle label="家賃も物価に合わせて上がる" checked={h.rentInflation} onChange={(v) => update((d) => void (d.housing.rentInflation = v))} />
          </Grid>
        ) : (
          <>
            <Grid>
              <NumberField label="住宅ローン残高" unit="万円" value={h.existingLoan.balance} onChange={(v) => update((d) => void (d.housing.existingLoan.balance = v))} />
              <NumberField label="金利（年）" unit="%" value={h.existingLoan.rate} onChange={(v) => update((d) => void (d.housing.existingLoan.rate = v))} />
              <NumberField label="残りの返済期間" unit="年" value={h.existingLoan.remainingYears} onChange={(v) => update((d) => void (d.housing.existingLoan.remainingYears = v))} />
              <SelectField label="返済方法" value={h.existingLoan.method} options={METHOD} onChange={(v) => update((d) => void (d.housing.existingLoan.method = v))} />
              <NumberField label="固定資産税（年額）" unit="万円" value={h.ownPropertyTax} onChange={(v) => update((d) => void (d.housing.ownPropertyTax = v))} />
              <NumberField
                label="管理費・修繕費（年額）"
                unit="万円"
                value={h.ownMaintenance}
                onChange={(v) => update((d) => void (d.housing.ownMaintenance = v))}
                hint={`×${B} で計算`}
              />
            </Grid>
            {exSched[0] && <p className="muted small">今年の返済額 {man(exSched[0].payment, 1)}（月 約{yen(exSched[0].payment / 12)}）</p>}
          </>
        )}
      </Card>

      <AffordabilityCard />

      <Card title="住宅購入の予定">
        <Toggle label="将来、住宅を購入する" checked={p.enabled} onChange={(v) => update((d) => void (d.housing.purchase.enabled = v))} />
        {p.enabled && (
          <>
            <Grid>
              <NumberField label="購入年" unit="年" value={p.year} onChange={(v) => update((d) => void (d.housing.purchase.year = Math.round(v)))} />
              <NumberField label="物件価格" unit="万円" value={p.price} onChange={(v) => update((d) => void (d.housing.purchase.price = v))} />
              <NumberField label="頭金" unit="万円" value={p.downPayment} onChange={(v) => update((d) => void (d.housing.purchase.downPayment = v))} />
              <NumberField
                label="諸費用（物件価格の%）"
                unit="%"
                value={p.costRate}
                onChange={(v) => update((d) => void (d.housing.purchase.costRate = v))}
                hint={`新築 3〜7%、中古 6〜10% が目安。×${B} で計算`}
              />
              <NumberField label="ローン金利（年）" unit="%" value={p.loanRate} onChange={(v) => update((d) => void (d.housing.purchase.loanRate = v))} />
              <NumberField label="返済期間" unit="年" value={p.loanYears} onChange={(v) => update((d) => void (d.housing.purchase.loanYears = v))} />
              <SelectField label="返済方法" value={p.method} options={METHOD} onChange={(v) => update((d) => void (d.housing.purchase.method = v))} />
              <NumberField label="固定資産税（年額）" unit="万円" value={p.propertyTax} onChange={(v) => update((d) => void (d.housing.purchase.propertyTax = v))} />
              <NumberField
                label="管理費・修繕費（年額）"
                unit="万円"
                value={p.maintenance}
                onChange={(v) => update((d) => void (d.housing.purchase.maintenance = v))}
                hint={`マンションは管理費＋修繕積立金。×${B} で計算`}
              />
            </Grid>
            <Toggle
              label="住宅ローン控除を反映（年末残高の0.7%、所得税＋住民税の範囲内）"
              checked={p.loanDeduction}
              onChange={(v) => update((d) => void (d.housing.purchase.loanDeduction = v))}
            />
            {p.loanDeduction && (
              <Grid>
                <NumberField label="控除対象の借入限度額" unit="万円" value={p.deductionCap} onChange={(v) => update((d) => void (d.housing.purchase.deductionCap = v))} hint="2026〜30年入居：省エネ基準適合住宅なら一般世帯 2,000万円。性能・世帯で異なります" />
                <NumberField label="控除期間" unit="年" value={p.deductionYears} onChange={(v) => update((d) => void (d.housing.purchase.deductionYears = v))} />
              </Grid>
            )}
            <div className="summary-box">
              <div>
                借入額 <strong>{man(loanAmount)}</strong>
              </div>
              <div>
                毎月の返済（初年） <strong>{yen((sched[0]?.payment ?? 0) / 12)}</strong>
              </div>
              <div>
                返済総額 <strong>{man(totalPay)}</strong>（うち利息 {man(totalPay - loanAmount)}）
              </div>
              <div>
                購入時に必要な現金 <strong>{man(p.downPayment + p.price * p.costRate * B)}</strong>（頭金＋諸費用）
              </div>
            </div>
            {h.currentType === 'rent' && <Note>購入年から家賃はかからなくなります。</Note>}
          </>
        )}
      </Card>
    </div>
  );
}
