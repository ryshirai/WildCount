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
| トップ（作成 / 参加） | **ローカル対戦を主導線**（人数 3–4・表示名・任意シード）。ルーム作成/参加は UI モック。`?mock=1` は開発用 details |
| 待機ロビー | ローカルデモ：自己 + ボット3体表示。開始でエンジン接続 |
| ゲーム画面（PC） | **エンジン接続済み（ローカル）**：円形席 + 中央宣言 + 操作バー + イベントログ。**インディアンポーカー式**（自分の札は `?`、他は表向き） |
| ゲーム画面（モバイル） | **エンジン接続済み（ローカル）**：同上のカード見え方 |
| 結果・カード公開 | **エンジン接続済み + B5 演出**：スタッガー公開・特殊札 CSS/SVG・計算ステップ段階ハイライト（`lastOutcome.calculation`） |
| データ | Pinia `localGame` + mapper。固定モックは `?mock=1` で参照可 |
| ゲームエンジン | **ローカル接続済み**（Worker / WebSocket なし） |
| チャット | UIのみ（MVP外・トースト表示） |
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

- トップ「ローカルデモを開始」→ 人数/表示名/シード → `startLocalGame` → `/game`
- ロビー「ゲームを開始」→ 同上（4 席固定）
- ゲームの「宣言する」「コヨーテ！」→ `applyAction` 経由（ボットは見える札で概算）
- コヨーテ後 → カード公開 → `/result` →「次のラウンドへ」→ `/game`
- ゲーム終了 →「もう一度遊ぶ」（前回設定維持）/「トップへ」
- 旧モック: `?mock=1`（トップ details 内）

## ローカル接続アーキテクチャ（Phase 0.5）

```
src/
├── stores/localGame.ts       # Pinia: GameState 保持・ボット・pendingResult
├── mappers/
│   ├── toGameView.ts         # GameState → UI ViewModel
│   └── toResultView.ts       # ChallengeOutcome + hands → ResultMock
├── localGame/
│   ├── bot.ts                # 見える札概算ポリシー（B6）
│   └── profiles.ts           # self + ボット / buildDemoLineup
├── domain/game/              # 純粋エンジン（Vue 非依存・変更なし）
└── views/
    ├── GameView.vue
    └── ResultView.vue
```

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
│   │   └── MockBadge.vue
│   └── game/
│       ├── GameHeader.vue
│       ├── PlayerCircle.vue
│       ├── PlayerSeat.vue
│       ├── PlayerAvatar.vue
│       ├── BidCard.vue
│       ├── CurrentBidDisplay.vue
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
- 席 UI（B4）: 手番金リング、宣言済みチップ、手札下宣言チップ、ステータスバー色分け
- 結果 UI（B5）: `RevealCardTile`、公開スタッガー、計算ステップハイライト
- コヨーテ成立: `CoyoteCutIn` → **ゲーム画面でカード公開** → 「結果を見る」→ 勝敗・合計計算

## ローカルデモ UX（B6）

- ボット: 他者カードの粗い合計推定で宣言・チャレンジ
- 設定: 3/4 人・表示名・任意シード（空なら毎回ランダム）
- 終了: 勝者表示 → もう一度 / トップ
- 思考ペース: 3–5 秒（`botDelayMs` でテスト上書き可）

## 次の画面候補

1. 任意 B7: 砂漠背景強化 / PWA マニフェスト
2. Cloudflare Worker / DO によるマルチプレイ接続
2. 見た目の詰め（アバター・背景・席配置）
3. デッキ選択 UI / ルームコード本実装
