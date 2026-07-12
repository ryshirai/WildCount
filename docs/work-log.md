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

## ログの書き方

**正規のルールは `AGENTS.md` を参照。** 変更のあったセッションでは、このファイルに日付見出しで **追記** する（過去エントリは消さない）。
