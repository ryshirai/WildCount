# UI 実装メモ

デザインモック（`docs/画面イメージ.png`）をベースにしたフロントエンド。  
**全面 UI リデザイン（Phase R0–R6）完了** — 正本の計画・受け入れ: `docs/ui-redesign.md`。

## 起動

```bash
npm install
npm run dev
# → http://localhost:5173/
# Worker 付き: npm run worker:dev（別ターミナル）+ フロント
```

## 現状

| 項目 | 状態 |
|------|------|
| トップ（作成 / 参加） | **本番**: オンライン作成/参加のみ。**DEV**: ローカル対戦 + 開発用 mock 導線（`src/config/runtime.ts`）。SP: コンパクトプロフィール＋CTA 優先。PC: プロフィール｜ルーム操作の 2 カラム + ゲーム設定折りたたみ |
| 待機ロビー | オンライン: 参加者一覧が主役・最大10席・準備状態強調。PC: 横長コードヘッダ + 左参加者 / 右設定タグ+チャット（max ~1100px）。設定詳細・プロフィールはモーダル（インライン展開なし＝縦伸び防止）。開始理由表示・解散は危険アウトライン |
| ゲーム画面（PC / タブレット） | **md+ (768)** 楕円席 + 中央宣言 + 操作バー。**≥1100** 右レール（ログ/チャット）。**md–1099** はボトムナビ（スタンプ/チャット/ログ）+ ドロワー。FHD/短高は density 圧縮 |
| ゲーム画面（スマホ） | **&lt;768** ヘッダ・カルーセル・特殊能力シート・ミニドック・底ナビ（R4） |
| 結果・カード公開 | 結果ヒーロー（成功/失敗 + 宣言 vs 合計 + ライフ変化）→ 公開カード｜合計式（詳細は折りたたみ）。PC `max-w-[1080px]` 2 カラム + 下固定 CTA。紙吹雪・短い結果演出 |
| デザインシステム | `.field` / `btn-sm` / `chip-*` / `AppHeader` / `AppToast` / `AppConfirmDialog` / `StatusChip`（R0） |
| マイクロ演出 | 宣言 FX・Coyote・Extra・ROUND・confetti・stamp float 等（CSS、`prefers-reduced-motion` 対応）+ SFX（D2）+ 触覚（D4、初期 OFF） |
| ドラマ差（第3波） | 結果マージン（ジャスト/ギリギリ/大差）・脱落・自己視点コピー・札強調（self/特殊/極端）・初手/+5 宣言 cut-in |
| データ | Pinia `localGame` / `onlineGame` + mapper。固定モックは `?mock=1`（DEV） |
| ゲームエンジン | ローカル + オンライン（Worker / DO / WS）。再接続・ホスト移譲・再戦・途中抜け込み |
| チャット / スタンプ | オンラインのみ。ルーム履歴 + キャラ別スタンプ WebP |
| ヘルプ | モーダル（遊び方 / 特殊札 / 合計計算 / 操作）。Home は CTA、Lobby は「説明」、Game はヘッダ「説明」メニュー |
| 背景 | `.desert-bg` 夜砂漠 |
| PWA | `vite-plugin-pwa` + `public/icons` |

## ルート

| パス | 画面 |
|------|------|
| `/` | トップ（ルーム作成 / コード参加 / **DEV: ローカルデモ**） |
| `/lobby` | 待機ロビー → host 開始（オンライン）/ ローカル demo 導線（DEV） |
| `/game` | ゲーム画面 |
| `/game?mock=1` | ゲーム画面（DEV 固定モック） |
| `/result` | 結果・カード公開（`pendingResult`） |
| `/result?mock=1` | 結果（DEV 固定モック） |
| `/game-mock` | → `/game` へリダイレクト |

導線:

- **本番**: トップ「ルーム作成/参加」→ ロビー → ゲーム → 結果（オンラインのみ）
- **DEV のみ**: トップ「ローカルデモを開始」→ `startLocalGame` → `/game`；`?mock=1`；オフラインロビー可
- フラグ: `allowLocalPlay` / `allowUiMock` = `import.meta.env.DEV`

## ページシェル契約（R0 / 実装）

| シェル | 用途 | ルール |
|--------|------|--------|
| `page-scroll` | Home | ルートがスクロール |
| `page-fixed` | Lobby / Game / Result | 固定ビューポート。本文 or 領域だけ内部スクロール。Lobby は底 sticky CTA |
| ヘッダ | Lobby / Game / Result | `AppHeader`（同一 blur・border。Game は `compact` 可） |
| safe-area | `safe-top` はヘッダ **または** 切断バナーのどちらか一方 | 二重 padding 禁止。下端 fixed / ボトムシートは `safe-bottom` |
| `safe-x` / `safe-bottom` | 全画面ルート | ノッチ・ホームインジケータ |
| max-width | Home SP `max-w-lg` · PC `max-w-[1080px]` 2 カラム / Lobby PC `max-w-[1100px]` 2 カラム（参加者｜設定+チャット） / Result `max-w-[1080px]`（ヒーロー + カード｜計算 + sticky CTA） / Game full | |

共通クラス: `.panel` / `.btn-gold` / `.btn-teal` / `.btn-ghost` / `.btn-sm` / `.btn-icon` / `.btn-danger` / `.chip` / `.chip-teal|muted|danger|gold` / `.field` / `.field-label` / `.field-mono` / `.desert-bg` / `.seat-chip-*` / `.bid-chip` / `.game-table-felt`（PC 卓）

## アーキテクチャ概要

```
src/
├── stores/localGame.ts       # Pinia: ローカル GameState・ボット・pendingResult
├── stores/onlineGame.ts      # Worker WS クライアント
├── online/                   # protocol / workerUrl / resumeStorage / clockDisplay
├── mappers/
│   ├── toGameView.ts
│   └── toResultView.ts
├── localGame/                # bot / profiles / avatarCatalog
├── domain/game/              # 純粋エンジン（Vue 非依存）
├── components/
│   ├── common/               # AppHeader, AppToast, AppConfirmDialog, StatusChip, HelpModal, …
│   ├── game/                 # GameDesktop/MobileLayout, SeatContent, BidControls, …
│   └── lobby/                # Deck / ExtraRules / TimeControl
└── views/
    ├── HomeView.vue
    ├── LobbyView.vue
    ├── GameView.vue          # 状態機械 + レイアウト切替（薄い）
    └── ResultView.vue
```

オンライン詳細: `docs/phase1-multiplayer.md` · Worker: `worker/` · デプロイ: `docs/deploy.md`

### チャレンジ後の結果表示

- チャレンジ直前の `hands` / `round` をスナップショット
- `applyAction(CHALLENGE)` 後の `lastOutcome` と合わせて `pendingResult`
- 結果画面は `pendingResult` のみ参照
- オンラインは全員 `dismiss_result` まで次ラウンド開始しない

## 画面別コンポーネント（要点）

| 画面 | 主な部品 |
|------|----------|
| Home | `AppLogo` / `AvatarPicker` / `StatusChip` / `AppToast` / `HelpModal` |
| Lobby | `AppHeader` + sticky CTA / `DeckSettingsPanel` / `ExtraRulesPanel` / `TimeControlPanel` / `ChatPanel` |
| Game | `GameHeader`（設定・説明メニュー + 退出）/ `PlayerCircle`+`PlayerSeat`+`SeatContent` / `MobilePlayerCarousel` / `CurrentBidDisplay` / `BidControls` / `EventLog` / `ChatPanel` / cut-ins |
| Result | `AppHeader` / 結果ヒーロー（数値比較・ライフバー）/ `RevealCardTile` 横並び / 簡潔な合計式 + 詳細折りたたみ / sticky CTA / `FxConfetti` |

席表示の hand / status / bid は **`SeatContent`** に集約（PC 席と SP カルーセルで共有）。

## デザイン方針

- 夜砂漠テーマ（`night` / `gold` / `teal` / `sand` — `tailwind.config.js`）
- フォント: 本文 Noto Sans JP / 数字・ロゴ Cinzel
- アバター・スタンプはオリジナル WebP（失敗時絵文字フォールバック）
- PC: `lg+` 楕円席レイアウト（グリッド化しない） / 未満はモバイル
- 日本語 UI を正（ブランド英語: Wild Count / COYOTE カットイン等のみ）
- 演出は内容の強調。常時クロムの代わりにしない

## ローカルデモ UX（DEV）

- ボット: 他者カードの粗い合計推定で宣言・チャレンジ
- 設定: 3/4 人・表示名・任意シード
- 終了: 勝者表示 → もう一度遊ぶ
- 思考ペース: 3–5 秒（`botDelayMs` でテスト上書き可）

## 関連ドキュメント

| ドキュメント | 内容 |
|--------------|------|
| `docs/ui-redesign.md` | Phase R 計画・受け入れ（正本） |
| `docs/design-polish-plan.md` | Phase B 見た目磨き（アバター等・完了） |
| `docs/design-overview.md` | 全体設計 |
| `docs/backlog.md` | 残タスク |
| `docs/phase1-multiplayer.md` | オンライン仕様 |
| `docs/extra-rules.md` | エクストラルール |
