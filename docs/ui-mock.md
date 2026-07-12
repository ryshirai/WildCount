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
| トップ（作成 / 参加） | モック実装済み：ルーム作成・コード入力 → ロビーへ遷移 |
| 待機ロビー | モック実装済み：参加者一覧・ルームコード・ホスト開始 |
| ゲーム画面（PC） | モック実装済み：円形10人席 + 中央宣言 + 操作バー + イベントログ |
| ゲーム画面（モバイル） | モック実装済み：横スクロール席 + 中央宣言 + 下部操作 + タブ |
| 結果・カード公開 | モック実装済み：公開カード + 合計計算過程の仮置き |
| データ | `src/data/mock*.ts` の固定値 |
| ゲームエンジン | 未接続 |
| チャット | UIのみ（MVP外・トースト表示） |

## ルート

| パス | 画面 |
|------|------|
| `/` | トップ（ルーム作成 / コード参加） |
| `/lobby` | 待機ロビー |
| `/game` | ゲーム画面 |
| `/result` | 結果・カード公開 |
| `/game-mock` | → `/game` へリダイレクト |

モック導線:

- トップ下部の「UI モック導線」から各画面へ
- ゲームの「コヨーテ！」→ 結果画面（約0.6秒後）
- ロビーの「ゲームを開始」→ ゲーム画面

## コンポーネント構成

```
src/
├── views/
│   ├── HomeView.vue                # トップ
│   ├── LobbyView.vue               # 待機ロビー
│   ├── GameView.vue                # ゲーム（レスポンシブ）
│   └── ResultView.vue              # 結果・公開
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
│       └── MobilePlayerCarousel.vue
├── data/
│   ├── mockGame.ts
│   ├── mockLobby.ts
│   └── mockResult.ts
└── types/game.ts
```

## デザイン方針

- 夜砂漠テーマ（`night` / `gold` / `teal` トークン — `tailwind.config.js`）
- フォント: 本文 Noto Sans JP / 数字・ロゴ Cinzel
- アバターは暫定絵文字（後でオリジナルイラスト差し替え）
- PC: `lg` 以上で円形レイアウト、未満はモバイル
- 共通クラス: `.panel` / `.btn-gold` / `.btn-teal` / `.chip` / `.desert-bg`

## 次の画面候補

1. ゲーム終了（勝者表示）
2. 見た目の詰め（アバター・背景・席配置）
3. エンジン接続後の実データ差し替え
