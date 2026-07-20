# Wild Count — 全面 UI リデザイン計画

**方針**: 全画面（Home / Lobby / Game / Result）のレイアウト・情報設計・共通コンポーネントを作り直す。  
**制約**: 宣言 FX・カットイン・紙吹雪などの**既存マイクロ演出は維持**（見た目の載せ先・タイミングは調整可）。  
**状態**: **R0–R6 実装完了**（2026-07-20）。本ファイルは計画・受け入れの正本。実装メモは `docs/ui-mock.md`。

参照監査: Home/Lobby/Result 探索 + Game 探索（2026-07-20）。  
既存資産: `docs/画面イメージ.png` · `docs/ui-mock.md` · `docs/design-polish-plan.md` · `src/styles/main.css` · `tailwind.config.js`

---

## 1. ゴール / 非ゴール

### ゴール

1. **夜砂漠の製品感**を全画面で統一（余白・階層・タイポ・部品が「同じアプリ」に見える）
2. **対戦中はテーブルが主役** — 宣言値・手番・手札・主要アクション以外のクロムを削る
3. **ロビーは「待つ・始める」が主役** — 設定・チャットは二次
4. **モバイル短画面でも操作できる** — 固定クロムを整理し、手番中にチャットで操作が隠れない
5. **デザインシステムを先に固める** — 入力・ボタンサイズ・チップ・ヘッダー・トーストを共通化し、画面ごとの `!` 上書きを減らす
6. **GameView の構造負債を解消** — 1860 行のデュアルテンプレを分割し、以後の調整を可能にする

### 非ゴール（今回やらない）

- ゲームルール・エンジン・Worker プロトコル変更
- 効果音・触覚フィードバック
- 新規アバター／スタンプ素材の大量生成（必要なら最小限のアイコンのみ）
- 本番デプロイ（HOLD-5）
- 観戦モード・ランキング等の新機能
- 公式・他社 IP の模倣

### 維持するもの

| 維持 | 理由 |
|------|------|
| 夜砂漠パレット（night / gold / teal / sand） | ブランドの核。トーン調整は可、軸は変えない |
| `.desert-bg` 背景 | 世界観。必要なら微調整のみ |
| 宣言ポップ / エコー / launch / confetti / ROUND スラム / 手番エッジ / CoyoteCutIn / ExtraActionCutIn | ユーザー指定で維持 |
| アバター WebP・スタンプ WebP | 資産として活かす |
| インド式手札（自分 `?` / 他表向き） | ルール UI の核 |
| PC 楕円席 + モバイルカルーセルの基本方針 | モック準拠。グリッド化はしない |

---

## 2. 現状サマリ（なぜ全面か）

機能は揃っているが、**機能追加の積み重ねで密度と部品が散らばっている**。

| 問題 | 具体 |
|------|------|
| モバイル対戦がクロム過多 | ヘッダ + サブロウ + paceHint + カルーセル + メタ + 宣言 + 特殊能力 + 底ナビが常時競合 |
| GameView 肥大 | ~1860 行。PC/SP テンプレ二重 + 状態機械。リデザインしにくい |
| ロビーが縦長 | コード → 名前 → 山札 → エクストラ → 制限時間 → 参加者 → チャット → CTA。開始が遠い |
| 部品のばらつき | 入力クラスなし、`btn` サイズは `!px` 多用、`text-sand-100` 無効トークン、チップ色は毎回 `!` 上書き |
| 画面シェル不一致 | Home/Lobby = `page-scroll`、Result/Game = `page-fixed`。ヘッダ sticky 方針が画面ごとに違う |
| 二重表示 | 「あなたまであと N」が複数箇所、退出ボタンがロビー二重、スタンプ入口が SP 二重 |
| デッド UI | EventLog「ログをすべて表示」未配線、▾ が折りたたみに見えて閉じない |
| モックとのズレ | 絵文字ナビ／EN 混在（players, Round, CHALLENGE）、接続色が emerald 系、設定パネルが機能追加でモック時代より重い |

---

## 3. デザイン原則（リデザインの判断軸）

1. **1 画面 1 主役**  
   - Home: 入室  
   - Lobby: 集合と開始  
   - Game: 現在の宣言と手番  
   - Result: 勝敗と合計の理解  
2. **階層は 3 段まで** — プライマリ / セカンダリ / 三次（設定・ログ）  
3. ** Progressive disclosure** — 特殊能力・詳細設定・ログは開いたときだけ面積を取る  
4. **手番中は操作を隠さない** — チャット／ログを開いても宣言・コヨーテに届く  
5. **トークン優先** — 画面固有の長い utility 串は `.field` / `.chip-*` / `.btn-sm` に吸い上げる  
6. **演出は内容の強調** — FX は「何が起きたか」を増幅する。常時 UI の代わりにしない  
7. **日本語 UI を正** — ブランド英語（Wild Count, COYOTE カットイン）以外は日本語

---

## 4. デザインシステム（Phase R0）

実装の最初の土台。画面リデザインはこれに乗せる。

### 4.1 トークン拡張（`tailwind.config.js` + `main.css`）

| 追加 | 内容 |
|------|------|
| `.field` | 共通入力: `rounded-xl border-gold-400/25 bg-night-900/80 px-4 py-3 text-sand focus:ring-gold-400/30` |
| `.field-label` | `text-xs font-medium text-sand-dim`（Home/Lobby で統一） |
| `.btn-sm` / `.btn-icon` | `px-3 py-1.5 text-xs` / 正方形 `p-2` — `!` 上書きを廃止 |
| `.btn-danger` | 解散など破壊的操作（赤系ボーダー＋文字。確認ダイアログの主ボタンにも使用） |
| `.chip-teal` / `.chip-muted` / `.chip-danger` | 接続・状態・警告。base `.chip` のバリアント |
| 余白スケール | セクション間 `gap-section` 相当（`mb-4` / `mb-6` のルールを文書化） |
| `sand` 修正 | 無効な `text-sand-100` を `text-sand` に置換。必要なら `sand.100` を正式追加 |

### 4.2 共有コンポーネント（新規）

| コンポーネント | 役割 | 置き換え対象 |
|----------------|------|--------------|
| `AppHeader.vue` | logo + スロット（chips / actions） | Home 以外の sticky/固定ヘッダ重複 |
| `AppToast.vue` | 固定 pill + タイムアウト統一（例 2.5s） | Home/Lobby/Game のコピペ toast |
| `AppConfirmDialog.vue` | 解散・退出確認 | Lobby/Game の Teleport ダイアログ |
| `StatusChip.vue` | 接続・ラウンド・人数 | 画面ごとの chip `!` 上書き |
| （任意）`AppSection.vue` | `.panel` + タイトル | セクション見出しのばらつき |

### 4.3 ページシェル契約

| シェル | 用途 | ルール |
|--------|------|--------|
| `page-scroll` | Home | ルートがスクロール |
| `page-fixed` | Lobby, Game, Result | 固定ビューポート。Lobby は本文スクロール + 底 sticky CTA。Game/Result は領域内スクロール |
| ヘッダ | Lobby / Game / Result | `AppHeader` 同一 blur・同一 border（Game は `compact` 可） |
| safe-area | `safe-top` はヘッダ or 切断バナーどちらか一方 | 二重 padding 禁止。下端 fixed / ボトムシートは `safe-bottom`（ナビ・CTA・Help / 山札 / スタンプ等） |
| max-width | Home `max-w-lg` / Lobby 2 カラム / Result `max-w-3xl` / Game full | Lobby はワイド活用 |

### 4.4 アイコン方針

- ナビ・スキル・接続の**汎用絵文字を段階的に削減**（🐾 コヨーテ CTA などブランド的なものは可）
- 置換は **簡易 SVG（金/砂アウトライン）** または既存スタンプの単色シルエット。新規アート大量生成はしない
- 接続状態: emerald をやめ、**good=teal / reconnect=gold / offline=danger chip**

### 4.5 タイポ

| 用途 | 指定 |
|------|------|
| ブランド・宣言数字・大見出し | `font-display`（Cinzel） |
| 本文・UI | Noto Sans JP |
| ルームコード | `font-mono tracking-wider` |
| 英語残り | カットインの COYOTE / CHALLENGE、ロゴ "Wild Count" のみ推奨。`players` → `N人`、`Round N` → `ラウンド N` |

---

## 5. 画面別リデザイン仕様

### 5.1 Home — 入室フォーカス

**現状**: 1 メガパネル（名前+作成+参加）+ DEV ブロックが縦積み。

**目標 IA**

```
[ Logo + タグライン + 遊び方 ]
[ 再開カード ]          ← あるときだけ
[ プロフィール ]        ← 表示名 + AvatarPicker（.panel）
[ ルームを作る ]        ← btn-gold フル幅
[ または ]
[ ルームに参加 ]        ← コード field + btn-teal
[ DEV only … ]          ← 折りたたみ、本番 tree-shake 維持
```

**変更要点**

- プロフィール / 作成 / 参加を視覚的に分離（スキャンしやすく）
- 入力はすべて `.field`
- CTA press FX（`btn-fx-press`）は維持
- ヘルプはヘッダ相当の位置に `?` も可だが、初回はラベル付きを残してよい

**主要ファイル**: `HomeView.vue`, 共通 field/toast

---

### 5.2 Lobby — 「集まる・始める」再設計（高インパクト）

**現状の縦順（ホスト）**: banner → コード → 名前 → 山札(大) → エクストラ → 時間 → 参加者 → スタンプ → チャット → 4 ボタン

**目標 IA**

```
[ AppHeader: logo | 接続 | ? | 退出1つだけ ]
[ ルームコードヒーロー ]     ←  mono 大 + コピー（sparkle 維持）
┌ lg: 2 カラム ─────────────────────────────────┐
│ 左: 参加者グリッド（主役）                      │
│ 右: チャット（固定高）                          │
│     ルーム設定（1 アコーディオン）                │
│       ├ 山札（DeckSettings の品質は維持）         │
│       ├ 特殊能力ルール                          │
│       └ 制限時間                                │
└────────────────────────────────────────────────┘
[ sticky 底バー: 準備 / 開始 / （ホスト）解散 ]   ← 常時見える
```

**変更要点**

1. **退出はヘッダのみ**（底の二重削除）
2. **sticky アクションバー** — チャットの下までスクロールしなくても開始できる
3. **設定を 1 つの「ルーム設定」**にまとめ、既定は折りたたみ。山札サマリーは折りたたみヘッダに 1 行表示
4. ExtraRules / TimeControl を `.panel` 言語に揃え、`text-sand-100` 修正
5. Ready: 未準備は `btn-teal`、準備済は ghost またはチェック表示（ゲーティングが目立つ）
6. 解散確認は `btn-danger`（ダイアログ主ボタンを gold にしない）
7. SP: 参加者 → sticky CTA → 設定/チャットは下 or タブ。スタンプは底 or チャット内の一本化

**主要ファイル**: `LobbyView.vue`, `DeckSettingsPanel.vue`, `ExtraRulesPanel.vue`, `TimeControlPanel.vue`

---

### 5.3 Game — テーブル主役（全面リデザインの中核）

#### 5.3.1 構造リファクタ（必須の前処理）

`GameView.vue` を責務分割:

| 分割先 | 内容 |
|--------|------|
| `composables/useGameSession.ts`（仮） | online/local/mock 解決、acting、leave、toast |
| `composables/useChallengeReveal.ts` | カットイン後カード公開 FSM |
| `GameDesktopLayout.vue` | PC テンプレのみ |
| `GameMobileLayout.vue` | SP テンプレのみ |
| 共有 | `GameHeader`, `BidControls`, seats, overlays はそのまま子に |

演出コンポーネント（CoyoteCutIn, ExtraActionCutIn, RoundStartBanner, CurrentBidDisplay の FX）は**ロジックとクラスを壊さない**よう、マウント位置だけレイアウト側で調整。

#### 5.3.2 PC（`lg+`）目標

モック（`docs/画面イメージ.png`）に寄せつつ、現行機能を収める。

```
[ AppHeader: logo | コード | N人 | ラウンド | 時計? | ? 山 退出 ]
[ 任意: 手番ヒント 1 行（あなたまであと N / ボット思考） ]
┌ main ────────────────────┬ rail ──────────┐
│  楕円席 + 中央宣言（主役）   │  ログ | チャット │
│  席: アバター/札/状態/宣言   │  タブ切替       │
│  底ドック: BidControls       │                │
└──────────────────────────┴────────────────┘
```

- 中央宣言の下に薄い「テーブル盤」ellipse（任意）で砂漠と席カードのコントラスト改善
- 右レールは現状維持だがパネル余白・タブを `AppHeader` トーンに合わせる
- 英語チップを日本語化

#### 5.3.3 モバイル目標（最重要 UX）

**常時表示を 4 層に圧縮**

| 層 | 内容 | 高さの目安 |
|----|------|------------|
| 1. ヘッダ 1 本 | ロゴ短縮 or コード · ラウンド · `?`/`山`/退出。**サブロウ廃止**（接続は小さな StatusChip をヘッダ内へ） | ~48px |
| 2. 席カルーセル | 手番席を auto-scroll + 拡大、他は少し dim | 可変 |
| 3. 中央宣言 | 数字のみ大きく。turns ヒントは pace と二重なら片側削除 | 中 |
| 4. 操作ドック + 底ナビ | 宣言/コヨーテ常時。特殊能力は折りたたみ | ドック+nav |

**削除・統合**

- ヘッダ下の code/round/connection 重複行
- メタストリップの「あなたまであと N」が paceHint と重複なら一方のみ
- 底ナビ「スタンプ | チャット | ログ」は維持しつつ、**チャット内スタンプグリッドは SP で非表示**（入口一本化）

**特殊能力（BidControls）**

- デフォルト: ステッパー + 宣言 + コヨーテ の **1 行**
- 「特殊能力」チップで展開 → セイム/チェンジ/ライドスキル/ターゲット
- `canSame || canChange || extrasAllowed` がすべて false なら行自体非表示
- ドックは `max-h` で上限。特殊 UI は内部スクロール、**宣言/コヨーテは sticky 下端**（全エクストラ展開でクリップしない）

**チャット中も手番操作**

- シートを開いても **ミニ宣言バー**（宣言 / コヨーテ）をシート上端 or 底ナビ直上に sticky
- またはシート高さを `min(45%, …)` に抑え BidControls を常に見せる

**カルーセル**

- `isCurrentTurn` / self へ `scrollIntoView`（smooth、reduced-motion 配慮）
- ステータス文字 `8px` → 最低 `10px` またはアイコン化
- ライフ表示の PC/SP 差は許容だが、0 と最大の見え方は揃える

**デッド UI**

- EventLog「ログをすべて表示」: 展開実装 or 削除
- ▾ 装飾のみなら削除

#### 5.3.4 演出の載せ方（維持ルール）

| 演出 | 扱い |
|------|------|
| 宣言 slam / エコー / ripple / launch | CurrentBidDisplay / BidControls の既存クラス維持 |
| turn-edge-glow / turn-arrive | 維持。paceHint と同時でも可 |
| CoyoteCutIn → カード公開 | フロー維持。PC/SP の公開グリッドは**1 コンポーネントに統合**推奨 |
| ExtraActionCutIn / ROUND バナー | 維持 |
| ReactionOverlay | z-index / Teleport 方針維持 |
| 同時多発 | 可能なら優先キュー（任意・P2）。壊さない範囲で |

**主要ファイル**: `GameView.vue`（分割）, `GameHeader.vue`, `BidControls.vue`, `MobilePlayerCarousel.vue`, `CurrentBidDisplay.vue`, `EventLog.vue`, `ChatPanel.vue`, `PlayerSeat.vue`

---

### 5.4 Result — ドラマを保ち冗長さを削る

**目標フロー**

```
[ AppHeader: logo | ルーム/ラウンド | スキップ ]
[ 勝敗バナー 1 枚 ]          ← game over 時は勝者をここに統合し二重パネル回避
[ 計算ステップ ]            ← 既存ハイライト・count-up・confetti 維持
[ カード公開グリッド ]
[ 主 CTA: 次のラウンド / もう一度 ]
```

**変更要点**

1. ローディングを「dim 1 行」→ `.panel` スケルトンへ
2. ライフ減少の三重表現（−N / ハート / 文言）を **ハート + 短い文言** に圧縮
3. 合計の二重表示（verdict と calc-done）はアニメ用に残してよいが、静止後は 1 箇所が主
4. シェルを Lobby と揃えたヘッダ高さに
5. Help `?` は任意（特殊札確認用）。結果中は必須ではない
6. `prefers-reduced-motion` パスは維持

**主要ファイル**: `ResultView.vue`, `RevealCardTile.vue`, `FxConfetti.vue`

---

## 6. 実装フェーズ（PR / スライス計画）

実装セッションでは **上から順**。各スライス後 `npm test` / `typecheck` / `lint` / `build`。  
演出クラスを触る PR では、宣言・コヨーテ・結果の目視確認を必須とする。

### Phase R0 — デザインシステム土台

**成果**: トークン + 共有部品。見た目の大きな変化は最小。

1. `main.css` / `tailwind`: `.field`, `.btn-sm`, `.btn-icon`, `.btn-danger`, chip variants
2. `AppHeader`, `AppToast`, `AppConfirmDialog`, `StatusChip`
3. `text-sand-100` 修正
4. Home の入力だけ `.field` に寄せて検証

**受け入れ**: 既存画面が壊れない。Home 入力見た目が統一。テスト緑。

---

### Phase R1 — Home + Result リデザイン

**依存**: R0

1. Home IA（プロフィール / 作成 / 参加分離）
2. Result 階層圧縮・ローディング・ヘッダ統一
3. 英語 UI の日本語化（該当箇所）

**受け入れ**: 入室〜（モック結果）導線が綺麗。演出（count-up, confetti）動作。

---

### Phase R2 — Lobby 情報設計

**依存**: R0

1. sticky 底アクションバー
2. 退出一本化
3. 設定 1 アコーディオン + 2 カラム（lg）
4. Extra/Time を panel 言語に
5. Ready / 解散ボタンのセマンティクス

**受け入れ**: ホストがスクロールなしで開始できる（設定を開かない場合）。2 タブ online で ready/start 回帰。

---

### Phase R3 — Game 構造分割（見た目ほぼ同じ）

**依存**: なしでも可。R0 と並列可。**演出を壊さないこと最優先**

1. GameView を layout + composable に分割
2. コヨーテ公開グリッドの共通化
3. 挙動・クラス名は現状維持（スナップショット的リファクタ）

**受け入れ**: ローカルデモ + online の bid/challenge/result が従来どおり。FX 目視 OK。

---

### Phase R4 — Game モバイル・操作ドック（UX 本丸）

**依存**: R3 推奨

1. ヘッダ 1 本化・メタ重複削除
2. BidControls progressive disclosure
3. カルーセル auto-focus
4. チャット中ミニ操作バー
5. スタンプ入口一本化
6. EventLog デッド UI 処理
7. 文言日本語化・接続チップ色

**受け入れ**: 短い viewport（例 667 高）で「席・宣言・宣言ボタン」が同時に見える。手番中チャットを開いても宣言可能。FX 維持。

---

### Phase R5 — Game デスクトップ磨き + 席共通化

**依存**: R3–R4

1. ヘッダを AppHeader / StatusChip に
2. 中央テーブル盤（任意）
3. PlayerSeat と Carousel の表示ロジック共通化（`SeatContent` 抽出）
4. 右レール密度・タブ見た目揃え

**受け入れ**: 10 人モック相当でも席が読める。モック画像に近い密度。

---

### Phase R6 — 全体ポリッシュ・ドキュメント

1. `docs/ui-mock.md` 更新（現状表・シェル契約）
2. `docs/design-overview.md` の「PC グリッド」表記を楕円に修正
3. `docs/design-polish-plan.md` または新 `docs/ui-redesign.md` に本計画を正本化
4. `docs/backlog.md` に残 idea（SFX, 席ごと時計など）
5. `docs/work-log.md` 各スライスで追記（AGENTS.md 準拠）
6. 無効トークン・デッド CSS 掃除

**受け入れ**: ドキュメントと実装が一致。backlog 更新済み。

---

## 7. 推奨実施順（まとめ）

```text
R0 デザインシステム
 ├─ R1 Home + Result
 ├─ R2 Lobby
 └─ R3 Game 分割（並列可）
      └─ R4 Game モバイル
           └─ R5 Game デスクトップ
                └─ R6 Docs / 掃除
```

**ユーザー価値が出る最短パス**: R0 → R4（要 R3）→ R2。  
**「全面」を完遂するなら**: R0〜R6 すべて。

---

## 8. リスクと緩和

| リスク | 緩和 |
|--------|------|
| 演出クラス削除で「味気なくなる」 | FX コンポーネントと keyframe は R3 で触らない。R4 はマウント位置のみ |
| GameView 分割で online 回帰 | 分割 PR は見た目同一。`npm test` + 手動 2 タブ |
| ロビー sticky バーがキーボードと干渉 | `safe-bottom` をバー側に集約。チャット input はシート内 |
| 特殊能力を隠して発見性低下 | 手番かつ使用可能時はドックに「特殊能力」バッジ点灯 |
| 差分巨大でレビュー不能 | フェーズ単位 PR。R3 はリファクタ専用 |

---

## 9. 受け入れチェックリスト（全面完了時）

- [x] Home / Lobby / Game / Result が同じヘッダ・ボタン・入力言語
- [x] ロビー: 設定を開かずに sticky から開始できる
- [x] ゲーム SP: 常時クロムが 4 層以内、チャット中も宣言可
- [x] 特殊能力は折りたたみ。未使用時は非表示
- [x] 宣言 FX・Coyote・Extra・ROUND・confetti・stamp float が従来どおり発火
- [x] 無効 `sand-100` なし。デッド「ログをすべて表示」なし（R0 / R4）。R6 で未使用 CSS（`seat-circle` 等）掃除
- [x] UI 英語の不必要混在を削減（ROUND バナー等。COYOTE カットイン等ブランド英語は維持）
- [x] `npm test` / `typecheck` / `lint` / `build` 緑
- [x] `docs/ui-mock.md` + work-log + backlog 更新

---

## 10. 引き継ぎ（R6 完了後）

1. **HOLD-5** 本番デプロイはユーザー確認後（`docs/deploy.md`）
2. 任意 idea: 効果音 / 触覚、席ごと持ち時間表示（`docs/backlog.md`）
3. 演出・ルール・Worker の変更は本計画の範囲外

---

## 11. 主なタッチファイル一覧

| 領域 | パス |
|------|------|
| トークン | `tailwind.config.js`, `src/styles/main.css` |
| 共通新規 | `src/components/common/AppHeader.vue`, `AppToast.vue`, `AppConfirmDialog.vue`, `StatusChip.vue` |
| Home | `src/views/HomeView.vue` |
| Lobby | `src/views/LobbyView.vue`, `src/components/lobby/*` |
| Game | `src/views/GameView.vue` → 分割, `src/components/game/*` |
| Result | `src/views/ResultView.vue` |
| Docs | `docs/ui-redesign.md`（新）, `ui-mock.md`, `design-overview.md`, `backlog.md`, `work-log.md` |

ロジック・Worker・domain は原則非対象（表示文言・mapper 表示用ラベルのみ可）。
