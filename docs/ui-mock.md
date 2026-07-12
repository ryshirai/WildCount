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
| ゲーム画面（PC） | モック実装済み：円形10人席 + 中央宣言 + 操作バー + イベントログ |
| ゲーム画面（モバイル） | モック実装済み：横スクロール席 + 中央宣言 + 下部操作 + タブ |
| データ | `src/data/mockGame.ts` の固定値（Round 3 / 宣言 18） |
| ゲームエンジン | 未接続 |
| ルーム作成・参加 | 未実装 |
| チャット | UIのみ（MVP外・トースト表示） |

## コンポーネント構成

```
src/
├── views/GameView.vue              # レスポンシブの親
├── components/game/
│   ├── GameHeader.vue
│   ├── PlayerCircle.vue            # PC: 楕円配置
│   ├── PlayerSeat.vue
│   ├── PlayerAvatar.vue
│   ├── BidCard.vue
│   ├── CurrentBidDisplay.vue
│   ├── BidControls.vue
│   ├── EventLog.vue
│   └── MobilePlayerCarousel.vue
├── data/mockGame.ts
└── types/game.ts
```

## デザイン方針

- 夜砂漠テーマ（`night` / `gold` / `teal` トークン — `tailwind.config.js`）
- フォント: 本文 Noto Sans JP / 数字・ロゴ Cinzel
- アバターは暫定絵文字（後でオリジナルイラスト差し替え）
- PC: `lg` 以上で円形レイアウト、未満はモバイル

## 次の画面候補

1. トップ / ルーム作成・参加
2. 待機ロビー（ホスト開始）
3. 結果・カード公開・計算過程
4. ゲーム終了（勝者表示）
