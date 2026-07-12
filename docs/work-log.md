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

## 2026-07-12 — Phase 0: 純粋ゲームエンジン実装

### 背景・目的

- UI・通信から分離したゲームコア（合計計算・チャレンジ・ラウンド進行）を `src/domain/game/` に実装する。
- 仕様の正本は `docs/game-rules.md` + `docs/card-design.md`（overview と食い違う箇所は rules 優先）。

### 実施内容

1. **vitest** 導入（`npm test` / `npm run test:watch`）
2. **型・デッキ・乱数**
   - `types.ts` … Card / Player / GameState / Action / CalculationResult 等
   - `deck.ts` … `createDeck`（表どおり 36 枚）+ `shuffle`
   - `random.ts` … `RandomSource` / `seedRandom`（mulberry32）
3. **合計計算** `calculate.ts` — game-rules の順序（MAX→0 → 数値合計 → DOUBLE 累積）。過程付き `CalculationResult`
4. **チャレンジ** `resolve.ts` — `actualTotal >= bid` なら宣言側勝ち（同値含む）→ 敗者ライフ −1
5. **状態機械** `engine.ts` + `validate.ts` — START_GAME / PLACE_BID / CHALLENGE（チャレンジ後は自動で次ラウンド or game_over）
6. **テスト** `tests/domain/game/` — 計算表形式・同値チャレンジ・脱落/終了・シード固定 10,000 ゲームシミュレーション
7. **docs** — 本ログ + `game-rules.md` に Phase 0 確定細部を追記

### 仕様判断（あいまい点の採用）

| 項目 | 判断 |
|------|------|
| 合計値0化（overview §3） | **未採用 / 保留**（card-design に該当カードなし） |
| パス | **なし**（宣言 or チャレンジのみ） |
| 初手宣言下限 | **0** |
| REDRAW `?` | 配ったら即捨てて再ドロー（手札に残さない） |
| ZERO_MIX | 合計は 0。配札後に捨て札を山へ戻してシャッフル |
| デッキ枚数 | 表合計 **36**（ドキュメントヘッダの 54 は表と不一致 → 表を正） |

### 主なパス変更

| パス | 内容 |
|------|------|
| `src/domain/game/*` | エンジン本体（types / deck / random / calculate / resolve / engine / validate / index） |
| `tests/domain/game/*` | 単体 + シミュレーション |
| `package.json` / `vite.config.ts` | vitest |
| `docs/game-rules.md` | Phase 0 確定細部 |
| `docs/work-log.md` | 本エントリ |

### 明示的にやっていないこと

- Vue / Pinia / モック画面との接続
- Cloudflare Worker / Durable Object / WebSocket
- ルームコード・ホスト移譲・再接続
- パス手番・合計値0化カード
- E2E（Playwright）

### 確認結果

- `npm test` — 29 tests passed（内 10,000 ゲームシミュレーション）
- `npm run build` — 成功（UI モック非破壊）

### 次に考えられる作業

1. エンジン結果を Result 画面モックに接続（`CalculationResult` 変換）
2. Worker 側で `applyAction` を正本状態として保持
3. パス / 合計値0化など保留ルールの正式採用
4. デッキ 54 枚プリセット追加・ルーム作成 UI でデッキ選択

---

## 2026-07-12 — デッキ構成を拡張可能に（DeckComposition）

### 背景・目的

- 将来ルーム作成時にカード枚数・構成を選べるようにするため、固定 36 枚直書きから宣言的な構成に変更する。

### 実施内容

1. `DeckComposition` / `NumberCount` / `SpecialCounts` 型を追加
2. `STANDARD_DECK` + `DECK_PRESETS`（当面 `standard` のみ）
3. `createDeck(composition?)` / `countCards` / `validateDeckComposition` / `resolveDeckComposition` / `defineDeckComposition`
4. `GameConfig.deck` に構成を保持。`startGame({ config: { deck: 'standard' | DeckComposition } })`
5. テスト `tests/domain/game/deck.test.ts` と docs 追記

### 主なパス変更

| パス | 内容 |
|------|------|
| `src/domain/game/deck.ts` | 構成ベースのデッキ生成 |
| `src/domain/game/types.ts` | DeckComposition / GameConfig.deck |
| `src/domain/game/engine.ts` | START_GAME で config.deck を使用 |
| `tests/domain/game/deck.test.ts` | プリセット・カスタム構成 |

### 明示的にやっていないこと

- ルーム作成 UI のデッキ選択
- 54 枚などの追加プリセット本体（枠だけ用意）

### 確認結果

- `npm test` — 36 passed
- `npm run build` — 成功

### 次に考えられる作業

1. 追加プリセット（large 等）を card-design 更新とセットで定義
2. ロビー設定から `config.deck` を渡す

---

## ログの書き方

**正規のルールは `AGENTS.md` を参照。** 変更のあったセッションでは、このファイルに日付見出しで **追記** する（過去エントリは消さない）。
