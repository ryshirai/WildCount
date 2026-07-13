# UI モック実装メモ

デザインモック（`docs/画面イメージ.png`）をベースにしたフロントエンド骨格です。

## 起動

```bash
npm install
npm run dev
# → http://localhost:5173/
```

## 現状

| 項目 | 状態 |
|------|------|
| トップ（作成 / 参加） | **本番**: オンライン作成/参加のみ。**DEV**: ローカル対戦 + 開発用 mock 導線（`src/config/runtime.ts`） |
| 待機ロビー | オンライン：WS メンバー同期・host 開始。モック導線時は従来デモ lineup |
| ゲーム画面（PC） | **エンジン接続済み（ローカル）**：円形席 + 中央宣言 + 操作バー + イベントログ。**インディアンポーカー式**（自分の札は `?`、他は表向き） |
| ゲーム画面（モバイル） | **エンジン接続済み（ローカル）**：同上のカード見え方 |
| 結果・カード公開 | **エンジン接続済み + B5 演出**：スタッガー公開・特殊札 CSS/SVG・計算ステップ段階ハイライト（`lastOutcome.calculation`）＋ 合計カウントアップ / 紙吹雪 |
| マイクロ演出 | **第1波**: 宣言ポップ / `+N` / bid-chip / 手番 arrive / confetti。**第2波**: ROUND スラム・手番エッジ光・特殊札キラキラ・ライフ♥割れ・勝敗 vignette・スタンプ放射・ロビー ready/join/copy・ホーム CTA press。**宣言**: 中央 ripple / 数字エコー / 「宣言！」バッジ + ボタンから数字 launch（いずれも CSS・`prefers-reduced-motion` 対応。効果音は未） |
| データ | Pinia `localGame` + mapper。固定モックは `?mock=1` で参照可 |
| ゲームエンジン | **ローカル** + **オンライン P1-3**（ロビー〜宣言/コヨーテ/結果。再接続磨きは P1-4） |
| チャット | **UX-6 実装**: オンラインのみ。ロビー＋ゲーム（デスクトップ右タブ / モバイル下部タブ）。ローカルは入力不可 |
| ヘルプ | **UX-5**: モーダル（遊び方 / 特殊札 / 合計計算 / 操作）。Home・Lobby・Game ヘッダ `?` |
| 背景 | **B7**: `.desert-bg` 夜砂漠（月・砂丘・星・シルエット） |
| PWA | **B7**: `vite-plugin-pwa` + `public/icons` マニフェスト（ホーム画面追加可） |

## ルート

| パス | 画面 |
|------|------|
| `/` | トップ（ルーム作成 / コード参加 / **ローカルデモ開始**） |
| `/lobby` | 待機ロビー → 「ゲームを開始」で `startLocalGame` |
| `/game` | ゲーム画面（エンジン） |
| `/game?mock=1` | ゲーム画面（旧固定モック） |
| `/result` | 結果・カード公開（`pendingResult`） |
| `/result?mock=1` | 結果（旧固定モック） |
| `/game-mock` | → `/game` へリダイレクト |

導線:

- **本番**: トップ「ルーム作成/参加」→ ロビー → ゲーム → 結果（オンラインのみ）
- **DEV のみ**: トップ「ローカルデモを開始」→ `startLocalGame` → `/game`；`?mock=1` 固定モック；オフラインロビー
- ゲームの「宣言する」「コヨーテ！」→ online / local の store 経由
- コヨーテ後 → カード公開 → `/result` →「次のラウンドへ」→ `/game`
- ゲーム終了 →「もう一度遊ぶ」（結果画面にトップへは置かない）
- フラグ: `allowLocalPlay` / `allowUiMock` = `import.meta.env.DEV`

## ローカル接続アーキテクチャ（Phase 0.5）

```
src/
├── stores/localGame.ts       # Pinia: GameState 保持・ボット・pendingResult
├── stores/onlineGame.ts      # Phase 1: Worker WS クライアント
├── online/                   # protocol / workerUrl / resumeStorage
├── mappers/
│   ├── toGameView.ts         # GameState → UI ViewModel
│   └── toResultView.ts       # ChallengeOutcome + hands → ResultMock
├── localGame/
│   ├── bot.ts                # 見える札概算ポリシー（B6）
│   └── profiles.ts           # self + ボット / buildDemoLineup
├── domain/game/              # 純粋エンジン（Vue 非依存）
└── views/
    ├── GameView.vue
    └── ResultView.vue
```

オンライン詳細: `docs/phase1-multiplayer.md` · Worker: `worker/`

### チャレンジ後の結果表示方針

エンジンはチャレンジ解決後に **自動で次ラウンド**（または `game_over`）へ進む。

- チャレンジ直前の `hands` と `round` をセッションにスナップショット
- `applyAction(CHALLENGE)` 後の `lastOutcome` と合わせて `pendingResult` を構築
- 結果画面は `pendingResult` のみ参照（次ラウンド state は裏で保持）
- 「次のラウンドへ」で `clearPendingResult` → `/game` を表示

## コンポーネント構成

```
src/
├── views/
│   ├── HomeView.vue
│   ├── LobbyView.vue
│   ├── GameView.vue
│   └── ResultView.vue
├── components/
│   ├── common/
│   │   ├── AppLogo.vue
│   │   ├── HelpModal.vue        # UX-5 遊び方・ルール
│   │   ├── MockBadge.vue
│   │   └── FxConfetti.vue       # 結果の CSS 紙吹雪
│   └── game/
│       ├── GameHeader.vue
│       ├── PlayerCircle.vue
│       ├── PlayerSeat.vue
│       ├── PlayerAvatar.vue
│       ├── BidCard.vue
│       ├── CurrentBidDisplay.vue # 中央宣言 + 数字ポップ
│       ├── BidControls.vue
│       ├── EventLog.vue
│       ├── MobilePlayerCarousel.vue
│       ├── RevealCardTile.vue   # 結果画面の札（特殊 CSS/SVG）
│       └── CoyoteCutIn.vue      # チャレンジ成立カットイン
├── stores/localGame.ts
├── mappers/
├── localGame/
├── data/                     # 固定モック（?mock=1 フォールバック）
│   ├── mockGame.ts
│   ├── mockLobby.ts
│   └── mockResult.ts
└── types/game.ts             # UI 用型（domain と分離）
```

## デザイン方針

- 夜砂漠テーマ（`night` / `gold` / `teal` トークン — `tailwind.config.js`）
- フォント: 本文 Noto Sans JP / 数字・ロゴ Cinzel
- アバターはオリジナル WebP（失敗時絵文字フォールバック）
- PC: `lg` 以上で円形レイアウト、未満はモバイル
- 共通クラス: `.panel` / `.btn-gold` / `.btn-teal` / `.chip` / `.desert-bg` / `.seat-chip-*` / `.bid-chip`
- 席 UI（B4）: 手番金リング、手札下にステータス（手番/済/待機/あなた/脱落）＋宣言チップ
- 結果 UI（B5）: `RevealCardTile`、公開スタッガー、計算ステップハイライト
- コヨーテ成立: `CoyoteCutIn` → **ゲーム画面でカード公開** → 「結果を見る」→ 勝敗・合計計算
- ドーパミン系: 宣言更新の数字 slam / デルタ浮上、操作ボタン press、手番バー pulse、結果の count-up + confetti

## ローカルデモ UX（B6）

- ボット: 他者カードの粗い合計推定で宣言・チャレンジ
- 設定: 3/4 人・表示名・任意シード（空なら毎回ランダム）
- 終了: 勝者表示 → もう一度遊ぶ
- 思考ペース: 3–5 秒（`botDelayMs` でテスト上書き可）

## 次の画面候補

1. Phase 1 マルチプレイ UI 接続（`docs/phase1-multiplayer.md` — P1-0/P1-1 足場済み）
2. トップ「ルーム作成/参加」を `onlineGame` + Worker に接続（P1-2+）
3. デッキ選択 UI
