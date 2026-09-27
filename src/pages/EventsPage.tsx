import { useState } from 'react';
import { uid } from '../engine/defaults';
import { eventOccurs } from '../engine/simulate';
import { EVENT_TEMPLATES, SOURCES } from '../engine/standards';
import type { LifeEvent } from '../engine/types';
import { Card, Note, NumberField, SelectField, TextField, Toggle } from '../ui/fields';
import { man } from '../ui/format';
import { useStore } from '../ui/store';

export function EventsPage() {
  const { plan, update, scenarios } = useStore();
  const year = plan.settings.startYear;
  const [addYear, setAddYear] = useState(year + 1);
  const B = plan.settings.bufferRate;
  const set = (id: string, m: (e: LifeEvent) => void) => update((d) => m(d.events.find((x) => x.id === id)!));
  const sorted = [...plan.events].sort((a, b) => a.year - b.year);
  const lastYear = plan.self.birthYear + plan.settings.endAge;

  return (
    <div className="page">
      <Card title="イベントを追加">
        <div className="row-edit">
          <NumberField label="実施年" unit="年" value={addYear} onChange={(v) => setAddYear(Math.round(v))} hint={`本人 ${addYear - plan.self.birthYear}歳`} />
        </div>
        <div className="template-grid">
          {EVENT_TEMPLATES.map((t) => (
            <button
              key={t.key}
              className="template"
              onClick={() => update((d) => t.build(addYear).forEach((e) => d.events.push({ ...e, id: uid() })))}
            >
              <span className="template-icon">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
        <Note>
          金額は世間一般の目安（今の物価）で入ります。支出は ×{B}（バッファ）・物価上昇を掛けて計算します。結婚は{SOURCES.wedding}、介護は{SOURCES.care}を参考にしています。
          出産・教育費・住宅購入はそれぞれ「家族」「住まい」で入力してください。
        </Note>
      </Card>

      <Card title={`登録済みのイベント（${plan.events.length}件）`}>
        {sorted.length === 0 && <Note>まだイベントはありません。</Note>}
        {sorted.map((e) => {
          const count = Array.from({ length: lastYear - year + 1 }, (_, i) => year + i).filter((y) => eventOccurs(e, y)).length;
          return (
            <div key={e.id} className={`subcard event ${e.kind}`}>
              <div className="subcard-head">
                <strong>
                  {e.icon} {e.name}
                  <span className="muted small">
                    {' '}
                    {e.year}年（{e.year - plan.self.birthYear}歳）{e.repeatEvery > 0 ? ` から${e.repeatEvery}年ごと・計${count}回` : ''}
                  </span>
                </strong>
                <button className="btn ghost danger" onClick={() => update((d) => void (d.events = d.events.filter((x) => x.id !== e.id)))}>
                  削除
                </button>
              </div>
              <div className="row-edit">
                <TextField label="名前" value={e.name} onChange={(v) => set(e.id, (x) => void (x.name = v))} />
                <SelectField label="種類" value={e.kind} options={{ expense: '支出', income: '収入' }} onChange={(v) => set(e.id, (x) => void (x.kind = v))} />
                <NumberField label="年" unit="年" value={e.year} onChange={(v) => set(e.id, (x) => void (x.year = Math.round(v)))} />
                <NumberField label="金額（1回あたり）" unit="万円" value={e.amount} onChange={(v) => set(e.id, (x) => void (x.amount = v))} />
                <NumberField label="繰り返し（0=1回のみ）" unit="年" value={e.repeatEvery} onChange={(v) => set(e.id, (x) => void (x.repeatEvery = Math.max(0, Math.round(v))))} hint="◯年ごと" />
                {e.repeatEvery > 0 && <NumberField label="最終年" unit="年" value={e.endYear} onChange={(v) => set(e.id, (x) => void (x.endYear = Math.round(v)))} />}
              </div>
              <div className="toggles">
                {e.kind === 'expense' && <Toggle label={`×${B}（バッファ）`} checked={e.buffer} onChange={(v) => set(e.id, (x) => void (x.buffer = v))} />}
                <Toggle label="物価上昇を反映" checked={e.inflate} onChange={(v) => set(e.id, (x) => void (x.inflate = v))} />
              </div>
            </div>
          );
        })}
      </Card>

      <Card title="タイムライン">
        <ol className="timeline">
          {scenarios.standard.rows
            .filter((r) => r.eventLabels.length > 0)
            .map((r) => (
              <li key={r.year}>
                <span className="tl-year">
                  {r.year}年<small>{r.ageSelf}歳</small>
                </span>
                <span className="tl-events">{r.eventLabels.join(' / ')}</span>
                <span className="tl-amount muted">{r.events > 0 ? `イベント支出 ${man(r.events)}` : ''}</span>
              </li>
            ))}
        </ol>
      </Card>
    </div>
  );
}
