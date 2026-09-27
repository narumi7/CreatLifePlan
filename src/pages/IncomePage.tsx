import { uid } from '../engine/defaults';
import { estimatePension65, pensionAdjust } from '../engine/simulate';
import { PENSION_NET_RATIO, SOURCES } from '../engine/standards';
import { takeHome } from '../engine/tax';
import type { Person } from '../engine/types';
import { Card, Grid, Note, NumberField, SelectField, TextField, Toggle } from '../ui/fields';
import { man } from '../ui/format';
import { useStore } from '../ui/store';

function PersonIncome({ person, set, title }: { person: Person; set: (m: (p: Person) => void) => void; title: string }) {
  const { plan } = useStore();
  const year = plan.settings.startYear;
  const age = year - person.birthYear;
  const inc = person.income;
  const th = takeHome(inc.annualGross, person.employment, age);
  const p65 = estimatePension65(person, plan.settings);
  const adj = pensionAdjust(person.pension.startAge);

  return (
    <Card title={`${title}（${person.name}・${age}歳）`}>
      <h3>給与収入</h3>
      <Grid>
        <SelectField
          label="入力方法"
          value={inc.mode}
          options={{ gross: '額面の年収から手取りを自動計算', net: '手取りの年収を直接入力' }}
          onChange={(v) => set((p) => void (p.income.mode = v))}
        />
        {inc.mode === 'gross' ? (
          <NumberField label="額面の年収（賞与込み）" unit="万円" value={inc.annualGross} onChange={(v) => set((p) => void (p.income.annualGross = v))} />
        ) : (
          <NumberField label="手取りの年収" unit="万円" value={inc.annualNet} onChange={(v) => set((p) => void (p.income.annualNet = v))} />
        )}
        <NumberField label="昇給率（年）" unit="%" value={inc.raiseRate} onChange={(v) => set((p) => void (p.income.raiseRate = v))} />
        <NumberField label="昇給が止まる年齢" unit="歳" value={inc.raiseUntilAge} onChange={(v) => set((p) => void (p.income.raiseUntilAge = v))} />
        <NumberField label="定年（退職）年齢" unit="歳" value={inc.retirementAge} onChange={(v) => set((p) => void (p.income.retirementAge = v))} />
        <NumberField label="退職金（手取り）" unit="万円" value={inc.severancePay} onChange={(v) => set((p) => void (p.income.severancePay = v))} hint="定年の年に受け取り" />
      </Grid>
      {inc.mode === 'gross' && inc.annualGross > 0 && (
        <p className="muted small">
          今年の手取り 約 <strong>{man(th.net, 1)}</strong>（社会保険料 {man(th.socialInsurance, 1)}、所得税 {man(th.incomeTax, 1)}、住民税{' '}
          {man(th.residentTax, 1)} を差し引き。配偶者控除などは考慮しない概算）
        </p>
      )}
      <Toggle label="定年後に再雇用で働く" checked={inc.reemployment} onChange={(v) => set((p) => void (p.income.reemployment = v))} />
      {inc.reemployment && (
        <Grid>
          <NumberField label="再雇用で働く年齢（まで）" unit="歳" value={inc.reemploymentUntilAge} onChange={(v) => set((p) => void (p.income.reemploymentUntilAge = v))} />
          <NumberField label="再雇用時の年収（定年前の何%）" unit="%" value={inc.reemploymentRatio} onChange={(v) => set((p) => void (p.income.reemploymentRatio = v))} />
        </Grid>
      )}

      <h3>収入が変わる期間（育休・時短・転職など）</h3>
      {inc.changes.map((c) => (
        <div key={c.id} className="row-edit">
          <TextField label="内容" value={c.label} onChange={(v) => set((p) => void (p.income.changes.find((x) => x.id === c.id)!.label = v))} />
          <NumberField label="開始年" unit="年" value={c.startYear} onChange={(v) => set((p) => void (p.income.changes.find((x) => x.id === c.id)!.startYear = v))} />
          <NumberField label="終了年" unit="年" value={c.endYear} onChange={(v) => set((p) => void (p.income.changes.find((x) => x.id === c.id)!.endYear = v))} />
          <NumberField label="手取りの割合" unit="%" value={c.ratio} onChange={(v) => set((p) => void (p.income.changes.find((x) => x.id === c.id)!.ratio = v))} />
          <button className="btn ghost danger" onClick={() => set((p) => void (p.income.changes = p.income.changes.filter((x) => x.id !== c.id)))}>
            削除
          </button>
        </div>
      ))}
      <div className="btn-row">
        <button
          className="btn"
          onClick={() => set((p) => p.income.changes.push({ id: uid(), label: '育休', startYear: year + 1, endYear: year + 1, ratio: 0.75 }))}
        >
          ＋ 育休（手取り約75%）
        </button>
        <button
          className="btn"
          onClick={() => set((p) => p.income.changes.push({ id: uid(), label: '時短勤務', startYear: year + 2, endYear: year + 4, ratio: 0.8 }))}
        >
          ＋ 時短勤務（80%）
        </button>
        <button className="btn" onClick={() => set((p) => p.income.changes.push({ id: uid(), label: '転職など', startYear: year + 1, endYear: year + 1, ratio: 1 }))}>
          ＋ その他
        </button>
      </div>
      <Note>育児休業給付金は非課税・社会保険料免除のため、手取りベースでは約75〜80%になります。</Note>

      <h3>公的年金</h3>
      <Grid>
        <SelectField
          label="年金額"
          value={person.pension.mode}
          options={{ auto: '年収と働く期間から概算', manual: 'ねんきん定期便の金額を入力' }}
          onChange={(v) => set((p) => void (p.pension.mode = v))}
        />
        {person.pension.mode === 'manual' ? (
          <NumberField label="65歳からの年金見込額（年額）" unit="万円" value={person.pension.annualAmount} onChange={(v) => set((p) => void (p.pension.annualAmount = v))} />
        ) : (
          <NumberField label="就職した年齢" unit="歳" value={inc.workStartAge} onChange={(v) => set((p) => void (p.income.workStartAge = v))} />
        )}
        <NumberField
          label="受給開始年齢（60〜75）"
          unit="歳"
          min={60}
          max={75}
          value={person.pension.startAge}
          onChange={(v) => set((p) => void (p.pension.startAge = Math.min(75, Math.max(60, Math.round(v)))))}
          hint={adj === 1 ? '65歳で受給' : adj > 1 ? `繰下げで +${((adj - 1) * 100).toFixed(1)}%` : `繰上げで ${((adj - 1) * 100).toFixed(1)}%`}
        />
      </Grid>
      <p className="muted small">
        65歳時点の見込額 {man(p65, 1)}/年 → 受給開始 {person.pension.startAge}歳で {man(p65 * adj, 1)}/年（手取りは約{PENSION_NET_RATIO * 100}%、今の物価）。
        {person.pension.mode === 'auto' && ' 概算のため、ねんきん定期便の金額を入力するとより正確です。'}
      </p>
      <Note>{SOURCES.pension}。将来の年金額は「物価上昇率 − マクロ経済スライド分」で増えるものとして計算します。</Note>
    </Card>
  );
}

export function IncomePage() {
  const { plan, update } = useStore();
  const year = plan.settings.startYear;
  return (
    <div className="page">
      <PersonIncome person={plan.self} title="本人の収入" set={(m) => update((d) => m(d.self))} />
      {plan.spouse.enabled && <PersonIncome person={plan.spouse} title="配偶者の収入" set={(m) => update((d) => m(d.spouse))} />}
      <Card
        title="その他の収入（副業・家賃収入など）"
        actions={
          <button
            className="btn"
            onClick={() => update((d) => d.otherIncomes.push({ id: uid(), name: '副業', annualAmount: 50 * 10_000, startYear: year, endYear: year + 10 }))}
          >
            ＋ 追加
          </button>
        }
      >
        {plan.otherIncomes.length === 0 && <Note>児童手当は子供の情報から自動で計算されます。</Note>}
        {plan.otherIncomes.map((o) => {
          const set = (m: (x: typeof o) => void) => update((d) => m(d.otherIncomes.find((x) => x.id === o.id)!));
          return (
            <div key={o.id} className="row-edit">
              <TextField label="名前" value={o.name} onChange={(v) => set((x) => void (x.name = v))} />
              <NumberField label="手取り年額" unit="万円" value={o.annualAmount} onChange={(v) => set((x) => void (x.annualAmount = v))} />
              <NumberField label="開始年" unit="年" value={o.startYear} onChange={(v) => set((x) => void (x.startYear = v))} />
              <NumberField label="終了年" unit="年" value={o.endYear} onChange={(v) => set((x) => void (x.endYear = v))} />
              <button className="btn ghost danger" onClick={() => update((d) => void (d.otherIncomes = d.otherIncomes.filter((x) => x.id !== o.id)))}>
                削除
              </button>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
