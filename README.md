# CreatLifePlan

ライフプランをシミュレーションし、「将来お金が足りるか」を確認するための Web アプリです。

- 収入・家計・住まい・貯蓄/投資・子供・ライフイベントを入力すると、100歳までの資産推移を年単位で計算します
- 世間一般の費用（標準値）は **×1.1（バッファ）** で計算します（倍率は設定で変更可）
- 楽観・標準・悲観の3シナリオで判定（✅安心 / ⚠️注意 / ⛔不足）し、不足する場合は改善策を逆算して提案します
- グラフはクリックでその年の内訳を表示。キャッシュフロー表、プラン比較、Excel（.xlsx）/CSV 出力に対応

## ブラウザで使う

- **公開版（GitHub Pages）: https://narumi7.github.io/CreatLifePlan/**
  - main ブランチに変更が入ると自動で更新されます（`.github/workflows/pages.yml`）
  - 入力したデータは各自のブラウザの中だけに保存され、サイトには送信されません
- claude.ai アーティファクト版（本人のみ閲覧可）: https://claude.ai/artifact/Y94kXVrM3Q4BHWFFjoBQXk
- `npm run build:artifact` で、すべてを1ファイルにまとめた `artifact/lifeplan.html` を作れます（アーティファクトの更新用）

## データの保存とプライバシー

- 入力内容は **このブラウザの中（localStorage）だけ** に自動保存され、サーバーには一切送信しません
- 本番ビルドには `connect-src 'none'` の Content-Security-Policy を入れ、外部通信そのものを禁止しています
- 複数のプランを保存・複製・比較できます
- バックアップファイル（JSON）に書き出せます。パスワードを設定すると AES-256-GCM（PBKDF2-SHA256 で鍵を導出）で暗号化されます

## 開発

```bash
npm install
npm run dev        # 開発サーバー http://localhost:5173
npm test           # 計算エンジン・保存処理のテスト
npm run typecheck
npm run build      # dist/ に静的ファイルを出力（GitHub Pages などに置くだけで動きます）
```

## 構成

| パス | 内容 |
|------|------|
| `src/engine/` | 計算エンジン（純粋関数）。税・社会保険、ローン、年金、教育費、シミュレーション、判定・改善提案 |
| `src/engine/standards.ts` | 標準費用マスタ（教育費・養育費・イベント費用・制度上限など）と出典 |
| `src/storage/` | 端末内保存（localStorage）と暗号化バックアップ |
| `src/export/` | Excel / CSV 出力 |
| `src/pages/`, `src/ui/` | 画面・グラフ |

仕様は [docs/SPEC.md](docs/SPEC.md) を参照してください。
