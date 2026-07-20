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

## 2026-07-12 — Phase 0.5: ゲームエンジンを UI モックにローカル接続

### 背景・目的

- Worker / WebSocket なしで、既存 Vue UI から `src/domain/game` を動かし、
  **宣言 → チャレンジ → 結果画面（実計算）→ 次ラウンド** をブラウザだけで通す。

### 実施内容

1. **ローカルセッション（Pinia）** `src/stores/localGame.ts`
   - `startLocalGame`（self + ボット3 / lives:3 / deck:standard / seedRandom）
   - `placeBid` / `challenge` → `applyAction`、ボット手番は同期で自動消化
   - イベントログ・宣言履歴はセッション側で保持

2. **チャレンジ後の結果表示方針（明記）**
   - エンジンはチャレンジ後に自動で次ラウンド or `game_over`
   - **方針**: チャレンジ直前の `hands` + `round` をスナップショットし、
     `lastOutcome` と合わせて `pendingResult` を構築。結果画面はこれだけ参照。
     次ラウンド state は裏で保持し、「次のラウンドへ」で `clearPendingResult` → `/game`

3. **Mapper**
   - `toGameView`: GameState → UI ViewModel（席・ライフ・手番・合法手フラグ・自分カード表示）
   - `toResultView`: ChallengeOutcome + hands → カード公開・`calculation.steps`

4. **ボット** `src/localGame/bot.ts`
   - 宣言なし → min で PLACE_BID
   - 宣言あり → 30% CHALLENGE、否则 min〜min+3 で RAISE

5. **画面接続**
   - GameView / ResultView を store 購読。`?mock=1` で旧固定モック分岐
   - ロビー「ゲームを開始」・トップ「ローカルデモを開始」→ `startLocalGame`
   - ライフ表示（♥）・脱落グレーアウト・ゲーム終了バナー

6. **テスト** mapper + store 薄単体。domain テストは維持

### 主なパス変更

| パス | 内容 |
|------|------|
| `src/stores/localGame.ts` | ローカルセッション / ボット / pendingResult |
| `src/mappers/toGameView.ts` / `toResultView.ts` | domain → UI |
| `src/localGame/bot.ts` / `profiles.ts` | ボットポリシー・表示名 |
| `src/views/GameView.vue` / `ResultView.vue` | store 接続 |
| `src/views/LobbyView.vue` / `HomeView.vue` | 開始導線 |
| `src/components/game/PlayerSeat.vue` 他 | ライフ表示・minBid |
| `tests/mappers/*` / `tests/stores/localGame.test.ts` | 接続層テスト |
| `docs/ui-mock.md` | エンジン接続済み（ローカル）に更新 |

### 明示的にやっていないこと

- Cloudflare Worker / Durable Object / WebSocket
- ルームコード本実装・参加・再接続
- domain エンジン本体の改修（outcome 保持はセッション側で対応）
- デッキ選択 UI / パス手番 / 本格 Pinia 永続化
- Playwright E2E

### 確認結果

- `npm test` — 46 passed
- `npm run build` — 成功

### 次に考えられる作業

1. Worker 側で `applyAction` を正本状態として保持
2. ボット遅延演出（300–500ms）や手番ハイライト強化
3. デッキ選択 UI

---

## 2026-07-12 — カード見え方をインディアンポーカー式に修正

### 背景・目的

- ルール上は **自分の手札は見えない / 他プレイヤーのカードは見える**（コヨーテ・インディアンポーカー式）。
- Phase 0.5 ではローカルデモ用に「自分のカードを表示」していたが誤りだった。

### 実施内容

1. `PlayerSeat.handLabel` / `handHidden` を UI 型に追加
2. `toGameView`: self → `handHidden: true`、他プレイヤー → 表向き `cardLabel`
3. 席 UI は手札タイル + 宣言チップを分離。GameView の「あなたのカード」表示を削除
4. `docs/game-rules.md` に見え方セクションを追記

### 確認結果

- `npm test` / `npm run build` で確認

---

## 2026-07-12 — ローカルデモのボット進行にペース付け

### 背景・目的

- ボットが同期で一気に手を打つため、デモで何が起きたか追えない。

### 実施内容

1. ボット手番ごとに **約 600ms** の遅延 + 宣言後の短い間
2. チャレンジ後、結果画面へ行く前に **約 900ms** の間（「コヨーテ！」を見せる）
3. 上部ステータス「🦉 ○○ の手番…」/ ボット進行中は操作ボタン無効
4. 単体テストは `botDelayMs: 0` / `resultPauseMs: 0` で即時

### 確認結果

- `npm test` / `npm run build`

---

## 2026-07-12 — 初手宣言の下限を 1 に変更

- `DEFAULT_CONFIG.minOpeningBid`: 0 → **1**
- `docs/game-rules.md` と domain テストを追随

---

## 2026-07-12 — ボット思考 3–5 秒 / 結果は手動遷移

### 実施内容

1. ボット手番: 乱数で **3〜5 秒** 考える（テストは `botDelayMs: 0`）
2. コヨーテ後は結果画面へ自動遷移しない → ゲーム画面にバナー + **「結果を見る」** ボタン

---

## 2026-07-12 — デザイン磨きプラン文書（Phase B）

- `docs/design-polish-plan.md` を追加
- B0〜B7（アセット仕様 → アバター → ブランド → UI 接続 → 席/結果/UX）と生成プロンプトを phase 分けで記載

---

## 2026-07-12 — フル 10 体アバター完了 + B0–B3 まとめコミット

### 背景・目的

- 残り 6 体を生成し、モック 10 人席でも画像表示できるようにする。
- B0〜B3（仕様・生成・UI 接続）を一括コミット。

### 実施内容

1. スタイル見本（クマ）参照で raccoon / fox / deer / falcon / squirrel / coyote を生成
2. 256×256 WebP を `public/avatars/` に追加
3. `mockGame` / `mockResult` / `mockLobby` の全席に `avatarSrc` を付与
4. プラン・README・作業ログ更新

### 主なパス変更

| パス | 内容 |
|------|------|
| `public/avatars/{raccoon,fox,deer,falcon,squirrel,coyote}.webp` | 追加 6 体 |
| `src/data/mock*.ts` | フルセット src |
| `docs/design-polish-plan.md` | B1 フル完了 |

### 確認結果

- `public/avatars/` に 10 WebP + README
- `npm test` / `npm run build`（コミット前に実行）

### 次に考えられる作業

1. B2 favicon / ブランド
2. B4 席 UI ブラッシュアップ

---

## 2026-07-12 — Phase B3 アバター UI 接続

### 背景・目的

- B1 の WebP をゲーム・ロビー・結果・ログで表示し、失敗時は絵文字に戻す。

### 実施内容

1. `PlayerProfile.avatarSrc` + `DEFAULT_PROFILES` を `avatarCatalog` から構築
2. `PlayerAvatar.vue`: `src` があれば `<img>`、`onerror` で絵文字フォールバック。`hideName` でログ等に再利用
3. mapper / store イベントログ / Lobby / Result / mock データへ `avatarSrc` 伝播
4. `MobilePlayerCarousel`・`EventLog` も画像対応

### 主なパス変更

| パス | 内容 |
|------|------|
| `src/localGame/profiles.ts` | avatarSrc 付きプロファイル |
| `src/components/game/PlayerAvatar.vue` | 画像 + フォールバック |
| `src/types/game.ts` | avatarSrc フィールド追加 |
| `src/mappers/toGameView.ts` / `toResultView.ts` | 伝播 |
| `src/components/game/EventLog.vue` / `MobilePlayerCarousel.vue` / `PlayerSeat.vue` | 接続 |
| `src/views/LobbyView.vue` / `ResultView.vue` | 接続 |
| `src/data/mock*.ts` | デモ資産がある席のみ src |
| `tests/mappers/*` | avatarSrc 断言 |

### 明示的にやっていないこと

- フル 10 体画像
- favicon（B2）
- 席 UI ブラッシュアップ（B4）

### 確認結果

- `npm test` 46 件パス
- `npm run build` 成功（`dist/avatars/*.webp` コピー確認）

### 次に考えられる作業

1. B2 favicon / ロゴ
2. B4 席・手番演出
3. 残り 6 アバター生成

---

## 2026-07-12 — Phase B1 デモ 4 体アバター生成

### 背景・目的

- B0 仕様に沿い、ローカルデモ用オリジナル動物ポートレートを揃える。

### 実施内容

1. 共通スタイルで `self`（クマ）をスタイル見本として生成
2. 見本を参照して `owl`（カウボーイハット付きフクロウ）/ `kit`（子ギツネ）/ `wolf` を量産
3. 白余白トリム → **256×256 WebP** で `public/avatars/` に配置

### 主なパス変更

| パス | 内容 |
|------|------|
| `public/avatars/self.webp` | あなた（クマ） |
| `public/avatars/owl.webp` | フクロウ |
| `public/avatars/kit.webp` | キタロー |
| `public/avatars/wolf.webp` | オオカミ |
| `public/avatars/README.md` | 配置状況更新 |
| `docs/design-polish-plan.md` | B1 完了条件チェック |

### 明示的にやっていないこと

- フル 10 体
- UI 接続（B3）
- favicon（B2）

### 確認結果

- 4 ファイルとも 256×256 WebP
- シルエットで個体判別可能

### 次に考えられる作業

1. **B3** `PlayerAvatar` + `profiles` で画像表示
2. （任意）残り 6 体生成

---

## 2026-07-12 — Phase B0 アセット仕様の固定

### 背景・目的

- デザイン磨き（Phase B）の最初のステップとして、アバター生成・UI 接続でブレないパス / ID / サイズを確定する。

### 実施内容

1. `docs/design-polish-plan.md` の B0 を正本として拡充・確定
   - 表示サイズ（sm 36 / md 44 / lg 56）、マスター 512 → 出荷 256 WebP
   - 配置 `public/avatars/{assetId}.webp`、URL `/avatars/{assetId}.webp`
   - デモ 4: `self` / `owl` / `kit` / `wolf`（旧案デモ `fox` は不採用 → キタローは `kit`）
   - player id（`bot1` 等）↔ assetId 対応表、10 人モック対応目安
2. `src/localGame/avatarCatalog.ts` に ID / パス / emoji / デモ対応をコード化（UI 未接続）
3. `public/avatars/README.md` でディレクトリを確保

### 主なパス変更

| パス | 内容 |
|------|------|
| `docs/design-polish-plan.md` | B0 確定、B1/次アクション追随 |
| `src/localGame/avatarCatalog.ts` | アセットカタログ（B0） |
| `public/avatars/README.md` | 配置ルール |
| `docs/work-log.md` | 本エントリ |

### 明示的にやっていないこと

- 画像生成・配置（B1）
- `PlayerAvatar` / `profiles.ts` の画像接続（B3）
- favicon / ブランド（B2）

### 確認結果

- 仕様をドキュメント + カタログに固定
- UI は従来どおり絵文字のまま（破壊的変更なし）

### 次に考えられる作業

1. **B1** デモ 4 体（self / owl / kit / wolf）を生成し `public/avatars/` へ
2. **B3** `avatarSrc` + フォールバック接続
3. 余力で B2 favicon

---

## 2026-07-12 — Phase B2 ブランドアイコン

### 背景・目的

- デザイン磨き Phase **B2**: favicon / アプリアイコン / ヘッダーロゴを、夜砂漠テーマのオリジナルマークに差し替える。

### 実施内容

1. **画像生成**（Imagine）
   - アプリアイコン: 月下で遠吠えするコヨーテ／オオカミ + 砂漠
   - favicon 素: 金コヨーテ頭シルエット on 紺円
   - ヘッダー用円形バッジ: 遠吠え + 三日月 + 砂丘
2. **配置**
   - `public/favicon.svg` … タブ用（SVG・単純シルエット）
   - `public/favicon-32.png` / `public/icons/apple-touch-icon.png`
   - `public/icons/app-192.png` / `app-512.png`（PWA 用・マニフェスト未接続）
   - `public/brand/logo-mark.webp`（256）
3. **UI 接続**
   - `AppLogo` … 絵文字 → ロゴマーク画像 + テキスト「Wild Count」
   - `GameHeader` … PC / モバイルともマーク表示
   - `index.html` … favicon / apple-touch / application-name
4. **ドキュメント**
   - `design-polish-plan.md` B2 完了条件チェック
   - `public/brand/README.md` / `public/icons/README.md`

### 主なパス変更

| パス | 内容 |
|------|------|
| `public/favicon.svg` | 差し替え（金コヨーテ頭） |
| `public/favicon-32.png` | PNG フォールバック |
| `public/brand/logo-mark.webp` | ヘッダーマーク |
| `public/icons/app-*.png` | PWA 用 192/512 |
| `src/components/common/AppLogo.vue` | 画像マーク |
| `src/components/game/GameHeader.vue` | 画像マーク |
| `index.html` | icon リンク追加 |
| `docs/design-polish-plan.md` | B2 完了 |

### 明示的にやっていないこと

- PWA マニフェスト / `vite-plugin-pwa`（B7）
- 席 UI ブラッシュアップ（B4）
- 結果画面演出（B5）

### 確認結果

- `npm run build` 成功
- ホーム・ロビー・結果の `AppLogo`、ゲームヘッダーでマーク表示

### 次に考えられる作業

1. **B4** 席・ゲーム画面のブラッシュアップ
2. **B5** 結果・カード演出
3. 任意 **B7** マニフェストと `icons/` 接続

---

## 2026-07-12 — Phase B4 席・ゲーム画面ブラッシュアップ

### 背景・目的

- `docs/画面イメージ.png` に寄せて、席・手番・宣言・ステータスの「仮モック感」を一段下げる（大幅リデザインはしない）。
- インディアンポーカー見え方（他人表 / 自分 `?`）は維持。

### 実施内容

1. **手番強調** — `PlayerAvatar` 金リング 3px + `shadow-turn-glow` + パルスアニメ（`avatar-turn-ring`）。self は teal リングを維持。
2. **状態チップ** — 宣言済み / 現在の手番 / あなた / 待機中 / 脱落を `seat-chip-*` で統一。
3. **手札・宣言** — `card-tile` 質感改善、self・手番で `emphasized`。手札下に金枠 `bid-chip`。
4. **ライフ** — ♥ を rose で明示（PC 最大 5、超過は ×N）。
5. **モバイル席** — カルーセルに手番ハイライト枠・済チップ・bid-chip を追加。
6. **ステータスバー / コヨーテバナー** — ボット思考・手番・結果待ちで色分け。「結果を見る」の余白・階層を整理。

### 主なパス変更

| パス | 内容 |
|------|------|
| `src/components/game/PlayerAvatar.vue` | 手番 glow / self teal |
| `src/components/game/PlayerSeat.vue` | チップ・ライフ・bid-chip |
| `src/components/game/BidCard.vue` | emphasized 枠 |
| `src/components/game/MobilePlayerCarousel.vue` | モバイル席の整合 |
| `src/components/game/CurrentBidDisplay.vue` | 中央宣言の見た目 |
| `src/views/GameView.vue` | ステータスバー・コヨーテバナー |
| `src/styles/main.css` | seat-chip / bid-chip / turn pulse |
| `tailwind.config.js` | `shadow-turn-glow` |
| `docs/design-polish-plan.md` | B4 完了 |

### 明示的にやっていないこと

- 結果画面の公開アニメ・特殊札 CSS（B5）
- ボット賢さ・人数設定（B6）
- 砂漠背景イラスト / PWA マニフェスト（B7）
- ドメインロジック変更

### 確認結果

- `npm test` 46 件すべて成功
- `npm run build` 成功

### 次に考えられる作業

1. **B5** 結果・カード演出
2. **B6** ローカルデモ UX
3. 任意 **B7** 背景・PWA

---

## 2026-07-12 — Phase B5 結果・カード演出

### 背景・目的

- コヨーテ後の結果画面を「仮置き」から脱し、めくり・計算の気持ちよさを出す（`docs/design-polish-plan.md` B5）。
- 特殊札は AI 画像ではなく **CSS/SVG タイル**。合計過程は引き続きエンジン `calculation` 由来。

### 実施内容

1. **`RevealCardTile`** — 数字（金）/ ×2（teal）/ MAX→0（amber）/ ?（redraw）/ 捨札混 を CSS+SVG で描画。
2. **カード公開スタッガー** — 席順に flip-in（約 90ms 間隔）。ヘッダー「スキップ」で即時全公開。
3. **計算ステップ演出** — 公開後に steps を順ハイライト（active / done）。完了時に最終合計 vs 宣言バー。
4. **バナー** — 勝敗パネル入場、ライフ −1 コールアウト（`life-lost-pulse`）。
5. **docs** — polish plan B5 完了、ui-mock 追記。

### 主なパス変更

| パス | 内容 |
|------|------|
| `src/components/game/RevealCardTile.vue` | 結果用札タイル（新規） |
| `src/views/ResultView.vue` | スタッガー・ステップ演出・バナー |
| `src/styles/main.css` | reveal-card / calc-step / アニメ |
| `docs/design-polish-plan.md` | B5 完了 |
| `docs/ui-mock.md` | 結果 UI メモ |
| `docs/work-log.md` | 本エントリ |

### 明示的にやっていないこと

- ボット賢さ・人数設定（B6）
- 砂漠背景イラスト / PWA マニフェスト（B7）
- ドメインロジック変更
- 結果画面の自動スクショ検証

### 確認結果

- `npm test` 46 件すべて成功
- `npm run build` 成功

### 次に考えられる作業

1. **B6** ローカルデモ UX
2. 任意 **B7** 背景・PWA
3. `/result?mock=1` で特殊札見た目の目視確認

---

## 2026-07-12 — コヨーテ！カットイン演出

### 背景・目的

- チャレンジ成立の瞬間をワクワクさせるフルスクリーン・カットインを追加（B5 結果画面の手前）。

### 実施内容

1. **`CoyoteCutIn.vue`** — フラッシュ / 斜めスラッシュ帯 / スピード線 / アバター衝撃 / 「コヨーテ！」スラム / 画面シェイク。約 2.4s で自動退場、タップでスキップ。
2. **`GameView`** — `pendingResult` 成立時に一度だけ再生 → 終了後に「結果を見る」バナー。モック (`?mock=1`) のコヨーテボタンでもプレビュー可。
3. **CSS** — `main.css` に cut-in キーフレーム（`prefers-reduced-motion` 対応）。

### 主なパス変更

| パス | 内容 |
|------|------|
| `src/components/game/CoyoteCutIn.vue` | カットイン（新規） |
| `src/views/GameView.vue` | 発火・バナー連携 |
| `src/styles/main.css` | 演出キーフレーム |

### 明示的にやっていないこと

- 効果音 / Web Audio
- 結果画面側の追加カットイン
- ドメイン変更

### 確認結果

- `npm test` 46 件成功 / `npm run build` 成功

### 次に考えられる作業

1. カットインに短い SE（任意）
2. **B6** ローカルデモ UX

---

## 2026-07-12 — コヨーテ後導線: カード公開 → 結果

### 背景・目的

- 「結果を見る」が先だとカードめくりの気持ちよさが結果画面に埋もれる。  
  **カットイン → 札公開（ゲーム画面）→ 結果（勝敗・計算）** の順に直す。

### 実施内容

1. **GameView** — カットイン後に `RevealCardTile` でスタッガー公開。「すべて公開」可。公開完了後に「結果を見る」を有効化。
2. **ResultView** — カードは再掲（アニメなし）。計算ステップ段階ハイライトを本編に。
3. モック `?mock=1` のコヨーテも同じ導線でプレビュー。

### 確認結果

- `npm test` 46 件成功 / `npm run build` 成功

### 追記（同日）

- カード公開パネルがヘッダーより上に出ていた → **ヘッダー直下のメイン領域**に移動（PC / モバイルとも）。

---

## 2026-07-12 — 画面見切れ / レイアウト崩れの修正

### 背景・目的

- 画面の一部がビューポートに収まらずクリップされる問題を横断修正。

### 実施内容

1. **App shell** — `html/body/#app` を `100dvh` + `overflow: hidden`。各画面が内部スクロール or flex 領域を持つ。
2. **スクロールページ** — Home / Lobby は `.page-scroll`、Result はヘッダー固定 + 本文 `overflow-y-auto`。
3. **ゲーム席** — `PlayerCircle` を container query で親にフィット。楕円半径を下げ席のアバター/札が見切れないように。
4. **GameView flex** — `min-h-0` / `shrink-0` を明示。イベントログ列とモバイルオーバーレイを高さ内に収める。
5. **safe-area** — top/x/bottom 用ユーティリティを追加。

### 主なパス変更

| パス | 内容 |
|------|------|
| `src/styles/main.css` | shell / page-scroll / player-circle-stage |
| `src/components/game/PlayerCircle.vue` | フィット楕円 |
| `src/views/GameView.vue` 他 | 高さチェーン・スクロール |

### 確認結果

- `npm test` 53 件成功 / `npm run build` 成功

---

## 2026-07-12 — Phase B6 ローカルデモ UX

### 背景・目的

- 見た目以外の「遊び心地」を上げ、友人に URL なしで一人デモとして見せられる状態にする（`docs/design-polish-plan.md` B6）。

### 実施内容

1. **ボット賢さ** — 他者の見える札 + 自分カード期待値で概算合計。宣言・チャレンジ確率を調整（`localGame/bot.ts`）。
2. **デモ設定** — トップで人数 3/4・表示名・任意シード。`buildDemoLineup`。シード空は毎回ランダム。
3. **終了導線** — 勝者バナー説明 +「もう一度遊ぶ」（`restartLastGame` で設定維持）/「トップへ」（セッション破棄）。
4. **モック導線** — `?mock=1` リンクをトップの開発用 details に折りたたみ。ローカル対戦を主導線に。
5. **テスト** — bot 単体 + 3 人ラインナップ / restartLastGame。

### 主なパス変更

| パス | 内容 |
|------|------|
| `src/localGame/bot.ts` | 概算ポリシー |
| `src/localGame/profiles.ts` | `buildDemoLineup` / 人数型 |
| `src/stores/localGame.ts` | `restartLastGame`・シード既定 |
| `src/views/HomeView.vue` | デモ設定 UI |
| `src/views/ResultView.vue` | 終了 CTA |
| `src/views/LobbyView.vue` | lineup 明示 |
| `tests/localGame/bot.test.ts` | ボット単体テスト |
| `docs/design-polish-plan.md` | B6 完了 |
| `docs/ui-mock.md` | 導線メモ |
| `docs/work-log.md` | 本エントリ |

### 明示的にやっていないこと

- 砂漠背景イラスト / PWA マニフェスト（B7）
- ボットの高度なブラフ・相手モデル
- ドメインロジック変更
- マルチプレイ / Worker

### 確認結果

- `npm test` 53 件すべて成功
- `npm run build` 成功

### 次に考えられる作業

1. 任意 **B7** 背景・PWA
2. ボット思考時間の UI 調整スライダー（任意）
3. Phase 1 マルチプレイ

---

## 2026-07-12 — 0 (mix) 表示サイズ調整

### 背景・目的

- 手札タイル / 結果公開で `0 (mix)` だけ文字がはみ出て大きく見えていた。

### 実施内容

1. `cardLabel(zero_mix)` を `0*` に短縮（通常 0 は `+0` のまま区別）
2. 結果 `RevealCardTile` はヒーロー `0` + サブ `捨札混`（長いラベルを載さない）
3. `.card-tile` に overflow クリップを追加

### 確認結果

- `npm test` 53 件成功

---

## 2026-07-12 — Phase B7 背景・PWA

### 背景・目的

- デザイン磨きプランの任意フェーズ B7：夜砂漠背景の強化と PWA（マニフェスト + アプリアイコン接続）。

### 実施内容

1. **砂漠夜背景** — `.desert-bg` を CSS のみで強化（月光・多層砂丘・星・地平線ヘイズ・左右サボテンシルエット）。UI 可読性のため低コントラスト。
2. **PWA** — 既に依存にあった `vite-plugin-pwa` を `vite.config.ts` で有効化。B2 の `app-192` / `app-512` を manifest に接続。`autoUpdate` + SPA `navigateFallback`。
3. **HTML メタ** — description / apple-mobile-web-app / theme-color 周りを整備。
4. **ドキュメント** — `design-polish-plan` / `ui-mock` / icons README を B7 完了に更新。

### 主なパス変更

| パス | 内容 |
|------|------|
| `src/styles/main.css` | `.desert-bg` 強化 |
| `vite.config.ts` | `VitePWA` 設定 |
| `index.html` | PWA / 説明メタ |
| `docs/design-polish-plan.md` | B7 完了 |
| `docs/ui-mock.md` | 背景・PWA 行 |
| `docs/work-log.md` | 本エントリ |

### 明示的にやっていないこと

- 背景イラスト画像の生成（CSS のみ）
- 勝利・脱落用の追加アバターポーズ
- Service Worker のオフラインゲームロジック拡張
- マルチプレイ / Worker

### 確認結果

- `npm test` 53 件すべて成功
- `npm run build` 成功（`dist/manifest.webmanifest` / `dist/sw.js` 生成確認）

### 次に考えられる作業

1. Phase 1 マルチプレイ（Worker / DO）
2. 細部 UX（ボット思考時間スライダー等）
3. オフラインキャッシュ戦略の見直し（必要なら）

---

## 2026-07-12 — Phase 1 P1-0 / P1-1（設計メモ + Worker 足場）

### 背景・目的

- 身内招待制マルチプレイの Phase 1 を開始。まず設計を固定し、Worker / DO / WebSocket の起動可能な足場を置く。

### 実施内容

1. **P1-0** — `docs/phase1-multiplayer.md` を追加（メッセージ型、ルームコード 6 文字、再接続、host 移譲 60s、idle TTL、domain 呼び出し表）。
2. **P1-1** — `worker/index.ts` + `worker/GameRoom.ts`（Hibernation WS accept、ping/pong、`POST /api/rooms`、meta）。
3. `wrangler.jsonc` に DO migration（`GameRoom` SQLite class）。
4. Vite `server.proxy` で `/api` → wrangler（既定 `127.0.0.1:8787`）。`VITE_WORKER_URL` を `env.d.ts` に宣言。
5. `roomCode` 単体テスト。ローカルデモコードは未変更。

### 主なパス変更

| パス | 内容 |
|------|------|
| `docs/phase1-multiplayer.md` | Phase 1 設計メモ（新設） |
| `worker/index.ts` | Worker エントリ・HTTP ルーティング |
| `worker/GameRoom.ts` | DO + WS scaffold |
| `worker/types.ts` / `roomCode.ts` / `env.d.ts` | 型・コード生成・最小 CF 型 |
| `worker/roomCode.test.ts` | ルームコード単体テスト |
| `wrangler.jsonc` | DO migrations |
| `vite.config.ts` | `/api` proxy + worker テスト include |
| `docs/ui-mock.md` | 次工程を Phase 1 に更新 |
| `docs/work-log.md` | 本エントリ |

### 明示的にやっていないこと

- join / ロビー同期 / ゲーム進行（P1-2 / P1-3）
- フロント `onlineGame` store・トップ UI 本接続
- resume / ホスト移譲 / idle 削除の実装
- 本番 `wrangler deploy`

### 確認結果

- `npm test` 56 件すべて成功（roomCode 3 件追加）
- `npm run build` 成功
- `npm run worker:dev` 起動後:
  - `GET /api/health` → ok
  - `POST /api/rooms` → 6 文字 roomCode
  - `GET /api/rooms/:code` → meta
  - WS `/api/rooms/:code/ws` → CONNECTED event + JSON `ping`→`pong`

### 次に考えられる作業

1. **P1-2** — join / メンバー一覧 broadcast / host 開始ボタン（フロント online 接続）
2. **P1-3** — domain `startGame` / `applyAction` + マスク済み view
3. P1-4 再接続 → P1-5 host/TTL → P1-6 磨ぎ

---

## 2026-07-12 — Phase 1 P1-2（ルーム作成・参加・ロビー同期）

### 背景・目的

- 身内招待で複数ブラウザが同一ルームに入り、メンバー一覧がリアルタイム更新され、ホストが開始できるところまで。

### 実施内容

1. **GameRoom** — `join` / `ready` / `start` / 切断時 `connected` 更新、`view` broadcast、`hello` + resumeToken 発行。
2. **start** — host のみ・2 人以上で domain `startGame`（状態は DO に保存）。action は P1-3。
3. **roomLogic** — 純粋ヘルパ + 単体テスト（表示名、canStart、parse）。
4. **フロント** — `stores/onlineGame.ts`、`src/online/*`（URL・resumeStorage・protocol）。
5. **HomeView** — ルーム作成/参加を Worker 本線に接続（ローカルデモは維持）。
6. **LobbyView** — オンライン参加者一覧・準備トグル・host 開始。開始後 `/game?online=1`。
7. **GameView** — オンライン時はローカル bots を起動しない。P1-3 までのプレースホルダ席一覧。

### 主なパス変更

| パス | 内容 |
|------|------|
| `worker/GameRoom.ts` | ロビー + start 本実装 |
| `worker/roomLogic.ts` | 状態ヘルパ・view 生成 |
| `worker/roomLogic.test.ts` | 単体テスト |
| `src/stores/onlineGame.ts` | WS クライアント store |
| `src/online/*` | protocol / workerUrl / resumeStorage |
| `src/views/HomeView.vue` | オンライン作成・参加 |
| `src/views/LobbyView.vue` | オンラインロビー UI |
| `src/views/GameView.vue` | オンライン時 bots 抑止 + 仮画面 |
| `docs/work-log.md` | 本エントリ |

### 明示的にやっていないこと

- bid / challenge の同期操作と手札マスク view（P1-3）
- リロード再接続の磨き（token 保存は済、P1-4 で完成）
- ホスト移譲 60s・idle TTL（P1-5）
- 本番 deploy

### 確認結果

- `npm test` 60 件成功 / `npm run build` 成功
- wrangler 上の 2 WS クライアント: join 同期・ready 同期・host start → phase playing・guest start 拒否・開始後 join 拒否

### 次に考えられる作業

1. **P1-3** — `action` + マスク済み PlayerView + Result UI
2. P1-4 再接続磨き
3. P1-5 host 移譲 / 空ルーム削除

---

## 2026-07-12 — Phase 1 P1-3（ゲーム進行・マスク view・結果）

### 背景・目的

- ホスト開始後、宣言 / コヨーテを domain 経由で同期し、手札マスクと結果 UI を既存画面に載せる。

### 実施内容

1. **maskedView** — 自分の Card を送らない seats、`pendingResult` では全札公開。単体テストで JSON リーク検証。
2. **GameRoom.handleAction** — `actionId` + `expectedRevision`、冪等、`applyAction`（PLACE_BID / CHALLENGE）、bidHistory、チャレンジ前 hands スナップショット。
3. **onlineGame** — `placeBid` / `challenge` / `gameView` / `pendingResult` / `clearPendingResult`。
4. **mappers** — `onlineToGameView` / `onlineToResultView`。
5. **GameView / ResultView** — オンライン時は localGame ではなく online store。ボット非起動。カットイン〜結果〜次ラウンド。

### 主なパス変更

| パス | 内容 |
|------|------|
| `worker/maskedView.ts` | マスク済み game / pendingResult |
| `worker/GameRoom.ts` | action 処理 |
| `worker/roomLogic.ts` | view にフル game payload |
| `src/stores/onlineGame.ts` | 操作 API + view モデル |
| `src/mappers/onlineTo*.ts` | UI 接続 |
| `src/views/GameView.vue` / `ResultView.vue` | オンライン分岐 |
| `docs/work-log.md` | 本エントリ |

### 明示的にやっていないこと

- リロード再接続の完全磨き（P1-4）
- ホスト移譲 60s / idle TTL（P1-5）
- オンライン「もう一度遊ぶ」のサーバー再戦（ホームへ戻る）

### 確認結果

- `npm test` 64 件成功 / `npm run build` 成功
- wrangler 2 クライアント: start → mask 確認 → bid → challenge → pendingResult（自分の札含む）→ 結果 phase

### 次に考えられる作業

1. **P1-4** — resume 磨き
2. **P1-5** — host 移譲・空ルーム
3. **P1-6** — エラー UI / 切断バナー / docs 仕上げ

---

## 2026-07-12 — Phase 1 P1-4（resumeToken 再接続）

### 背景・目的

- リロード・一時切断後に同一席へ復帰できるようにする（`docs/phase1-multiplayer.md` §7.4）。

### 実施内容

1. **resumeStorage** — `wc:lastRoom` とトークン連動、`loadLastRoomCode` / `hasResumableSession`。
2. **onlineGame** — `ensureSession`（リロード復帰）、`reconnect`（手動）、切断時の指数バックオフ自動再接続（最大 8 回）、socketGen で stale close を無効化。view 保持オプション。
3. **GameRoom** — 再接続成功時に `RESUME` イベント broadcast。
4. **UI** — Home「前回のルームに戻る」、Lobby/Game 切断バナー、`/lobby|/game|/result` の mount 時 ensureSession。クエリに `code` を載せて deep-link しやすく。

### 主なパス変更

| パス | 内容 |
|------|------|
| `src/online/resumeStorage.ts` | lastRoom / helpers |
| `src/stores/onlineGame.ts` | ensureSession / reconnect / auto-reconnect |
| `worker/GameRoom.ts` | RESUME イベント |
| `src/views/HomeView.vue` 他 | 復帰 UI |
| `tests/online/resumeStorage.test.ts` | 単体テスト |
| `docs/phase1-multiplayer.md` | 変更履歴 |

### 明示的にやっていないこと

- ホスト移譲 60s / idle TTL（P1-5）
- エラーコード別の丁寧な UI（P1-6）
- 本番 deploy

### 確認結果

- `npm test` 70 件成功（resumeStorage 4 + roomLogic resume 2 追加）
- `npm run build` 成功
- wrangler 手動 WS スモークは本環境で workerd が accept せずタイムアウトしたため未実施（実装は既存 join/resume 経路の延長）

### 次に考えられる作業

1. **P1-5** — host 移譲・空ルーム alarm
2. **P1-6** — エラー UI 磨き・docs 仕上げ

---

## 2026-07-12 — ルーム作成が「接続中」のまま進まない調査

### 背景・目的

- ホームの「ルームを作成する」が接続中から進まない報告への対応。

### 実施内容

1. 原因切り分け: workerd が 8787 で LISTEN しているが HTTP を accept せずハング（Recv-Q 滞留）。`POST /api/rooms` が完了せず `onlineBusy` が true のまま。
2. ハングしていた wrangler/workerd を PID で落として再起動 → health / create / WS join は正常。
3. **再発時の UX**: `createRoom` の fetch に 8s タイムアウト、失敗理由を `lastError` とホームに表示。join 送信失敗も fail に落とす。

### 主なパス変更

| パス | 内容 |
|------|------|
| `src/stores/onlineGame.ts` | createRoom AbortSignal.timeout / エラー文言 |
| `src/views/HomeView.vue` | 接続中ヒント・lastError 表示 |

### 確認結果

- 再起動後: `GET /api/health` ok、`POST /api/rooms` で roomCode、WS join → hello + view
- Vite proxy (`:5173/api/health`) も ok

### 次に考えられる作業

1. P1-5 へ戻る
2. wrangler 長時間稼働時のハング再現条件調査（必要なら）

---

## 2026-07-12 — 結果表示のローカル保持 + コミット前メモ

### 背景・目的

- 動確で、結果表示中に他プレイヤーが次宣言すると `pendingResult` が消え結果 UI が消える問題を指摘された。
- ゲーム開始の「全員そろえてから」は **待機（後回し）**。

### 実施内容

1. `onlineGame` に `heldPendingResult` — サーバが次 `PLACE_BID` で pending を消しても、クライアントが dismiss するまで結果を保持。
2. 本セッションの P1-4 / 接続タイムアウト改善と合わせてコミット。

### 明示的にやっていないこと（待機）

- ホスト開始前に全員 ready を必須にする同期開始
- サーバ側での pendingResult 全員 ACK 待ち

→ 一覧の正本: **`docs/backlog.md`**（HOLD-1 / HOLD-2 ほか）

---

## 2026-07-12 — 残タスク一覧 docs/backlog.md

### 背景・目的

- work-log 以外で、積み残し・hold を一覧できるようにする。

### 実施内容

1. `docs/backlog.md` を新設（P1-5/6 todo、開始同期・結果 ACK 等 hold、改善 idea）
2. `phase1-multiplayer.md` §10 に状態列 + backlog へのリンク
3. `AGENTS.md` に backlog 参照を追加

### 主なパス変更

| パス | 内容 |
|------|------|
| `docs/backlog.md` | 残タスク正本（新設） |
| `docs/phase1-multiplayer.md` | スライス状態 |
| `AGENTS.md` | Related に backlog |

---

## 2026-07-12 — Phase 1 P1-5（ホスト移譲・空ルーム削除）

### 背景・目的

- ホスト切断後の 60s 猶予 → 最長参加者へ移譲、および空 / idle ルームの DO storage 削除（`docs/phase1-multiplayer.md` §7.5–7.6）。

### 実施内容

1. **roomLogic** — `disconnectDeadlines`、`markPlayerDisconnected` / `applyDueHostTransfer` / `pickNextHost`、`shouldPurgeRoom` / `nextAlarmAt` / `idleTtlMs`（open 10m・playing 30m・closed 即時）。
2. **GameRoom** — `webSocketClose` で host に 60s deadline + alarm。`alarm()` で移譲（`HOST_TRANSFERRED` イベント）または `storage.deleteAll()`。resume 時に deadline 解除。init / WS upgrade でも idle alarm を設定。
3. 単体テスト 13 件追加（lifecycle）。

### 主なパス変更

| パス | 内容 |
|------|------|
| `worker/roomLogic.ts` | ライフサイクル純粋関数 + RoomState.disconnectDeadlines |
| `worker/GameRoom.ts` | alarm / purge / host grace |
| `worker/roomLogic.test.ts` | host 移譲・idle TTL テスト |
| `docs/backlog.md` / `phase1-multiplayer.md` | P1-5 → done |

### 明示的にやっていないこと

- UX-2（切断中ホストの「移譲まであと N 秒」表示）— idea のまま
- エラーコード別 UI（P1-6）
- ゲーム中の長時間切断キック（UX-3）
- 本番 deploy

### 確認結果

- `npm test` 83 件成功
- `npm run build` 成功

### 次に考えられる作業

1. **P1-6** — エラー UI・docs / テスト締め
2. UX-2 カウントダウン表示（任意）

---

## 2026-07-12 — Phase 1 P1-6（エラー UI・テスト・docs 仕上げ）

### 背景・目的

- Phase 1 本線の締め。サーバ error code をプレイヤー向け日本語で表示し、test/build 緑と docs を揃える。

### 実施内容

1. **`src/online/errorMessages.ts`** — §11 の主要 code → 日本語。`ILLEGAL_ACTION` はサーバ英語 detail を手番/終了等に refine。`room_closed` / HTTP body も同系。
2. **`onlineGame` store** — `lastErrorCode` + `setError` / `clearError`。error / room_closed / 切断 / 作成失敗をマッパ経由に。soft エラー（`REVISION_MISMATCH` / `ILLEGAL_ACTION`）はイベントログにも残す。
3. **HomeView** — 参加セクションでも `lastError` を表示。
4. **テスト** — `tests/online/errorMessages.test.ts`（10 件）。
5. **docs** — backlog / phase1 §11・スライス / work-log。UX-1 を done に。

### 主なパス変更

| パス | 内容 |
|------|------|
| `src/online/errorMessages.ts` | code→日本語（新設） |
| `src/stores/onlineGame.ts` | lastErrorCode / setError |
| `src/views/HomeView.vue` | join 時エラー表示 |
| `tests/online/errorMessages.test.ts` | 単体テスト |
| `docs/backlog.md` / `phase1-multiplayer.md` | P1-6 done |

### 明示的にやっていないこと

- Playwright E2E（TEST-1）
- UX-2 ホスト移譲カウントダウン
- サーバ側 message の日本語化（ワイヤは code 正本のまま）
- 本番 deploy（HOLD-5）

### 確認結果

- `npm test` 93 件成功
- `npm run build` 成功

### 次に考えられる作業

1. HOLD-1（開始同期）が必要なら設計から
2. UX-2 カウントダウン（任意）

---

## 2026-07-12 — HOLD-1〜4 解消（HOLD-5 は確認待ち）

### 背景・目的

- backlog の HOLD-1〜5 を片付ける。HOLD-5（本番 deploy）は phase1 非交渉どおりユーザー確認が必要。

### 実施内容

1. **HOLD-1 開始同期** — host `start` は全員 `ready` 必須。`canStart` / `PLAYERS_NOT_READY`。ロビー UI に準備人数表示。
2. **HOLD-2 結果 ACK** — `dismiss_result` + `resultAcks`。接続中全員が閉じるまでサーバが `pendingResult` を保持。view は個人ごとに ACK 済みなら隠す。次 `PLACE_BID` では消さない。切断席は待たない。
3. **HOLD-3 rematch** — game_over 後 `rematch` で同席のままロビー復帰（ready クリア）。Result「もう一度遊ぶ」から送信。Game/Result は `status===open` でロビーへ遷移。
4. **HOLD-4 wrangler ハング** — ローカル workerd 既知問題として README に復旧手順を記載。クライアント 8s タイムアウトは既存。深掘りは打ち切り。
5. テスト追加（roomLogic ready / dismiss / rematch）・errorMessages に `PLAYERS_NOT_READY`。

### 主なパス変更

| パス | 内容 |
|------|------|
| `worker/types.ts` / `roomLogic.ts` / `GameRoom.ts` | ready 開始・dismiss・rematch |
| `src/online/protocol.ts` / `errorMessages.ts` | ワイヤ型・日本語 code |
| `src/stores/onlineGame.ts` | dismiss 送信・requestRematch |
| `src/views/LobbyView.vue` / `ResultView.vue` / `GameView.vue` | UI 連動 |
| `worker/roomLogic.test.ts` | HOLD 系単体 |
| `docs/*` / `README.md` | 仕様・backlog・復旧手順 |

### 明示的にやっていないこと

- **HOLD-5 本番 `wrangler deploy`**（要ユーザー確認・Cloudflare 認証）
- Playwright E2E / UX-2 カウントダウン
- workerd ハングの上流修正（ローカル再起動で十分と判断）

### 確認結果

- `npm test` 98 件成功
- `npm run build` 成功

### 次に考えられる作業

1. ユーザー確認後に HOLD-5（`npm run deploy`）
2. UX-2 / TEST-1 など idea 枠

---

## 2026-07-12 — backlog: ヘルプ差し込み・チャット未実装を明示

- **UX-5** ヘルプ機能を `todo`（差し込み）で追加
- **UX-6** チャットは UI シェルのみ・未実装を `idea` で明記
- 直近着手順にヘルプを上位

---

## 2026-07-12 — 本番サーフェス整理（A: オンラインのみ）

### 背景・目的

- 本番リリース想定で mock / ローカル対戦 / 開発用コピーがユーザーに出ないようにする（方針 A + ローカルは本番非掲載）。

### 実施内容

1. `src/config/runtime.ts` — `allowLocalPlay` / `allowUiMock` = `import.meta.env.DEV`
2. Home: ローカル対戦セクション・開発用 mock 導線を DEV のみ
3. Game / Result / Lobby: 本番で offline local・`?mock=1` はホームへリダイレクト
4. Router: 本番で `mock` クエリを strip；`/game-mock` は home
5. MockBadge は DEV のみ表示；結果計算の docs パス文言を製品コピーに；MVP 外 → 準備中

### 明示的にやっていないこと

- localGame コードの prod バンドル完全除外（動的 import 化は未）
- HOLD-5 本番 deploy

### 確認結果

- `npm run build` / `npm test` 成功

---

## 2026-07-12 — ドーパミン系マイクロ演出（bid / 結果 / 手番）

### 背景・目的

- 既存のコヨーテ・カットイン／カード公開に加え、宣言更新・結果確定・手番到来など「報酬感」のある瞬間に CSS 中心の演出を足す。

### 実施内容

1. **中央宣言** — 数値ポップ／グロー／`+N` 浮上（`CurrentBidDisplay`）
2. **操作** — ステッパー tick、宣言・コヨーテボタンの press フラッシュ（`BidControls`）
3. **席** — 宣言チップ pop-in（PC / モバイル）
4. **手番** — 「あなたの手番」バーの turn-arrive パルス
5. **結果** — 合計カウントアップ → スラム、紙吹雪（`FxConfetti`）、ライフ −1 の heart crack、計算完了バッジ
6. **a11y** — `prefers-reduced-motion: reduce` で主要アニメ無効

### 主なパス変更

| パス | 内容 |
|------|------|
| `src/components/game/CurrentBidDisplay.vue` | 宣言数字 FX |
| `src/components/common/FxConfetti.vue` | CSS 紙吹雪 |
| `src/components/game/BidControls.vue` | ステッパー / ボタン FX |
| `src/components/game/PlayerSeat.vue` / `MobilePlayerCarousel.vue` | bid-chip pop |
| `src/views/ResultView.vue` / `GameView.vue` | 結果・手番演出接続 |
| `src/styles/main.css` | keyframes / reduced-motion |
| `docs/ui-mock.md` / `docs/backlog.md` | メモ |

### 明示的にやっていないこと

- 効果音 / 触覚（Web Audio・vibration）
- canvas パーティクルや外部ライブラリ
- カードめくり一枚ごとのキラキラ強化

### 確認結果

- `npm run build` 成功

### 次に考えられる作業

1. 任意: 効果音（宣言 / コヨーテ / 勝敗）トグル
2. カード公開時の special 札ハイライト強化

---

## 2026-07-12 — UX-5 ヘルプ機能

### 背景・目的

- ルール・特殊札・操作をアプリ内で見られるようにする（リリース前の導線）。正本は `docs/game-rules.md` / `card-design.md`。

### 実施内容

1. `src/data/helpContent.ts` — タブ別コピー（遊び方 / 特殊札 / 合計計算 / 操作）
2. `src/components/common/HelpModal.vue` — モーダル（タブ・Esc / 外側タップで閉じる）
3. 導線: Home「遊び方・ルール」、Lobby / Game ヘッダ `?`
4. GameHeader: 未使用の設定ボタンをヘルプ・チャット emit に整理
5. backlog UX-5 → done、`ui-mock.md` 更新

### 主なパス変更

| パス | 内容 |
|------|------|
| `src/data/helpContent.ts` | ヘルプ本文 |
| `src/components/common/HelpModal.vue` | モーダル UI |
| `src/components/game/GameHeader.vue` | `help` / `chat` emit |
| `src/views/HomeView.vue` 他 | オープン導線 |
| `docs/backlog.md` | UX-5 done |

### 明示的にやっていないこと

- 専用ルート `/help`、Result 画面からの導線
- ドキュメント全文の自動同期（UI は要約）
- 初回訪問時の自動表示

### 確認結果

- `npm test` 98 件成功
- `npm run build` 成功（HelpModal はチャンク分割）

### 次に考えられる作業

1. HOLD-5 本番 deploy（ユーザー確認後）
2. 結果画面からのヘルプ（計算タブ直開き）など任意 UX

---

## 2026-07-12 — ロビー切断が「切断席」として残る不具合

### 背景・目的
- ロビー退出後も `ddd / 切断 / 待機中` の席が残る報告
- `leave` 送信直後に socket close すると、サーバが close を先に処理して markDisconnected していた

### 実施内容
1. `webSocketClose`: `status === 'open'` のときは **席削除**（`removePlayerFromRoom`）に統一
2. 対戦中のみ従来どおり切断席を保持（resume 用）

### 主なパス変更
| パス | 内容 |
|------|------|
| `worker/GameRoom.ts` | ロビー close → 席削除 |

### 明示的にやっていないこと
- クライアント側の leave 待ち ACK

### 確認結果
- 単体テストは既存の remove 系でカバー

---

## 2026-07-12 — 表示名入力・ロビー退出・リアクション課題

### 背景・目的
- 参加時に表示名が分かりにくかった / ロビー退出が「切断」席として残る
- チャット・リアクションは課題として積み、メンション・未読は不要

### 実施内容
1. ホーム: 作成/参加を1パネルにまとめ、**共通の表示名フィールド**を上部に配置
2. ロビー: 表示名編集 +「名前を反映」（既存 join 再送でリネーム）
3. 意図的退出: Client `leave` → ロビーは席削除・ホスト即移譲、対戦中は従来どおり切断扱い
4. backlog **UX-7** リアクション idea（メンション/未読は対象外）

### 主なパス変更
| パス | 内容 |
|------|------|
| `worker/roomLogic.ts` / `GameRoom.ts` | `removePlayerFromRoom` / `handleLeave` |
| `src/stores/onlineGame.ts` | `leave` で leave 送信、`updateDisplayName` |
| `src/views/HomeView.vue` / `LobbyView.vue` | 表示名 UI |
| `docs/backlog.md` | UX-7 idea / UX-8・9 done |

### 明示的にやっていないこと
- ゲーム中の席削除（中断キックは UX-3）
- チャット・リアクション本体（UX-7）
- メンション / 未読

### 確認結果
- `npm test` 100 件成功
- `npm run build` 成功

### 次に考えられる作業
1. UX-7 リアクション（着手時）
2. HOLD-5 本番 deploy

---

## 2026-07-12 — UX-6 ルーム内チャット

### 背景・目的
- バックログ UX-6。UI シェルのみだったチャットをオンラインルームで使えるようにする

### 実施内容
1. プロトコル: Client `chat` / Server `chat` + `chat_history`（game revision 非連動）
2. DO: `chatLog` リングバッファ（50）・本文 sanitize（120 字）・クールダウン 800ms
3. フロント: `onlineGame.chatMessages` / `sendChat`、共通 `ChatPanel.vue`
4. UI: ロビー（オンライン時）、ゲーム右レール（ログ|チャット）、モバイル下部タブ
5. エラー: `RATE_LIMITED` / `CHAT_REJECTED` の日本語メッセージ

### 主なパス変更
| パス | 内容 |
|------|------|
| `worker/types.ts` / `roomLogic.ts` / `GameRoom.ts` | ワイヤ型・append・handler |
| `src/online/protocol.ts` / `errorMessages.ts` | クライアント同期 |
| `src/stores/onlineGame.ts` | chat 状態 |
| `src/components/game/ChatPanel.vue` | UI |
| `src/views/GameView.vue` / `LobbyView.vue` | 配線 |
| `docs/backlog.md` 他 | UX-6 done |

### 明示的にやっていないこと
- ローカル対戦ボット向けチャット
- 既読・メンション・絵文字リアクション
- モデレーション / NG ワードリスト
- チャットの E2E（手動 2 タブ想定）

### 確認結果
- `npm test` 99 件成功
- `npm run build` 成功（ChatPanel チャンク分割）

### 次に考えられる作業
1. HOLD-5 本番 deploy（ユーザー確認後）
2. 未読バッジ、ホスト移譲カウントダウン（UX-2）

---

## 2026-07-12 — wrangler dev ハング修正（IPv4/IPv6）

### 背景・目的
- `npm run worker:dev` が Ready 後も HTTP 無応答（8787 LISTEN のみ）になりオンラインが使えない

### 実施内容
1. 再現: workerd が CPU 100%、`Recv-Q` 滞留、health タイムアウト
2. 原因: Node 内部 loopback が `[::1]` のみ、workerd が `localhost`→`127.0.0.1` へ Connection refused を無 backoff 連打（[workers-sdk#12910](https://github.com/cloudflare/workers-sdk/issues/12910)）
3. `worker:dev` に `NODE_OPTIONS=--dns-result-order=ipv4first` を付与
4. README / backlog HOLD-4 を原因・対策付きで更新

### 主なパス変更
| パス | 内容 |
|------|------|
| `package.json` | `worker:dev` に ipv4first |
| `README.md` | ハング原因と対策 |
| `docs/backlog.md` | HOLD-4 説明更新 |

### 明示的にやっていないこと
- wrangler 4 へのメジャー更新
- 上流 wrangler 本体のパッチ

### 確認結果
- `curl http://127.0.0.1:8787/api/health` → `{"ok":true,...}`
- `POST /api/rooms` → roomCode 返却
- Vite proxy (`:5173/api/health`) も成功
- workerd CPU ~0%（修正前 100%）
- Node loopback が `127.0.0.1` に bind

### 次に考えられる作業
1. 必要なら wrangler 4 へ更新（同様の workaround が残る可能性あり）
2. HOLD-5 本番 deploy

---

## 2026-07-12 — UX-7 スタンプリアクション

### 背景・目的
- ルーム内でスタンプ的なリアクションを送りたい（UX-7）
- 方針: 固定パレット + 画面浮遊 + チャット履歴に残す

### 実施内容
1. プロトコル: Client `reaction` / `ChatMessage.kind: 'stamp'` + `stampId`（allowlist 10 種）
2. DO: `appendStampReaction` — チャットと同一 800ms クールダウン、revision 非連動
3. フロント: `sendReaction` / `floatingReactions`、`ChatPanel` スタンプパレット、`ReactionOverlay`
4. ロビー・ゲーム双方に配線。履歴再送時は浮遊しない（live `chat` のみ）
5. backlog UX-7 done / phase1 プロトコル追記

### 主なパス変更
| パス | 内容 |
|------|------|
| `worker/types.ts` / `roomLogic.ts` / `GameRoom.ts` | STAMP_CATALOG・reaction handler |
| `src/online/stamps.ts` / `protocol.ts` | クライアント同期 |
| `src/stores/onlineGame.ts` | floating queue + sendReaction |
| `src/components/game/ChatPanel.vue` | パレット UI・大きなスタンプ表示 |
| `src/components/game/ReactionOverlay.vue` | 浮遊アニメ |
| `src/views/GameView.vue` / `LobbyView.vue` | 配線 |
| `docs/backlog.md` / `phase1-multiplayer.md` | UX-7 done |

### 明示的にやっていないこと
- 自由入力絵文字 / カスタムスタンプ画像
- メッセージ単位の Discord 風リアクション
- ローカル対戦向けスタンプ
- サウンド / ハプティクス

### 確認結果
- `npm test` 101 件成功
- `npm run build` 成功

### 次に考えられる作業
1. HOLD-5 本番 deploy（ユーザー確認後）
2. UX-2 ホスト移譲カウントダウン 等

---

## 2026-07-12 — モバイル向けスタンプ導線（チャット不要）

### 背景・目的
- スマホではチャット画面が使いづらいため、チャットを開かずにスタンプを送り浮遊表示したい

### 実施内容
1. `StampPickerSheet`（ボトムシート）を追加
2. ゲーム: 下部ナビ「スタンプ」＋ヘッダ 😀 からシートを開く
3. ロビー: スマホ幅のみクイック送信ボタン
4. 浮遊アニメをやや大きく・長めに調整

### 主なパス変更
| パス | 内容 |
|------|------|
| `src/components/game/StampPickerSheet.vue` | 新規 |
| `src/components/game/GameHeader.vue` | stamp イベント |
| `src/components/game/ReactionOverlay.vue` | 見えやすさ |
| `src/views/GameView.vue` / `LobbyView.vue` | 配線 |

### 明示的にやっていないこと
- チャット全文のフローティング化
- デスクトップ専用 FAB

### 確認結果
- `npm run build` 成功

### 次に考えられる作業
1. チャット履歴のモバイル見やすさ改善（任意）

---

## 2026-07-12 — 宣言表示・チャット入力のコンパクト化

### 背景・目的
- チャット入力が大きすぎる / 現在の宣言もそこまで大きくなくてよい

### 実施内容
1. `ChatPanel` compact: 入力・ヘッダ・行間を縮小（プレースホルダ「メッセージ…」）
2. `CurrentBidDisplay`: compact / 通常とも数字サイズを一段下げ
3. モバイル宣言パネルを `max-w-[12rem]` 程度に
4. `BidControls` モバイルの余白・ボタン高さを詰める

### 主なパス変更
| パス | 内容 |
|------|------|
| `src/components/game/ChatPanel.vue` | compact UI |
| `src/components/game/CurrentBidDisplay.vue` | 数字縮小 |
| `src/components/game/BidControls.vue` | モバイル密度 |
| `src/views/GameView.vue` / `LobbyView.vue` | compact 指定 |

### 確認結果
- `npm run build` 成功

---

## 2026-07-12 — モバイルチャットをボトムシート化

### 背景・目的
- 全画面モーダルではなく、現在の宣言の余白を活かして下からスライド表示したい

### 実施内容
1. チャット／ログを `translate-y` ボトムシートに変更（高さ ~58% / max 24rem）
2. 宣言数字は上部に残し、シート表示中は少し縮小
3. 薄い scrim タップで閉じる。宣言操作はシート中非表示
4. `ChatPanel` に `embedded` / `hideHeader`

### 主なパス変更
| パス | 内容 |
|------|------|
| `src/views/GameView.vue` | シート UI |
| `src/components/game/ChatPanel.vue` | embedded モード |

### 確認結果
- `npm run build` 成功

---

## 2026-07-12 — テキストチャットも浮遊表示

### 背景・目的
- チャット着信時もスタンプ同様に画面上へふわっと出したい

### 実施内容
1. live `chat` は stamp / text とも `floatingReactions` に積む（history は対象外）
2. `ReactionOverlay`: stamp=大絵文字、text=吹き出し+名前

### 主なパス変更
| パス | 内容 |
|------|------|
| `src/stores/onlineGame.ts` | FloatingReaction kind |
| `src/components/game/ReactionOverlay.vue` | テキスト吹き出し |

### 確認結果
- ビルド確認

---

## 2026-07-12 — 再接続メッセージが消えない不具合修正

### 背景・目的
- ゲーム画面で「〇〇 が再接続しました」がヘッダ下ステータスに残り続ける

### 実施内容
1. `onlineGame.lastEvent` を約 3.2 秒で自動クリア（`setLastEvent`）
2. イベントログ: サーバ全文（`Name が …`）を name/message に分割し「ルームが太郎 が…」表記を解消
3. leave 時も `lastEvent` をクリア

### 主なパス変更
| パス | 内容 |
|------|------|
| `src/stores/onlineGame.ts` | setLastEvent TTL / pushLog 分割 |

### 確認結果
- `npm run build` 成功

### 明示的にやっていないこと
- 宣言イベントのトースト化（ゲーム中はステータスバー短表示のみ）

---

## 2026-07-12 — ロビー／結果ヘッダー上ずれ修正

### 背景・目的
- ルーム待機画面でヘッダーが上に寄って見える

### 実施内容
1. `.safe-top` が `py-3` の `padding-top` を上書きしていたため、外側に safe-top・内側に py-3 の二重構造に変更（GameView と同じ）
2. ResultView も同様に修正

### 主なパス変更
| パス | 内容 |
|------|------|
| `src/views/LobbyView.vue` | ヘッダー構造 |
| `src/views/ResultView.vue` | 同上 |

---

## 2026-07-12 — ロビー sticky ヘッダーがコンテンツ下に潜る修正

### 背景・目的
- スクロール時に待機画面ヘッダーが本体の下に描画される

### 実施内容
1. `.desert-bg > * { z-index: 1 }` が Tailwind の z-20 より特異性が高く、sticky と本文が同階層になって後続が勝っていた
2. 装飾を `z-index: -1` + `isolation: isolate` に変更し、子の z-index 強制を削除
3. ロビーヘッダー `z-30`、本文の不要な `z-10` を削除

### 主なパス変更
| パス | 内容 |
|------|------|
| `src/styles/main.css` | desert-bg スタッキング |
| `src/views/LobbyView.vue` | z-index 整理 |

---

## 2026-07-12 — 本番デプロイ手順ドキュメント

### 背景・目的
- リリース前に「Worker と Pages のどちらに何を載せるか」と手順を文書化する

### 実施内容
1. `docs/deploy.md` を追加（Worker = API/DO、Pages = SPA）
2. 本番 URL を **`https://wildcount.rysh.dev`** に決定し、同一オリジン（Pages + Worker `/api/*`）を本線に記載
3. README / backlog（HOLD-5）からリンク

### 主なパス変更
| パス | 内容 |
|------|------|
| `docs/deploy.md` | デプロイ手順・本番 URL |
| `README.md` / `docs/backlog.md` | 参照更新 |

### 明示的にやっていないこと
- 実際の `wrangler deploy` / Pages 公開 / DNS 設定（HOLD-5・要確認）

---

## 2026-07-12 — ロビー切断・lint/typecheck 品質ゲート

### 背景・目的
- レビュー指摘: ロビーでの予期しない切断が即席削除になり、resumeToken / ready / ホスト 60s 猶予と矛盾
- `npm run lint` が flat config 不在で失敗、`tsc -b` も型エラー 11 件のままビルド成功していた

### 実施内容
1. **GameRoom `webSocketClose`**: ロビー含む全 status で `markPlayerDisconnected`（席・token 維持）。意図的退出は従来どおり `leave` → `removePlayerFromRoom`（attachment クリアで close が no-op）
2. **ESLint 9 flat config**（`eslint.config.js`）+ `globals` 依存追加。`npm run lint` 復旧
3. **typecheck**: `tsconfig.worker.json` で Worker を分離、`package.json` に `typecheck` スクリプト。型エラー修正（localGame `GameAction`、ResponseInit.webSocket、chat id: string、未使用 import）
4. **onlineGame**: 接続切替時に旧 `connectAndJoin` Promise がハングしないよう `activeConnectFail` で supersede。ストア単体テスト 6 件追加
5. phase1 仕様 §7.5 を leave vs unexpected close に合わせて明文化

### 主なパス変更
| パス | 内容 |
|------|------|
| `worker/GameRoom.ts` | ロビー close → markDisconnected |
| `worker/env.d.ts` / `roomLogic.ts` | CF ResponseInit.webSocket、chat id 型 |
| `src/stores/localGame.ts` / `onlineGame.ts` | 型修正・接続 supersede |
| `eslint.config.js` / `tsconfig.worker.json` / `package.json` | lint + typecheck ゲート |
| `tests/stores/onlineGame.test.ts` | 再接続・leave・socketGen 等 |
| `docs/phase1-multiplayer.md` | §7.5 更新 |

### 明示的にやっていないこと
- CI ワークフロー YAML の追加（リポジトリに `.github` なし）
- ロビー切断席の自動キック（idle TTL に依存）
- onlineGame の完全な統合 E2E

### 確認結果
- `npm run lint` 成功
- `npm run typecheck` 成功
- `npm test` 16 ファイル・108 テスト成功
- `npm run build` 成功

### 次に考えられる作業
1. CI（GitHub Actions 等）で `lint` / `typecheck` / `test` を必須化
2. ロビー切断席のホスト向け UI（再接続待ちの明示）
3. HOLD-5 本番 deploy

---

## 2026-07-12 — MAX→0 表示の可読性改善

### 背景・目的
- 手札タイル / 結果公開で `MAX→0` が幅不足で潰れて見づらかった（`0 (mix)` → `0*` と同種）。

### 実施内容
1. `cardLabel(max_to_zero)` を `M→0` に短縮（計算過程タイトルの「MAX→0 適用」はそのまま）
2. 結果 `RevealCardTile` は 2 行スタック（`MAX` + `→0`）に変更
3. 手札 `BidCard` は 3 文字超ラベルに `card-tile--dense`（やや小さい字）
4. ヘルプ特殊札の face を `M→0`、正式名は「最大値0化（MAX→0）」

### 主なパス変更
| パス | 内容 |
|------|------|
| `src/domain/game/deck.ts` | cardLabel → `M→0` |
| `src/components/game/RevealCardTile.vue` | 2 行レイアウト |
| `src/components/game/BidCard.vue` | dense クラス |
| `src/styles/main.css` | stack / dense スタイル |
| `src/data/helpContent.ts` | face / name 表記 |

### 明示的にやっていないこと
- 手札タイルに特殊札カラー（amber 等）を付けること
- 計算ステップ文言の変更

### 確認結果
- `npm test` 16 ファイル・108 テスト成功

### 次に考えられる作業
1. 特殊札（×2 / M→0）の手札面にも結果と同系の色分け
2. モバイルでの実機確認

---

## 2026-07-12 — 席ステータスをカード下へ

### 背景・目的
- 手番 / 済 / 待機などがアバター直下にあり、カードとの対応が分かりにくかった。

### 実施内容
1. **PC `PlayerSeat`**: ステータスチップを手札カードの下へ移動（ライフはアバター下のまま）
2. **モバイル `MobilePlayerCarousel`**: 同様にカード下へ。待機・あなた・脱落も表示
3. 表記を短く統一: `手番` / `済` / `待機` / `あなた` / `脱落`
4. 並び: アバター → ライフ → 手札 → ステータス → 宣言数値

### 主なパス変更
| パス | 内容 |
|------|------|
| `src/components/game/PlayerSeat.vue` | ステータスをカード下へ |
| `src/components/game/MobilePlayerCarousel.vue` | 同上 + 待機等 |
| `docs/ui-mock.md` | 席 UI メモ更新 |

### 明示的にやっていないこと
- ステータス用共通コンポーネント抽出
- 宣言済と bid チップの統合

### 確認結果
- レイアウト変更のみ（テスト対象のロジック変更なし）

### 次に考えられる作業
1. 特殊札の手札面カラー
2. 席縦スペースが足りる場合の実機確認

---

## 2026-07-12 — イベントログにラウンド区切り

### 背景・目的
- コヨーテ後に次ラウンドへ進んでもログが連続して見え、区切りが分かりにくかった。

### 実施内容
1. `EventLogItem.kind`: `entry` | `separator`
2. `EventLog.vue`: 区切りは横線＋「第Nラウンド開始」チップ
3. **ローカル**: 開始時・チャレンジ後（続行なら次ラウンド、終了なら「ゲーム終了」）
4. **オンライン**: Worker が `ROUND_START` / `GAME_ENDED` を broadcast。クライアントは separator として記録
5. mock ログにも第3ラウンド区切りをサンプル追加

### 主なパス変更
| パス | 内容 |
|------|------|
| `src/types/game.ts` | `kind` 追加 |
| `src/components/game/EventLog.vue` | separator UI |
| `src/stores/localGame.ts` | `pushSeparator` |
| `src/stores/onlineGame.ts` | ROUND_START 処理 |
| `worker/GameRoom.ts` | 開始・チャレンジ後イベント |
| `tests/stores/localGame.test.ts` | 区切りの検証 |

### 明示的にやっていないこと
- ログ全文ビュー（「ログをすべて表示」は未実装のまま）
- チャレンジ結果詳細のサーバー側ログ行（現状はコヨーテ＋区切り）

### 確認結果
- `npm test` 16 ファイル・109 テスト成功

### 次に考えられる作業
1. オンライン側に合計・敗者ログ行を足す（ローカルと揃える）
2. ログの古いエントリ折りたたみ

---

## 2026-07-12 — 結果画面から「トップへ」を削除

### 背景・目的
- 結果画面の「トップへ」は「次のラウンドへ」「もう一度遊ぶ」と誤タップしやすい。

### 実施内容
1. `ResultView` の「トップへ」ボタンと `goHome` を削除
2. 終了時は「もう一度遊ぶ」のみ、続行時は「次のラウンドへ」のみ
3. 勝者バナー文言を更新。`docs/ui-mock.md` も追随

### 明示的にやっていないこと
- ロビー／ヘッダ経由の退出導線の変更（ロゴ等は従来どおり）

### 確認結果
- UI のみの変更

---

## 2026-07-12 — 結果画面のスクロールバー非表示

### 背景・目的
- PC の結果画面で本文エリアにスクロールバーが出て見た目が邪魔だった。

### 実施内容
1. `.scrollbar-none` を追加し結果のスクロール領域に適用（スクロール自体は維持）
2. 余白を少し詰め、`safe-bottom` の二重付与を解消

### 主なパス変更
| パス | 内容 |
|------|------|
| `src/styles/main.css` | `.scrollbar-none` |
| `src/views/ResultView.vue` | 適用 + 余白調整 |

### 確認結果
- UI のみ

---

## 2026-07-12 — 途中抜け（方針A）+ 結果画面ゲート

### 背景・目的
- 対戦中の切断/退出で手番が止まり、ゲームが成立しなくなる問題
- 結果画面を早く閉じた人が次ラウンドを進められてしまう問題

### 実施内容
1. **domain** `forceEliminatePlayer` — 即脱落・手番繰り上げ・生存1人で game_over。当ラウンド手札は残す
2. **domain** チャレンジ後は `round_end` で停止（自動 START_ROUND 廃止）。START_ROUND は結果確認後
3. **Worker** 切断 60s で自動脱落 + host 移譲。意図的 leave は即脱落
4. **Worker** 全員 `dismiss_result` 後に `START_ROUND`。pending / round_end 中は bid 拒否
5. **local** `clearPendingResult` で START_ROUND + ログ区切り
6. **UI** 席「切断」チップ、結果待ちバナー、エラー文言

### 主なパス変更
| パス | 内容 |
|------|------|
| `src/domain/game/engine.ts` | forceEliminate / round_end |
| `worker/roomLogic.ts` | applyDueDisconnectPolicies |
| `worker/GameRoom.ts` | leave forfeit / dismiss → START_ROUND |
| `src/stores/localGame.ts` | 結果後に次ラウンド |
| `src/views/GameView.vue` | 待ちバナー |
| `docs/phase1-multiplayer.md` | §7.5 / 7.5.1 |

### 明示的にやっていないこと
- ホストによる手動キック UI
- 切断カウントダウン秒数のリアルタイム表示

### 確認結果
- `npm test` 16 ファイル・113 テスト成功

---

## 2026-07-12 — ゲーム画面「退出」ボタン接続

### 背景・目的
- ゲーム中に終了してホームへ戻る導線が欲しい
- ヘッダに退出アイコンはあったが未接続だった

### 実施内容
1. **GameHeader** PC/モバイルとも「退出」ボタンを配置し `leave` を emit
2. **GameView** 確認モーダル（オンラインは即脱落の説明）→ 確定で leave / local `resetSession` → ホーム
3. 同期待ち画面の退出も同じ確認フローに統一
4. **BidCard** テンプレート内コメントの引用符が Vue ビルドを壊していたため修正

### 主なパス変更
| パス | 内容 |
|------|------|
| `src/components/game/GameHeader.vue` | leave emit・退出ラベル |
| `src/views/GameView.vue` | 確認モーダル・終了処理 |
| `src/components/game/BidCard.vue` | ビルドエラー修正 |

### 明示的にやっていないこと
- ホストによるルーム全体の強制終了
- 結果画面への「トップへ」（誤タップ回避の既存方針のまま）
- ヘルプ本文への退出説明追記

### 確認結果
- `npm run build` 成功

### 次に考えられる作業
1. ヘルプ「操作」タブに退出・脱落の説明を足す
2. 切断カウントダウン秒数表示（UX-2）

---

## 2026-07-12 — ホストによるルーム強制解散

### 背景・目的
- 個人退出だけでなく、ホストがルーム全体を終了できる必要がある

### 実施内容
1. **プロトコル** Client `end_room`（host only）
2. **Worker** 認証後に event + `room_closed` を全員へ送信し storage 削除
3. **onlineGame** `endRoom()` / `room_closed` 時のセッション全クリア（再接続なし）
4. **UI** ゲーム退出モーダルにホスト向け「ルームを解散」；ロビーにも「ルームを解散」
5. 結果画面でも `ROOM_CLOSED` を監視してホームへ

### 主なパス変更
| パス | 内容 |
|------|------|
| `worker/types.ts` / `roomLogic.ts` / `GameRoom.ts` | end_room |
| `src/online/protocol.ts` / `errorMessages.ts` | 型・解散文言 |
| `src/stores/onlineGame.ts` | endRoom / room_closed 処理 |
| `src/views/GameView.vue` / `LobbyView.vue` / `ResultView.vue` | UI |
| `docs/phase1-multiplayer.md` | プロトコル追記 |
| `tests/**` | parse / endRoom / 文言 |

### 明示的にやっていないこと
- ホスト以外によるキック（個別）
- 解散理由の自由入力
- ヘルプ本文への追記

### 確認結果
- `npm test` 16 ファイル・116 テスト成功
- `npm run build` 成功

### 次に考えられる作業
1. ヘルプに退出・解散の説明
2. 切断カウントダウン表示（UX-2）

---

## 2026-07-12 — DO teardown 整理（end_room / idle purge）

### 背景・目的
- ルーム解散を足したとき Durable Object の破棄パスが二重・不完全だった
- `webSocketClose` が purge 後に storage を書き戻すレース、alarm 残留の可能性

### 実施内容
1. `teardownRoom` に共通化（`end_room` / idle `purgeRoom`）
2. close 前に attachment クリア → close ハンドラが再 save しない
3. `deleteAlarm()` のあと `deleteAll()`（compat 2024-10-01 では deleteAll だけでは alarm が残る）
4. phase1 §7.6 に DO ライフサイクル（idFromName 再利用）を明記

### 主なパス変更
| パス | 内容 |
|------|------|
| `worker/GameRoom.ts` | `teardownRoom` |
| `docs/phase1-multiplayer.md` | §7.6 拡充 |

### 明示的にやっていないこと
- `compatibility_date` の 2026-02-24 以降への引き上げ
- ルームコード再利用の明示的ブラックリスト
- 本番での DO 課金モニタ

### 確認結果
- `npm test` 16 ファイル・116 テスト成功
- `npm run build` 成功

### 次に考えられる作業
1. compat date 更新で deleteAll が alarm も消す前提に寄せる（要確認）
2. ヘルプに退出・解散の説明

---

## 2026-07-12 — 切断・退出による終了 UI（結果画面誘導をやめる）

### 背景・目的
- 切断タイムアウト／意図的退出で sole survivor になると `isGameOver` になり、「結果画面で勝者を確認」と出るが、コヨーテ結果は無い

### 実施内容
1. チャレンジ無しの game_over は **退出終了パネル**（勝者・説明・もう一度遊ぶ／退出）
2. イベントログも「退出・切断」と分かる文言に
3. モバイルにも同パネルを追加

### 主なパス変更
| パス | 内容 |
|------|------|
| `src/views/GameView.vue` | forfeit end UI |
| `worker/GameRoom.ts` | GAME_ENDED 文言 |

---

## 2026-07-12 — Connected to room 診断イベントを非表示

### 背景・目的
- WS 接続時の英語メッセージ `Connected to room …. Send join to enter.` がイベントログ／ステータスに出ていた

### 実施内容
1. Worker: upgrade 時の `CONNECTED` イベント送信を削除（クライアントは open 後に join するだけ）
2. クライアント: `CONNECTED` / 空メッセージの event は lastEvent・ログに載せない

### 主なパス変更
| パス | 内容 |
|------|------|
| `worker/GameRoom.ts` | welcome event 削除 |
| `src/stores/onlineGame.ts` | event フィルタ |

---

## 2026-07-12 — ルーム解散後のゲスト再接続 / worker メッセージ修正

### 背景・目的
- ホスト解散後もゲストが再接続できそうに見え、押すと `npm run worker:dev` 系の文言が出る

### 実施内容
1. close code 4001/4002（purge / host end）を `room_closed` 相当として処理（メッセージ欠落時も）
2. resume 失敗時はトークン破棄・`ROOM_CLOSED` 文言（dev の worker ヒントは新規作成時のみ）
3. 再接続 UI は `canAttemptResume` のときだけ表示
4. ホームの「前回のルーム」は解散検知で消す

### 主なパス変更
| パス | 内容 |
|------|------|
| `src/stores/onlineGame.ts` | applyRoomClosed / close code / resume 失敗 |
| `src/views/GameView.vue` / `LobbyView.vue` / `HomeView.vue` | 再接続導線 |
| `tests/stores/onlineGame.test.ts` | 解散・close code テスト |

### 確認結果
- `npm test -- tests/stores/onlineGame.test.ts` 12 tests 成功
- 全テスト・build 成功

---

## 2026-07-12 — カード公開 PC 見出しの改行崩れ修正

### 背景・目的
- PC のカード公開で「→ 数字（プレイヤー名）」が改行して見える

### 実施内容
1. 原因: `<p>` 内に `PlayerAvatar`（block の `div`）があり、ブラウザが段落を途中で閉じて後続テキストが別行になる
2. 見出しを `flex` の `div` に変更し、「→ 数字（名）」を `whitespace-nowrap` で一塊に

### 主なパス変更
| パス | 内容 |
|------|------|
| `src/views/GameView.vue` | カード公開サブタイトルのマークアップ |

### 確認結果
- マークアップ修正（見た目はブラウザ幅で確認）

---

## 2026-07-12 — 結果画面を他プレイヤー操作から隔離

### 背景・目的
- 結果表示中に他プレイヤーの dismiss / 切断などで `view` が更新されると、`pendingResult` が毎回再生成され計算演出がやり直されるなど、自分の画面が揺れていた

### 実施内容
1. `onlineGame`: チャレンジ単位で `heldResultView` を固定。同一 round/bid/challenger では再マップしない
2. ロビー/rematch（`status===open`）時のみ hold をクリア。サーバが pending を消しても閲覧中は維持
3. `ResultView` / `GameView`: 演出 watch をチャレンジ identity キーに変更
4. テスト: peer view noise でも `pendingResult` 参照が不変

### 主なパス変更
| パス | 内容 |
|------|------|
| `src/stores/onlineGame.ts` | frozen result hold |
| `src/views/ResultView.vue` | identity watch / isGameOver はスナップ優先 |
| `src/views/GameView.vue` | cut-in identity watch |
| `tests/stores/onlineGame.test.ts` | 安定性テスト |

### 明示的にやっていないこと
- 結果中のチャット/スタンプ表示追加
- サーバ側プロトコル変更（ACK ゲートはそのまま）

### 確認結果
- `npm test -- tests/stores/onlineGame.test.ts` 10 tests 成功
- `npm run build` 成功

### 次に考えられる作業
1. 結果画面に「他○人が確認中」程度の軽い共有ステータス（任意）

---

## 2026-07-12 — モバイル「プレイヤー」タブ削除

### 背景・目的
- スマホ下部ナビの「プレイヤー」は席一覧ではなく、チャット/ログを閉じるだけの擬似タブだった
- 席・札は常時 `MobilePlayerCarousel` に出るため、タブとして不要

### 実施内容
1. 下部ナビを **スタンプ / チャット / ログ** の 3 項目に整理
2. `mobileTab` を `'chat' | 'log' | null` に変更（`null` = プレイ画面）
3. ログ開閉を `toggleMobileLog` に統一。閉じるはシート「閉じる」＋背景タップ

### 主なパス変更
| パス | 内容 |
|------|------|
| `src/views/GameView.vue` | プレイヤータブ削除・状態型整理 |

### 明示的にやっていないこと
- カルーセル自体の変更
- デスクトップ右レールのタブ構成

### 確認結果
- `npm run build` 成功

### 次に考えられる作業
1. 実機・狭い幅でのナビ余白確認

---

## 2026-07-12 — ルーム解散メッセージを画面に出さない

### 背景・目的
- ホスト解散後にホーム等へ遷移したあと「ホストがルームを解散しました」が赤文字で残り、冗長

### 実施内容
1. `applyRoomClosed` / `endRoom` フォールバックで `lastErrorCode = ROOM_CLOSED` は維持し、`lastError` は null（トースト・ホームの sticky 文言を出さない）
2. 関連テストを更新

### 主なパス変更
| パス | 内容 |
|------|------|
| `src/stores/onlineGame.ts` | 解散時 UI メッセージ抑制 |
| `tests/stores/onlineGame.test.ts` | lastError null を期待 |

### 明示的にやっていないこと
- `formatRoomClosedReason` 自体の削除（マッパは残置）
- アイドル purge など他経路の文言整理以外の UI 変更

### 確認結果
- `vitest` onlineGame / errorMessages 23 tests 成功

---

## 2026-07-12 — ロビー山札カスタマイズ（UX-10）

### 背景・目的
- ルーム作成後、ホストが山札の枚数・構成を変えられるようにする（ドメインの `DeckComposition` をオンラインに接続）

### 実施内容
1. `RoomState.deck` + `PlayerView.deck`、WS `set_deck`（host / ロビーのみ）
2. `start` 時に `config.deck: room.deck` を渡して配札
3. ロビー UI `DeckSettingsPanel`（数字・特殊の ±、スタンダード復帰、適用）
4. 10〜120 枚バリデーション、旧 DO スナップショットは standard へ migrate
5. テスト（deck / roomLogic）と docs 更新

### 主なパス変更
| パス | 内容 |
|------|------|
| `src/domain/game/deck.ts` | clone / editor / room validate / summary |
| `worker/types.ts` · `roomLogic.ts` · `GameRoom.ts` | set_deck / deck 同期 / start 適用 |
| `src/online/protocol.ts` · `src/stores/onlineGame.ts` | クライアント wire + `setDeck` |
| `src/components/lobby/DeckSettingsPanel.vue` · `LobbyView.vue` | 山札 UI |
| `docs/phase1-multiplayer.md` · `game-rules.md` · `backlog.md` | 仕様・UX-10 done |

### 明示的にやっていないこと
- 追加プリセット（54 枚 large 等）
- ホーム作成時の事前デッキ選択
- ローカル対戦ロビーからのカスタム山札 UI

### 確認結果
- `npm test` — 124 passed
- `npm run typecheck` / `lint` / `build` — 成功

### 次に考えられる作業
1. large プリセット追加（card-design と整合）
2. ゲーム画面に「この山札 N 枚」チップ表示

---

## 2026-07-12 — 山札サマリー（カスタマイズ前）UI 磨き

### 背景・目的
- カスタマイズ画面を開く前の折りたたみ表示がプレーンだったので、夜砂漠テーマに寄せて見栄えを上げる

### 実施内容
1. カード山のファンプレビュー、総枚数ヒーロー、数字/特殊の内訳バッジ
2. 横スクロールの構成プレビュー（ミニタイル × 枚数）
3. ホスト向け CTA「山札をカスタマイズ」、ゲストは詳細閲覧
4. エディタ側も数字・特殊をミニカード面で表示

### 主なパス変更
| パス | 内容 |
|------|------|
| `src/components/lobby/DeckSettingsPanel.vue` | 折りたたみサマリーのデザイン強化 |

### 確認結果
- lint / typecheck / build 成功

---

## 2026-07-12 — ゲーム中の山札構成確認

### 背景・目的
- プレイ中に「この山札何枚構成だっけ」を確認できるようにする（残り山札・捨て札は対象外。開始時構成の総数）

### 実施内容
1. `DeckInfoModal` … 総枚数 + 数字/特殊内訳 + 構成タイル
2. `GameHeader` に「山」ボタン（desktop / mobile）
3. オンラインは `PlayerView.deck`、ローカルは `state.config.deck`

### 主なパス変更
| パス | 内容 |
|------|------|
| `src/components/game/DeckInfoModal.vue` | 新規 |
| `src/components/game/GameHeader.vue` | deck emit |
| `src/views/GameView.vue` | モーダル接続 |

### 確認結果
- lint / typecheck / test (124) / build 成功

---

## 2026-07-12 — 日本語UI文言のユーザフレンドリ化

### 背景・目的
- PR スコープは広がるが、全体の日本語説明をわかりやすく・ユーザ向けの口調に揃える

### 実施内容
1. **ヘルプ** (`helpContent.ts` / `HelpModal`) — 専門用語を減らし、話し言葉に近い説明へ。タブ「合計計算」→「合計の出し方」
2. **合計計算ステップ** (`calculate.ts` / 結果画面) — 「カード収集」「MAX→0 適用」等を「場のカード」「M→0（最大値をゼロに）」などへ
3. **山札UI** (ロビー・ゲーム中モーダル) — 「構成プレビュー」「山札を適用」等を「入っている札」「この内容で反映」などへ。標準ラベルから内部名 `card-design` を除去
4. **ホーム / ロビー / 結果 / ゲーム** — 作成・参加・復帰・勝敗・退出確認などのコピーを平易に
5. **エラー文言** (`errorMessages.ts` / roomLogic 山札バリデーション) — 技術的な表現を避け、次に何をすべきか分かるように

### 主なパス変更
| パス | 内容 |
|------|------|
| `src/data/helpContent.ts` | ヘルプ本文の全面見直し |
| `src/domain/game/calculate.ts` | 計算過程タイトル・詳細 |
| `src/domain/game/deck.ts` | スタンダード表示名 |
| `src/components/lobby/DeckSettingsPanel.vue` | 山札編集UI文言 |
| `src/components/game/DeckInfoModal.vue` | 対戦中山札説明 |
| `src/views/{Home,Lobby,Game,Result}View.vue` | 画面コピー |
| `src/online/errorMessages.ts` | オンラインエラー |
| `worker/roomLogic.ts` / `GameRoom.ts` | サーバ側日本語メッセージ |

### 明示的にやっていないこと
- 開発者向けドキュメント (`docs/*.md`) の文体統一
- 英語の内部コード・コメントの日本語化
- ボット名・アバター名の変更

### 確認結果
- test 124 件すべて成功
- typecheck / lint 成功

### 次に考えられる作業
1. 実機でヘルプ・結果・山札モーダルを通し読みして違和感チェック
2. 必要ならイベントログ（宣言・コヨーテ）の文面も統一

---

## 2026-07-12 — エクストラルール仕様合意と実装フェーズ分割

### 背景・目的
- 1/2・リバース・ショット・セイム・ドロー1・ダブルを任意ルールとして導入する方針を固める
- 実装を壊しにくい順のスライス（ER-0〜7）に分ける

### 実施内容
1. 合意事項を `docs/extra-rules.md` に正本化
2. `docs/game-rules.md` に概要リンクを追記
3. `docs/backlog.md` に Phase E（ER-0〜7）と推奨着手順を追加

### 確定ルール（要約）
- 宣言付随は **1 つのみ**
- 付随アクションは **1 人 1 ラウンド 1 回**（次ラウンドで復活）
- ドロー1 のみ **ラウンド全体 1 回**・対象は **自分以外**
- 1/2 は **0 方向の整数切り捨て**
- ダブル名称はそのまま（札の ×2 と UI 文脈で区別）

### 主なパス変更
| パス | 内容 |
|------|------|
| `docs/extra-rules.md` | 新設（仕様・状態スケッチ・フェーズ） |
| `docs/game-rules.md` | エクストラ概要表 |
| `docs/backlog.md` | ER-0〜7 |

### 明示的にやっていないこと
- エンジン / UI / Worker の実装（次セッション ER-0 から）

### 確認結果
- ドキュメントのみ（コード変更なし）

### 次に考えられる作業
1. ER-0 設定スケルトン
2. ER-1（1/2）と ER-2（セイム）を並列着手可

---

## 2026-07-12 — エクストラルールにチェンジを追加

### 背景・目的
- 直前宣言者に数字の付け直しを強制する「チェンジ」をエクストラに含める

### 実施内容
1. `docs/extra-rules.md` にチェンジ仕様を追記（7→9→チェンジ → 8 または 10+）
2. 個人アクション枠を「付随 + チェンジ」共有に更新
3. フェーズ **ER-3b** を追加。`game-rules` / `backlog` / 本ログを更新

### 確定ルール（チェンジ要約）
- 単独アクション。個人枠 1 消費
- 同じ数字不可。ひとつ前の宣言より大きい整数（初手のみなら minOpeningBid 以上）
- 強制再宣言は付随・セイム・チャレンジ不可
- 再宣言後の次手番はチェンジ使用者の次
- ダブルはチェンジで消滅

### 明示的にやっていないこと
- エンジン実装

### 次に考えられる作業
1. ER-0 から実装

---

## 2026-07-12 — エクストラルール説明をやさしく・遊び方に追記

### 実施内容
- `helpContent` / ヘルプ「遊び方」にエクストラのやさしい説明ブロックを追加
- ロビー `ExtraRulesPanel` のヒント文言を口語寄りに
- 特殊札タブ・操作タブの文言も合わせて緩和

---

## 2026-07-12 — 再戦で他プレイヤーを強制ロビー遷移しない

### 背景・目的
- 「もう一度遊ぶ」でルームはロビーに戻るが、他席まで結果画面から強制遷移していた

### 実施内容
1. 再戦押下者だけ `rematchNavigateToken` で自動ロビー遷移
2. 他席は結果 UI を保持し `pendingLobbyReturn` バナー → 任意で「ロビーへ」
3. GameView の `status===open` 一斉遷移を削除

---

## 2026-07-12 — 結果画面のライフ減少をダブル時 −2 表示

### 実施内容
- `ResultMock.lifeLoss` / mappers で `outcome.lifeLoss` を渡す
- `ResultView` の「ライフ −N」「N 失いました」を動的化（2 のとき「ダブル」表示）

---

## 2026-07-12 — セイムも個人アクション枠を消費

### 背景・目的
- セイム / チェンジ / リバース / ショット / ドロー / ダブルはすべて特殊能力
- セイムが何回も使えてしまっていたのを修正

### 実施内容
1. `canSame` / `doSame` で `extraActionUsedThisRound` を共有枠として消費
2. 仕様・ヘルプ・UI 文言を「このラウンド1回」に更新
3. テスト: セイム後に同ラウンドでセイム/リバース/チェンジ不可

---

## 2026-07-12 — 表記を「特殊能力」に統一

### 実施内容
- プレイヤー向け文言を「ひと技」→ **特殊能力** に変更（BidControls / ヘルプ / ロビー / 仕様要約）

---

## 2026-07-12 — ひと技 UI とエクストラ演出

### 背景・目的
- 「付随」表記が分かりづらい → プレイヤー向け言い換え（後に **特殊能力** に確定）
- セイム / チェンジ / 特殊能力に短いカットイン演出が欲しい

### 実施内容
1. `BidControls`: セレクト廃止 → チップ選択（なし / リバース / ショット / ドロー / ダブル）+ 対象チップ
2. `ExtraActionCutIn.vue`: 斜めスラッシュ + 絵文字カードの短尺演出
3. Worker `event.fx` で全クライアントに演出同期。ローカルは自分の操作で発火
4. ヘルプ・ロビー文言を更新

---

## 2026-07-12 — 1/2 をエクストラトグルから外す（山札のみ）

### 背景・目的
- 1/2 カードは Extra の ON/OFF ではなく、山札カスタム（`specials.half`）だけで枚数を決める方針に寄せる

### 実施内容
1. `ExtraRulesConfig` / ワイヤ / ロビーパネルから `halfCard` を削除
2. `applyHalfCardExtra` 注入を廃止（開始時は構成どおりの枚数のみ）
3. ヘルプ・仕様（`extra-rules` / `game-rules`）を更新
4. テスト: 山札に `half: 2` を載せたケースに差し替え

### 確認結果
- 計算ロジック（1/2）とデッキ編集の 1/2 行は維持

---

## 2026-07-12 — エクストラルール実装（ER-0〜ER-7）

### 背景・目的
- `docs/extra-rules.md` に従い、ホスト任意のエクストラルールをドメイン〜オンラインまで実装する
- デフォルト全 OFF で既存 MVP と同一挙動を維持

### 実施内容
1. **ER-0** `ExtraRulesConfig` / `GameConfig.extraRules` / GameState 拡張フィールド
2. **ER-1** `half` カード種・計算 `trunc(sum * 2^d / 2^h)`・halfCard ON 時に山へ 1 枚注入
3. **ER-2〜ER-5** SAME / REVERSE / CHANGE（強制再宣言）/ SHOT / life_double
4. **ER-6** DRAW1・`hands: Record<Id, Card[]>` 化・ラウンド全体 1 回
5. **ER-7** ロビー `ExtraRulesPanel`・WS `set_extra_rules`・ゲーム UI（セイム/チェンジ/付随セレクト）・ヘルプ追記
6. Worker / maskedView / mappers / デッキ編集（1/2 行）を連動
7. 単体テスト `tests/domain/game/extraRules.test.ts` ほか回帰

### 主なパス変更
| パス | 内容 |
|------|------|
| `src/domain/game/*` | 型・計算・検証・エンジン本体 |
| `tests/domain/game/extraRules.test.ts` | エクストラ受け入れテスト |
| `worker/*` | hands[]・アクション・extraRules 同期 |
| `src/components/lobby/ExtraRulesPanel.vue` | ロビー host トグル |
| `src/components/game/BidControls.vue` | セイム/チェンジ/付随 UI |
| `docs/backlog.md` | ER-0〜7 を done |

### 明示的にやっていないこと
- 複数札の個別タイル UI（ラベル結合表示のみ）
- 結果画面の「ライフ −2」専用文言
- ローカルデモからの extras トグル（オンライン ロビー設定が主）
- 本番デプロイ（HOLD-5）

### 確認結果
- `npm test` 146 件緑
- `npm run build` 成功
- `npm run typecheck` 成功

### 次に考えられる作業
1. HOLD-5 本番デプロイ（ユーザー確認後）
2. 複数札 UI / ライフ −2 文言の磨き
3. ローカルデモでの extras 設定

---

## 2026-07-13 — ドーパミン演出 第2波（ビジュアルのみ）

### 背景・目的
- 第1波（宣言ポップ / 手番バー / confetti / カットイン）の薄い箇所を埋め、各所に「報酬感」のある CSS 演出を足す。
- スコープ: **ビジュアルのみ**（効果音・触覚は対象外）。

### 実施内容
1. **ROUND スラム** — `RoundStartBanner`（round 増分 / 入場時）
2. **手番エッジグロウ** — 自分の手番中 `turn-edge-glow`
3. **特殊札キラキラ** — `RevealCardTile` + `FxSparkleBurst` / ring flash
4. **ライフ♥** — `LifeHearts`（割れ + 残り pulse）を席・モバイルカルーセルに接続
5. **結果** — 勝敗 vignette / Winner title slam
6. **スタンプ** — 放射バースト + 強い pop
7. **ロビー** — ready pop / join-in / copy sparkle
8. **ホーム** — 主 CTA の `btn-fx-press`
9. **a11y** — 新規クラスを `prefers-reduced-motion` で無効化
10. **ライフ喪失パネル強化** — 結果のアイコン(lg)・名前・大♥を中央配置。割れ graysale 終了で「失った感」
11. **宣言演出** — 中央: リング ripple / 数字エコー / キラキラ / 「宣言！」バッジ。操作バー: 宣言ボタンから数字が飛ぶ（のちサイズ拡大: 本体〜8xl / バッジ・launch 大きめ）
12. **宣言枠レイアウト固定** — フォントサイズ固定・バッジ absolute でチカチカ解消
13. ~~SP 宣言パネル absolute 重ね~~ → ユーザー指摘で**元の中央配置に戻した**

### 主なパス変更
| パス | 内容 |
|------|------|
| `src/components/common/FxSparkleBurst.vue` | 局所キラキラ |
| `src/components/game/RoundStartBanner.vue` | ROUND N バナー |
| `src/components/game/LifeHearts.vue` | ライフ FX |
| `src/styles/main.css` | wave-2 + life-lost panel keyframes |
| `src/views/GameView.vue` | round + turn edge |
| `src/components/game/RevealCardTile.vue` | 特殊札 sparkle |
| `src/views/ResultView.vue` | vignette / slam / **life-lost 大型パネル** |
| `src/components/game/CurrentBidDisplay.vue` | 宣言バースト（ripple / echo / バッジ） |
| `src/components/game/BidControls.vue` | 宣言ボタンから数字 launch |
| `src/components/game/ReactionOverlay.vue` | stamp burst |
| `src/views/LobbyView.vue` / `HomeView.vue` | 周辺 UI |
| `docs/ui-mock.md` / `docs/backlog.md` | メモ |

### 明示的にやっていないこと
- 効果音 / Web Audio / vibration
- canvas パーティクル・外部ライブラリ
- エンジン / Worker / プロトコル変更
- 残りライフ数の before/after 数値表示（喪失枚数の大♥のみ）

### 確認結果
- `npm run build` 成功

### 次に考えられる作業
1. 任意: 効果音トグル（宣言 / コヨーテ / 勝敗）
2. HOLD-5 本番デプロイ

---

## 2026-07-13 — アバター選択・変更 + バリデーション（UX-11）

### 背景・目的
- オンライン席のアバターは `nextAvatarIndex` の自動割当のみで、表示名と違い変更できなかった。
- クライアント任意の `avatarIndex` を受け付けるなら、範囲外・非整数の厳密な拒否が必要。

### 実施内容
1. **カタログ** — `AVATAR_COUNT` / `isValidAvatarIndex` / `sanitizeAvatarIndex`（UI は clamp）/ `avatarByIndex`
2. **Worker** — `join.avatarIndex` を任意受付。`parseOptionalAvatarIndex` は不正値を **捨てる**（silent clamp しない）。ロビー再 join と resume で変更可。未指定時は従来どおり round-robin
3. **クライアント** — `wc:avatarIndex` 永続、`updateAvatarIndex`、join に付与
4. **UI** — `AvatarPicker`（10 種グリッド）。Home オンライン欄 + Lobby（タップ即反映）。ローカルデモは同じ選択を self に反映可
5. **テスト** — catalog / resumeStorage / roomLogic parse

### 主なパス変更
| パス | 内容 |
|------|------|
| `src/localGame/avatarCatalog.ts` | 検証・sanitize・byIndex |
| `src/components/common/AvatarPicker.vue` | 新規ピッカー |
| `src/online/resumeStorage.ts` / `protocol.ts` | 永続 + join 型 |
| `src/stores/onlineGame.ts` | avatarIndex 状態・送信 |
| `src/views/HomeView.vue` / `LobbyView.vue` | 選択 UI |
| `worker/types.ts` / `roomLogic.ts` / `GameRoom.ts` | wire + handleJoin |
| `tests/**` | 単体テスト |
| `docs/backlog.md` | UX-11 done |

### 明示的にやっていないこと
- ゲーム中のアバター変更（ロビー / 入室時のみ）
- アバター重複禁止
- アップロード自前画像

### 確認結果
- `npm test` 155 件パス
- `npm run build` 成功

### 次に考えられる作業
1. 任意: ヘルプにアイコン変更の一文
2. HOLD-5 本番デプロイ

---

## 2026-07-13 — キャラ別スタンプ素材（UX-12）

### 背景・目的
- チャットスタンプを「送信者の動物アバター」でスキンすると遊び心が増える（いいね → その人のフクロウ版 など）。
- まず素材フルセットを生成し、表示配線まで入れて体感できる状態にする。

### 実施内容
1. **素材生成** — 既存 `public/avatars/{id}.webp` を参照に image_edit で感情差分。10 動物 × 9 感情 = **90** 枚
2. **配置** — `public/stamps/{avatarId}/{stampId}.webp`（256×256 WebP）+ `README.md`
3. **解決 API** — `characterStampSrc` / `CHARACTER_STAMP_IDS`（`src/online/stamps.ts`）。ワイヤの `stampId` は不変
4. **UI** — ピッカーは自分の動物でプレビュー、浮遊・履歴は送信者の動物。ブランド `coyote` スタンプは絵文字のまま
5. **docs** — backlog UX-12 done、単体テスト追加

### 主なパス変更
| パス | 内容 |
|------|------|
| `public/stamps/**` | 90 WebP + README |
| `src/online/stamps.ts` | characterStampSrc |
| `src/stores/onlineGame.ts` | FloatingReaction.stampSrc |
| `src/components/game/ReactionOverlay.vue` | 画像スタンプ |
| `src/components/game/ChatPanel.vue` / `StampPickerSheet.vue` | プレビュー・履歴 |
| `src/views/LobbyView.vue` / `GameView.vue` | avatarId 受け渡し |
| `tests/online/stamps.test.ts` | 解決テスト |
| `docs/backlog.md` | UX-12 |

### 明示的にやっていないこと
- ブランド `coyote` スタンプの動物差分
- Worker プロトコル変更（text は従来どおり絵文字）
- 効果音・アニメ差し替え

### 確認結果
- `tests/online/stamps.test.ts` パス
- 90 ファイル欠落なし

### 次に考えられる作業
1. ヘルプに「スタンプは自分のキャラ姿になる」一文
2. ブランド coyote スタンプも動物差分にするか検討

---

## 2026-07-13 — 浮遊チャットの z-index 修正

### 背景・目的
- 画面を流れるスタンプ／テキストチャットが、ボトムナビや宣言パネル等の下に描画されることがあった

### 実施内容
1. `ReactionOverlay` を `Teleport to="body"` し、`.desert-bg { isolation: isolate }` のスタッキング文脈から外す
2. `z-[50]`（ゲーム UI より上、退出確認 60 / スタンプシート 70 / ヘルプ 80 より下）

### 主なパス変更
| パス | 内容 |
|------|------|
| `src/components/game/ReactionOverlay.vue` | body Teleport + z-index |

### 明示的にやっていないこと
- Coyote / ExtraAction カットイン側の Teleport 化
- 他オーバーレイの z 値の全面見直し

### 確認結果
- 変更はコンポーネント内に閉じる（ビルド未実行）

### 次に考えられる作業
1. 実機でロビー／ゲーム双方の浮遊表示を目視確認

---

## 2026-07-13 — 手札2枚表示＋カード見た目リッチ化

### 背景・目的
- ドロー1などで **2枚持ち** になったとき、ラベルを1枚のタイルに結合して出していた（例: `+5 ×2`）
- 2枚を別タイルとして表示したい。ついでに手札・公開カードを少し大きくリッチに

### 実施内容
1. **ViewModel** — `handLabels: string[]` / `handCount` を追加（`handLabel` は結合文字列として維持）
2. **HandTiles** — 複数枚は扇状（fan）の2タイル。自分（hidden）も `handCount` 分の `?` を表示
3. **BidCard** — 種別別フレーム（数字 / マイナス / ×2 / MAX→0 / 1/2 / 0* / ？）、シーン・コーナーpip、やや大型化
4. **RevealCardTile** — サイズアップ＋シーン/pip/×2バッジ
5. **mock** — `?mock=1` でフクロウを2枚デモ（`+20` + `×2`）
6. **フォロー** — 数字コントラスト強化（text-shadow / dense サイズ上げ / sheen を背面化 / 扇の重なり緩和）。SP の「自分の札は見えない」文言削除

### 主なパス変更
| パス | 内容 |
|------|------|
| `src/types/game.ts` | handLabels / handCount |
| `src/mappers/toGameView.ts` / `onlineToGameView.ts` | 配列マッピング |
| `src/components/game/HandTiles.vue` | 新規・扇表示 |
| `src/components/game/BidCard.vue` | リッチフェイス |
| `src/components/game/PlayerSeat.vue` / `MobilePlayerCarousel.vue` | HandTiles 利用 |
| `src/components/game/RevealCardTile.vue` | サイズ・装飾 |
| `src/styles/main.css` | card-tile / hand-tiles / reveal 拡張 |
| `src/views/GameView.vue` | SP 文言削除 |
| `src/data/mockGame.ts` | 2枚デモ |
| `tests/mappers/*` | 複数枚・配列アサート |

### 明示的にやっていないこと
- 3枚以上のレイアウト最適化（現状は同ロジックで並べる）
- 結果画面のプレイヤー単位グループ化（公開は従来どおりカード単位）
- Worker プロトコル変更（`hands` / `handCount` 既存）

### 確認結果
- 関連 vitest パス
- `npm run build` 成功

### 次に考えられる作業
1. 実機でドロー1後の2枚扇と席の重なりを目視
2. 結果画面で同一プレイヤーの複数カードをグループ表示するか検討

---

## 2026-07-13 — 対戦画面スタンプ一覧が絵文字のままになる問題

### 背景・目的
- 対戦画面のスタンプピッカーが、キャラ別 WebP ではなく絵文字グリッドになっていた（スクショ確認）
- 待機部屋と同様、自分の動物スキンで 9 感情を表示したい（ブランド `coyote` のみ絵文字）

### 実施内容
1. **StampPickerSheet / ChatPanel** — `selfAvatarId` 既定を `'self'` に。prop 欠落時も感情スタンプは動物絵になる
2. **GameView** — `selfStampAvatarId` を game seats → lobby players → クライアント `avatarIndex` の順で解決
3. **chatAvatarForPlayer / floating** — 対局中は `game.seats` からも avatarIndex を取る
4. **PlayerSeat.avatarId** — mapper / profiles で asset id を載せ、履歴スタンプ解決を安定化

### 主なパス変更
| パス | 内容 |
|------|------|
| `src/components/game/StampPickerSheet.vue` | 既定アバター + computed プレビュー |
| `src/components/game/ChatPanel.vue` | ピッカー既定 `'self'` |
| `src/views/GameView.vue` | selfStampAvatarId / chatAvatar 強化 |
| `src/stores/onlineGame.ts` | 浮遊スタンプの seat 解決 |
| `src/mappers/onlineToGameView.ts` / `toGameView.ts` | avatarId |
| `src/types/game.ts` / `src/localGame/profiles.ts` | avatarId フィールド |

### 明示的にやっていないこと
- 本番デプロイ（origin 未 push の UX-12 込み）
- ブランド `coyote` スタンプの動物差分

### 確認結果
- `tests/online/stamps.test.ts` / mappers パス
- `npm run typecheck` パス

### 次に考えられる作業
1. 実機で対戦中ピッカーが自分の動物になることを確認
2. 本番へ UX-12 + 本修正をデプロイ

---

## ログの書き方

**正規のルールは `AGENTS.md` を参照。** 変更のあったセッションでは、このファイルに日付見出しで **追記** する（過去エントリは消さない）。

## 2026-07-13 — 対戦ヘッダーのチャット・スタンプ導線削除

### 背景・目的
- 対戦画面のヘッダーを簡潔にするため、PC／SPにあったチャットとスタンプのボタンを削除する。

### 実施内容
1. `GameHeader` のPC／SP両方からチャット・スタンプボタンを削除。
2. 不要になった `chat` / `stamp` emit、`GameView` のイベント配線、ヘッダー専用ハンドラーを削除。

### 主なパス変更
| パス | 内容 |
|------|------|
| `src/components/game/GameHeader.vue` | PC／SPヘッダーの2ボタンとemitを削除 |
| `src/views/GameView.vue` | ヘッダーイベント配線と未使用ハンドラーを削除 |
| `docs/work-log.md` | 本作業を追記 |

### 明示的にやっていないこと
- チャット／スタンプ機能自体の削除。
- PC右パネルおよびSP下部ナビの導線変更。

### 確認結果
- `npm run typecheck` 成功。
- `npm run build` 成功。

### 次に考えられる作業
1. PC／SP実機でヘッダーの余白と各残存導線を確認する。

---

## 2026-07-20 — チェンジ再宣言後に使用者へ手番を戻す

### 背景・目的
- チェンジ発動後、直前宣言者の再宣言のあと手番が「使用者の次」へ進み、発動者がスキップ（実質パス）になっていた
- 理想: 再宣言 → **チェンジ使用者のターン**

### 実施内容
1. `doChange` の `resumeNextPlayerId` を「使用者の次」から **使用者本人** に変更
2. 仕様・ヘルプ・テストを合わせて更新

### 主なパス変更
| パス | 内容 |
|------|------|
| `src/domain/game/engine.ts` | 再宣言後の再開先を CHANGE 使用者に |
| `src/domain/game/types.ts` | コメント修正 |
| `tests/domain/game/extraRules.test.ts` | 3 人・2 人ケースで使用者に戻ることを検証 |
| `docs/extra-rules.md` / `docs/backlog.md` | 進行仕様の更新 |
| `src/data/helpContent.ts` | 「付け直しのあと手番は自分に戻る」 |

### 明示的にやっていないこと
- オンライン Worker の別ロジック変更（ドメイン `applyAction` 経由のため不要）

### 確認結果
- `vitest run tests/domain/game/` 全パス（64）

### 次に考えられる作業
1. 実プレイで 3 人以上のチェンジ後ターン順を確認

---

## 2026-07-20 — 制限時間（持ち時間 + 毎ターン一時時間）

### 背景・目的
- オンライン部屋で制限時間を設定したい
- モデル: **持ち時間 + 毎ターンの一時時間**（例: 5分 + 20秒）。手番中は持ち時間が先に減り、尽きたらそのターンの一時時間が減る。未使用の一時時間は持ち越さない

### 実施内容
1. プロトコル: `set_time_control` / `PlayerView.timeControl` / `PlayerView.clock`
2. Worker: `RoomClock`（bank 先減算）+ DO alarm でタイムアウト
3. タイムアウト時: 可能なら最小宣言 → 不可ならコヨーテ → それも不可なら脱落
4. ロビー UI: `TimeControlPanel`（プリセット + カスタム秒）
5. 対戦 UI: ステータスバーに `⏱ 持ち + 一時` 表示（クライアント補間）
6. 単体テスト `worker/turnClock.test.ts`

### 主なパス変更
| パス | 内容 |
|------|------|
| `worker/turnClock.ts` | 時計ロジック（純粋） |
| `worker/roomLogic.ts` / `GameRoom.ts` / `types.ts` | 設定・同期・alarm |
| `src/online/protocol.ts` / `clockDisplay.ts` | クライアント型・表示計算 |
| `src/components/lobby/TimeControlPanel.vue` | ロビー設定 |
| `src/components/game/TurnClockDisplay.vue` | 対戦中時計 |
| `src/views/LobbyView.vue` / `GameView.vue` | 配線 |
| `docs/phase1-multiplayer.md` / `docs/backlog.md` | 仕様メモ |

### 明示的にやっていないこと
- ローカル / ボット対戦への制限時間
- タイムアウトでライフ1だけ減らす（フル脱落 or 自動アクションのみ）
- ヘルプ本文への制限時間説明の追記
- 対戦中の設定変更

### 確認結果
- `npm test` 全パス（165）
- `npm run typecheck` / `npm run lint` 成功

### 次に考えられる作業
1. ヘルプに制限時間の説明を追加
2. 席ごと残り持ち時間の常時表示
3. 本番デプロイ後の実機確認
