import { useEffect, useRef, useState, type ReactNode } from 'react';
import { exportCsv, exportExcel, downloadText } from '../export/excel';
import { createBackup, isEncrypted, readBackup } from '../storage/backup';
import { Card, Grid, Note, NumberField, Toggle } from '../ui/fields';
import { useStore } from '../ui/store';

/** 2回押しで実行する削除ボタン（埋め込み画面では confirm() が使えないため） */
function ConfirmButton({ label, confirmLabel, onConfirm, className }: { label: ReactNode; confirmLabel: string; onConfirm: () => void; className?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      className={`${className ?? 'btn ghost danger'} ${armed ? 'armed' : ''}`}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}

export function ExportCard() {
  const { active, plan, scenarios, judgement, suggestions } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const input = { name: active.name, plan, scenarios, judgement, suggestions };
  const run = async (fn: () => Promise<'saved' | 'declined'>, label: string) => {
    setBusy(true);
    setError('');
    setDone('');
    try {
      if ((await fn()) === 'saved') setDone(`${label}を保存しました`);
    } catch (e) {
      setError(`保存できませんでした: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title="Excel・スプレッドシートに出力">
      <p>
        サマリー・前提条件・月次家計・キャッシュフロー表・教育費・ライフイベント・シナリオ比較・標準費用マスタの8シートを出力します。Google
        スプレッドシートでは「ファイル → インポート」で開けます。
      </p>
      <div className="btn-row">
        <button
          className="btn primary"
          disabled={busy}
          onClick={() => run(() => exportExcel(input), 'Excel ファイル')}
        >
          {busy ? '作成中…' : '📊 Excel（.xlsx）をダウンロード'}
        </button>
        <button className="btn" disabled={busy} onClick={() => run(() => exportCsv(input), 'CSV ファイル')}>
          CSV（キャッシュフロー表）
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {done && <p className="msg">✅ {done}</p>}
    </Card>
  );
}

function PlansCard() {
  const { state, active, selectPlan, addPlan, duplicatePlan, renamePlan, deletePlan } = useStore();
  return (
    <Card
      title="保存しているプラン"
      actions={
        <button className="btn" onClick={() => addPlan(`プラン${state.plans.length + 1}`)}>
          ＋ 新しいプラン
        </button>
      }
    >
      <ul className="plan-list">
        {state.plans.map((p) => (
          <li key={p.id} className={p.id === active.id ? 'active' : ''}>
            <input aria-label="プラン名" value={p.name} onChange={(e) => renamePlan(p.id, e.target.value)} />
            <span className="muted small">更新 {new Date(p.updatedAt).toLocaleString('ja-JP')}</span>
            <div className="btn-row">
              {p.id !== active.id && (
                <button className="btn small" onClick={() => selectPlan(p.id)}>
                  開く
                </button>
              )}
              <button className="btn ghost small" onClick={() => duplicatePlan(p.id)}>
                複製
              </button>
              <ConfirmButton className="btn ghost danger small" label="削除" confirmLabel="もう一度押すと削除" onConfirm={() => deletePlan(p.id)} />
            </div>
          </li>
        ))}
      </ul>
      <Note>入力内容はこのブラウザの中（localStorage）に自動保存されます。サーバーには一切送信しません。</Note>
    </Card>
  );
}

function BackupCard() {
  const { state, importPlans, resetAll } = useStore();
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [msg, setMsg] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [importPw, setImportPw] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const mismatch = password !== '' && password !== password2;

  const doImport = async (text: string, pw?: string) => {
    try {
      const plans = await readBackup(text, pw);
      importPlans(plans);
      setPending(null);
      setImportPw('');
      setMsg(`✅ ${plans.length}件のプランを読み込みました`);
    } catch (e) {
      setMsg(`⚠️ ${(e as Error).message}`);
    }
  };

  return (
    <Card title="バックアップ（別の端末への移行・万一の備え）">
      <p>
        ブラウザのデータを消すとプランも消えるため、ときどきバックアップファイルに保存してください。
        <strong>パスワードを設定すると暗号化（AES-256）</strong>され、ファイルが他人の手に渡っても中身は読めません。
      </p>
      <Grid>
        <div className="field">
          <label htmlFor="pw1">パスワード（任意・推奨）</label>
          <input id="pw1" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="pw2">パスワード（確認）</label>
          <input id="pw2" type="password" autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} />
          {mismatch && <small className="error">パスワードが一致しません</small>}
        </div>
      </Grid>
      <div className="btn-row">
        <button
          className="btn primary"
          disabled={mismatch}
          onClick={async () => {
            const text = await createBackup(state.plans, password || undefined);
            const date = new Date().toISOString().slice(0, 10);
            let result: 'saved' | 'declined';
            try {
              result = await downloadText(text, `lifeplan-backup_${date}${password ? '.encrypted' : ''}.json`);
            } catch (e) {
              setMsg(`⚠️ ${(e as Error).message}`);
              return;
            }
            if (result === 'declined') return;
            setMsg(password ? '🔒 暗号化したバックアップを保存しました。パスワードは忘れないように保管してください（復元できません）。' : '💾 バックアップを保存しました（暗号化なし）。');
          }}
        >
          {password ? '🔒 暗号化して保存' : '💾 バックアップを保存'}
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          📂 バックアップから読み込む
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            const text = await f.text();
            if (isEncrypted(text)) {
              setPending(text);
              setMsg('🔒 暗号化されたファイルです。パスワードを入力してください。');
            } else {
              await doImport(text);
            }
          }}
        />
      </div>
      {pending && (
        <div className="row-edit">
          <div className="field">
            <label htmlFor="pw3">ファイルのパスワード</label>
            <input id="pw3" type="password" value={importPw} onChange={(e) => setImportPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doImport(pending, importPw)} />
          </div>
          <button className="btn primary" onClick={() => doImport(pending, importPw)}>
            復号して読み込む
          </button>
        </div>
      )}
      {msg && <p className="msg">{msg}</p>}
      <hr />
      <ConfirmButton
        label="この端末のデータをすべて削除"
        confirmLabel="もう一度押すとすべてのプランを削除（元に戻せません）"
        onConfirm={resetAll}
      />
    </Card>
  );
}

export function SettingsPage() {
  const { plan, update } = useStore();
  const s = plan.settings;
  return (
    <div className="page">
      <PlansCard />
      <ExportCard />
      <BackupCard />
      <Card title="計算の前提">
        <Grid>
          <NumberField
            label="バッファ率（標準費用に掛ける倍率）"
            unit="倍"
            value={s.bufferRate}
            onChange={(v) => update((d) => void (d.settings.bufferRate = v))}
            hint="1.1 = 世間一般の費用の1.1倍（0.1倍が余裕分）"
          />
          <NumberField label="物価上昇率（年）" unit="%" value={s.inflationRate} onChange={(v) => update((d) => void (d.settings.inflationRate = v))} hint="日銀の物価目標は2%" />
          <NumberField label="シミュレーション終了年齢" unit="歳" value={s.endAge} onChange={(v) => update((d) => void (d.settings.endAge = Math.min(110, Math.max(60, Math.round(v)))))} />
          <NumberField label="開始年" unit="年" value={s.startYear} onChange={(v) => update((d) => void (d.settings.startYear = Math.round(v)))} />
          <NumberField
            label="楽観・悲観シナリオの利回り差"
            unit="%"
            value={s.scenarioSpread}
            onChange={(v) => update((d) => void (d.settings.scenarioSpread = v))}
            hint="標準の利回り ± この値"
          />
          <NumberField
            label="年金のマクロ経済スライド"
            unit="%"
            value={s.pensionSlide}
            onChange={(v) => update((d) => void (d.settings.pensionSlide = v))}
            hint="年金は「物価上昇率 − この値」で増える"
          />
        </Grid>
        <Toggle label="幼保無償化・高校無償化を反映する" checked={s.publicSupport} onChange={(v) => update((d) => void (d.settings.publicSupport = v))} hint="制度変更が心配な場合は OFF にすると保守的に計算します" />
      </Card>
    </div>
  );
}
