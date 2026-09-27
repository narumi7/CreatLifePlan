import { idecoLimitMonthly } from '../engine/analysis';
import { defaultAccount } from '../engine/defaults';
import { NISA_ANNUAL_LIMIT, NISA_LIFETIME_LIMIT } from '../engine/standards';
import type { AccountType, InvestAccount } from '../engine/types';
import { InvestChart } from '../ui/charts';
import { Card, Grid, Note, NumberField, SelectField, TextField, Toggle } from '../ui/fields';
import { man, yen } from '../ui/format';
import { useStore } from '../ui/store';

const TYPE_LABEL: Record<AccountType, string> = { nisa: 'NISA', ideco: 'iDeCo', taxable: '特定口座（課税）' };

/** 毎月 m 円を n 年、利回り r で積み立てたときの将来額 */
function futureValue(m: number, r: number, years: number, start = 0): number {
  let v = start;
  for (let i = 0; i < years; i++) v = v * (1 + r) + m * 12 * (1 + r / 2);
  return v;
}

export function AssetsPage() {
  const { plan, update, scenarios, prefs } = useStore();
  const a = plan.assets;
  const year = plan.settings.startYear;
  const selfAge = year - plan.self.birthYear;
  const set = (id: string, m: (x: InvestAccount) => void) => update((d) => m(d.assets.accounts.find((x) => x.id === id)!));

  return (
    <div className="page">
      <Card title="現金・預貯金">
        <Grid>
          <NumberField label="現在の預貯金" unit="万円" value={a.cash} onChange={(v) => update((d) => void (d.assets.cash = v))} />
          <NumberField label="預金金利" unit="%" value={a.cashRate} onChange={(v) => update((d) => void (d.assets.cashRate = v))} />
          <NumberField
            label="生活防衛資金（生活費の何か月分）"
            unit="か月"
            value={a.emergencyMonths}
            onChange={(v) => update((d) => void (d.assets.emergencyMonths = v))}
            hint="会社員 3〜6か月、自営業 6〜12か月が目安"
          />
        </Grid>
        <Toggle
          label="現金が生活防衛資金を下回ったら投資から取り崩して補う"
          checked={a.autoCover}
          onChange={(v) => update((d) => void (d.assets.autoCover = v))}
          hint="取り崩し順：特定口座 → iDeCo（60歳以降）→ NISA。特定口座は利益に20.315%課税"
        />
      </Card>

      <Card
        title="積立投資"
        actions={
          <>
            {(['nisa', 'ideco', 'taxable'] as const).map((t) => (
              <button key={t} className="btn" onClick={() => update((d) => d.assets.accounts.push(defaultAccount(t, selfAge)))}>
                ＋ {TYPE_LABEL[t]}
              </button>
            ))}
          </>
        }
      >
        {a.accounts.length === 0 && <Note>積立投資をしている・予定がある場合は口座を追加してください。</Note>}
        {a.accounts.map((acc) => {
          const owner = acc.owner === 'spouse' && plan.spouse.enabled ? plan.spouse : plan.self;
          const ownerAge = year - owner.birthYear;
          const years = Math.max(0, acc.contribEndAge - Math.max(ownerAge, acc.contribStartAge));
          const fv = futureValue(acc.monthly, acc.expectedReturn, years, acc.balance);
          const ideco = acc.type === 'ideco' ? idecoLimitMonthly(owner.employment) : 0;
          return (
            <div key={acc.id} className="subcard">
              <div className="subcard-head">
                <strong>
                  {acc.name}（{TYPE_LABEL[acc.type]}）
                </strong>
                <button className="btn ghost danger" onClick={() => update((d) => void (d.assets.accounts = d.assets.accounts.filter((x) => x.id !== acc.id)))}>
                  削除
                </button>
              </div>
              <Grid>
                <TextField label="名前" value={acc.name} onChange={(v) => set(acc.id, (x) => void (x.name = v))} />
                {plan.spouse.enabled && (
                  <SelectField label="名義" value={acc.owner} options={{ self: plan.self.name, spouse: plan.spouse.name }} onChange={(v) => set(acc.id, (x) => void (x.owner = v))} />
                )}
                <NumberField label="現在の評価額" unit="万円" value={acc.balance} onChange={(v) => set(acc.id, (x) => void (x.balance = v))} />
                <NumberField label="うち元本" unit="万円" value={acc.principal} onChange={(v) => set(acc.id, (x) => void (x.principal = v))} />
                <NumberField
                  label="毎月の積立額"
                  unit="円"
                  value={acc.monthly}
                  onChange={(v) => set(acc.id, (x) => void (x.monthly = v))}
                  hint={
                    acc.type === 'nisa'
                      ? `上限 年${man(NISA_ANNUAL_LIMIT)}・生涯${man(NISA_LIFETIME_LIMIT)}`
                      : acc.type === 'ideco'
                        ? `上限 月${yen(ideco)}（${owner.name}の働き方）。60歳まで引き出せません`
                        : undefined
                  }
                />
                <NumberField label="想定利回り（年）" unit="%" value={acc.expectedReturn} onChange={(v) => set(acc.id, (x) => void (x.expectedReturn = v))} hint="全世界株式で 4〜5%、バランス型で 2〜3% 程度が目安" />
                <NumberField label="積立開始年齢" unit="歳" value={acc.contribStartAge} onChange={(v) => set(acc.id, (x) => void (x.contribStartAge = v))} />
                <NumberField label="積立終了年齢" unit="歳" value={acc.contribEndAge} onChange={(v) => set(acc.id, (x) => void (x.contribEndAge = v))} />
              </Grid>
              <p className="muted small">
                {years}年間積み立てると、{acc.contribEndAge}歳で約 <strong>{man(fv)}</strong>（元本 {man(acc.principal + acc.monthly * 12 * years)}、名目・上限や取り崩しを考慮しない単純計算）
              </p>
            </div>
          );
        })}
      </Card>

      <Card title="取り崩し計画">
        <Grid>
          <SelectField
            label="取り崩し方"
            value={a.withdrawal.mode}
            options={{ none: '計画的には取り崩さない（不足時のみ）', fixed: '毎月決まった額', rate: '毎年 残高の一定割合（定率）' }}
            onChange={(v) => update((d) => void (d.assets.withdrawal.mode = v))}
          />
          {a.withdrawal.mode !== 'none' && (
            <NumberField label="取り崩し開始年齢（本人）" unit="歳" value={a.withdrawal.startAge} onChange={(v) => update((d) => void (d.assets.withdrawal.startAge = v))} />
          )}
          {a.withdrawal.mode === 'fixed' && (
            <NumberField label="毎月の取り崩し額（今の物価）" unit="円" value={a.withdrawal.monthlyAmount} onChange={(v) => update((d) => void (d.assets.withdrawal.monthlyAmount = v))} />
          )}
          {a.withdrawal.mode === 'rate' && (
            <NumberField label="毎年の取り崩し率" unit="%" value={a.withdrawal.rate} onChange={(v) => update((d) => void (d.assets.withdrawal.rate = v))} hint="4%ルールが有名です" />
          )}
        </Grid>
      </Card>

      <Card title="投資の伸び（元本と運用益・標準シナリオ）">
        <InvestChart rows={scenarios.standard.rows} prefs={prefs} height={280} />
      </Card>
    </div>
  );
}
