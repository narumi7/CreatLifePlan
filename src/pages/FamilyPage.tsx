import { defaultChild } from '../engine/defaults';
import { childBaseCost } from '../engine/simulate';
import { NURSERY_LABEL, SCHOOL_LABEL, SOURCES, UNIVERSITY_LABEL } from '../engine/standards';
import type { Employment, Person, Plan } from '../engine/types';
import { Card, Grid, Note, NumberField, SelectField, TextField, Toggle } from '../ui/fields';
import { man } from '../ui/format';
import { useStore } from '../ui/store';

export const EMPLOYMENT_LABEL: Record<Employment, string> = {
  employee: '会社員',
  civilServant: '公務員',
  selfEmployed: '自営業・フリーランス',
  none: '専業主婦・主夫／無職',
};

function PersonBasics({ person, set, year }: { person: Person; set: (m: (p: Person) => void) => void; year: number }) {
  return (
    <Grid>
      <TextField label="呼び名" value={person.name} onChange={(v) => set((p) => void (p.name = v))} />
      <NumberField
        label="生まれ年"
        unit="年"
        value={person.birthYear}
        onChange={(v) => set((p) => void (p.birthYear = Math.round(v)))}
        hint={`現在 ${year - person.birthYear}歳`}
      />
      <SelectField label="働き方" value={person.employment} options={EMPLOYMENT_LABEL} onChange={(v) => set((p) => void (p.employment = v))} />
    </Grid>
  );
}

export function FamilyPage() {
  const { plan, update } = useStore();
  const year = plan.settings.startYear;
  const setSelf = (m: (p: Person) => void) => update((d) => m(d.self));
  const setSpouse = (m: (p: Person) => void) => update((d) => m(d.spouse));
  const setChild = (id: string, m: (c: Plan['children'][number]) => void) =>
    update((d) => {
      const c = d.children.find((x) => x.id === id);
      if (c) m(c);
    });

  return (
    <div className="page">
      <Card title="本人">
        <PersonBasics person={plan.self} set={setSelf} year={year} />
      </Card>

      <Card title="配偶者">
        <Toggle label="配偶者を計算に含める" checked={plan.spouse.enabled} onChange={(v) => update((d) => void (d.spouse.enabled = v))} />
        {plan.spouse.enabled && <PersonBasics person={plan.spouse} set={setSpouse} year={year} />}
      </Card>

      <Card
        title="子供（予定の子も登録できます）"
        actions={
          <button
            className="btn"
            onClick={() =>
              update((d) => {
                const lastBirth = d.children.length ? Math.max(...d.children.map((c) => c.birthYear)) + 2 : year + 1;
                d.children.push(defaultChild(lastBirth, `第${d.children.length + 1}子`));
              })
            }
          >
            ＋ 子供を追加
          </button>
        }
      >
        {plan.children.length === 0 && <Note>子供がいる・予定がある場合は「子供を追加」してください。誕生予定年を入れると出産費用・教育費・養育費・児童手当を自動で計算します。</Note>}
        {plan.children.map((c) => {
          let edu = 0;
          let liv = 0;
          for (let y = Math.max(year, c.birthYear); y < c.birthYear + 25; y++) {
            const b = childBaseCost(c, y, plan.settings);
            edu += b.education;
            liv += b.living;
          }
          const B = plan.settings.bufferRate;
          return (
            <div key={c.id} className="subcard">
              <div className="subcard-head">
                <strong>
                  {c.name}（{c.birthYear > year ? `${c.birthYear}年 誕生予定` : `${year - c.birthYear}歳`}）
                </strong>
                <button className="btn ghost danger" onClick={() => update((d) => void (d.children = d.children.filter((x) => x.id !== c.id)))}>
                  削除
                </button>
              </div>
              <Grid>
                <TextField label="呼び名" value={c.name} onChange={(v) => setChild(c.id, (x) => void (x.name = v))} />
                <NumberField label="生まれ年（予定）" unit="年" value={c.birthYear} onChange={(v) => setChild(c.id, (x) => void (x.birthYear = Math.round(v)))} />
                <SelectField label="未就学（0〜5歳）" value={c.nursery} options={NURSERY_LABEL} onChange={(v) => setChild(c.id, (x) => void (x.nursery = v))} />
                <SelectField label="小学校" value={c.elementary} options={SCHOOL_LABEL} onChange={(v) => setChild(c.id, (x) => void (x.elementary = v))} />
                <SelectField label="中学校" value={c.juniorHigh} options={SCHOOL_LABEL} onChange={(v) => setChild(c.id, (x) => void (x.juniorHigh = v))} />
                <SelectField label="高校" value={c.highSchool} options={SCHOOL_LABEL} onChange={(v) => setChild(c.id, (x) => void (x.highSchool = v))} />
                <SelectField label="大学・専門" value={c.university} options={UNIVERSITY_LABEL} onChange={(v) => setChild(c.id, (x) => void (x.university = v))} />
                <NumberField
                  label="塾・習い事（6〜17歳）"
                  unit="万円"
                  value={c.extraAnnual}
                  onChange={(v) => setChild(c.id, (x) => void (x.extraAnnual = v))}
                  hint="年額"
                />
              </Grid>
              <Toggle label="大学等は下宿（仕送り 年120万円）" checked={c.livingAway} onChange={(v) => setChild(c.id, (x) => void (x.livingAway = v))} />
              <Toggle
                label="生活費としての養育費（食費・衣類・お小遣いなど）を計上"
                checked={c.includeLivingCost}
                onChange={(v) => setChild(c.id, (x) => void (x.includeLivingCost = v))}
                hint="今の家計（食費など）に既にこの子の分が含まれている場合は OFF にすると二重計上を防げます"
              />
              <p className="muted small">
                今年以降にかかる見込み（今の物価・バッファ込み）：教育費 {man(edu * B)} ／ 養育費 {man(liv * B)}
              </p>
            </div>
          );
        })}
        <Note>
          教育費は{SOURCES.education}、養育費は{SOURCES.upbringing}。すべて標準値 × {plan.settings.bufferRate}（バッファ）× 物価上昇で計算します。
        </Note>
      </Card>
    </div>
  );
}
