# Wild Count 作業ログ

時系列で作業内容を残すメモ。詳細な設計は各仕様書を参照。

---

## 2026-07-12 — UI モック着手（ゲーム画面）

### 背景・目的

- プロジェクト概要（README / `docs/design-overview.md` / ルール・カード仕様）を確認したうえで、**画面デザインモック（`docs/画面イメージ.png`）から実装に入る**方針で着手。
- ゲームエンジンや Durable Objects より先に、見た目と画面骨格を固定する。

### 実施内容

1. **フロント足場**
   - Vite + Vue 3 + TypeScript + Pinia + Vue Router
   - Tailwind CSS v3（夜砂漠テーマのデザイントークン）
   - 既存 `package.json` / `wrangler.jsonc` に合わせて構成

2. **ゲーム画面 UI モック**
   - 参照: `docs/画面イメージ.png`（PC + スマホ並置）
   - モック状態: ルーム `AB7KQ2` / 10 players / Round 3 / 現在宣言 `18`
   - データ: `src/data/mockGame.ts`（固定値・ロジック未接続）

3. **レイアウト**
   - **PC (`lg+`)**: 10人楕円配置、中央「現在の宣言」、下部操作バー、右サイド「イベントログ」
   - **モバイル**: 横スクロール席、中央宣言パネル、下部操作、タブ（チャット / プレイヤー / ログ）
   - 宣言ステッパー（±1, +1, +5）、「宣言する」「コヨーテ！」→ トーストのみ

4. **ドキュメント**
   - `docs/ui-mock.md` … UI モックの構成・起動方法・次画面候補

### 追加・変更した主なパス

| パス | 内容 |
|------|------|
| `index.html` / `vite.config.ts` / `tsconfig*.json` / `env.d.ts` | ビルド設定 |
| `tailwind.config.js` / `postcss.config.js` | Tailwind |
| `src/main.ts` / `src/App.vue` / `src/router/index.ts` | アプリ入口 |
| `src/styles/main.css` | テーマ・コンポーネント用ユーティリティ |
| `src/types/game.ts` | UI 用型（後で domain と揃える想定） |
| `src/data/mockGame.ts` | デザインモック相当の固定データ |
| `src/views/GameView.vue` | ゲーム画面（レスポンシブ親） |
| `src/components/game/*` | Header / Seat / Circle / Bid / Log / Mobile など |
| `public/favicon.svg` | 仮ファビコン |
| `docs/ui-mock.md` | UI モック説明 |
| `docs/work-log.md` | 本作業ログ |

### 明示的にやっていないこと

- ゲームエンジン（`src/domain/game/`）
- Cloudflare Workers / Durable Objects 実装
- ルーム作成・参加・ロビー
- 結果・カード公開画面
- オリジナル動物イラスト（アバターは絵文字暫定）
- チャット本体（UI のみ、MVP 外のまま）
- Playwright によるスクショ自動取得（実行環境の共有ライブラリ不足で未実施）

### 確認結果

- `npm run dev` → `http://localhost:5173/` で表示
- `npm run build` 成功

### 次に考えられる作業

1. 他画面モック（トップ / 参加 / ロビー / 結果）
2. 見た目の詰め（アバター・背景・席配置）
3. Phase 0 ゲームエンジン（純粋関数）

---

## 2026-07-12 — .gitignore 追加と初回コミット

### 背景・目的

- 作業状態を Git に残す。`node_modules` 等はリポジトリに含めない。

### 実施内容

1. `.gitignore` を追加（`node_modules/`, `dist/`, Wrangler/環境変数/ログなど）
2. 初回コミット（ソース・docs・設定・lockfile を含む）

### 主なパス変更

| パス | 内容 |
|------|------|
| `.gitignore` | 依存・ビルド成果物・秘密情報の除外 |
| （一式） | 初回コミット対象 |

### 確認結果

- `node_modules` / `dist` がコミット対象外であること

---

## 2026-07-12 — AGENTS.md に作業ログ必須ルールを追加

### 背景・目的

- 毎回作業ログを残す運用をエージェント指示に固定するため。

### 実施内容

1. 空だった `AGENTS.md` に作業ログ必須ルールを記載
2. 書き方テンプレ・追記方針（上書き禁止）・スキップ条件を明記
3. 本ファイルへの追記

### 主なパス変更

| パス | 内容 |
|------|------|
| `AGENTS.md` | 作業ログ必須のエージェント指示 |
| `docs/work-log.md` | 本エントリ |

### 確認結果

- なし（ドキュメントのみ）

---

## 2026-07-12 — 非ゲーム画面 UI モック（トップ / ロビー / 結果）

### 背景・目的

- ゲーム画面以外の UI 骨格を揃え、ルーム作成〜待機〜対局〜結果の画面遷移をモックで確認できるようにする。
- 方針: `docs/画面イメージ.png` / `docs/ui-mock.md` / `docs/design-overview.md`（夜砂漠トークン、ロジック未接続）

### 実施内容

1. **トップ**（`/`）— ルーム作成 / コード入力で参加。モック導線リンク付き
2. **待機ロビー**（`/lobby`）— ルームコード表示・コピー、参加者一覧、ホストの開始ボタン
3. **結果・カード公開**（`/result`）— 勝敗バナー、全カード公開、合計計算過程の仮置き（game-rules 順序）
4. **ルーティング** — `/` `/lobby` `/game` `/result`（`/game-mock` → `/game`）
5. ゲーム画面の「コヨーテ！」から結果へモック遷移。共通 `AppLogo` / `MockBadge`
6. `docs/ui-mock.md` 更新

### 主なパス変更

| パス | 内容 |
|------|------|
| `src/views/HomeView.vue` | トップ |
| `src/views/LobbyView.vue` | 待機ロビー |
| `src/views/ResultView.vue` | 結果・公開 |
| `src/views/GameView.vue` | 結果遷移・モックナビ |
| `src/router/index.ts` | ルート定義 |
| `src/data/mockLobby.ts` / `mockResult.ts` | 固定モック |
| `src/types/game.ts` | Lobby / Result 型 |
| `src/components/common/*` | ロゴ・バッジ |
| `docs/ui-mock.md` / `docs/work-log.md` | ドキュメント |

### 明示的にやっていないこと

- ゲームエンジン・Worker / WebSocket 接続
- ルームコード生成・参加の実ロジック
- ゲーム終了（勝者表示）画面
- 計算過程の実エンジン連携（仮置きデータのまま）

### 確認結果

- `npm run build` 成功

### 次に考えられる作業

1. ゲーム終了（勝者表示）モック
2. 見た目の詰め（アバター・背景）
3. Phase 0 ゲームエンジン接続

---

## ログの書き方

**正規のルールは `AGENTS.md` を参照。** 変更のあったセッションでは、このファイルに日付見出しで **追記** する（過去エントリは消さない）。
