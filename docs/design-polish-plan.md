# デザイン磨きプラン（Phase B）

ローカルデモ（Phase 0.5）を土台に、**見た目と遊び心地**を段階的に上げる計画。  
本線の Worker / マルチプレイ（Phase 1）とは独立して進められる。

> **補足（2026-07-20）**: Phase B0–B7 は完了。その後の**全画面リデザイン**は `docs/ui-redesign.md`（R0–R6・完了）が正本。実装の現状表は `docs/ui-mock.md`。

## ゴール

- 絵文字アバターを、夜砂漠テーマの**オリジナル動物ポートレート**に差し替える
- モック（`docs/画面イメージ.png`）に寄せた UI の密度・演出を整える
- ローカルデモだけで「製品の雰囲気」が伝わる状態にする

## 非ゴール（このプランではやらない）

- Cloudflare Worker / Durable Object / WebSocket
- ルームコード本実装・再接続・ホスト移譲
- 公式・他社 IP の模倣
- ~~チャット本体~~ → UX-6 で実装（オンラインルーム）

## 現状

| 項目 | 状態 |
|------|------|
| ゲームエンジン | Phase 0 完了 |
| UI ↔ エンジン（ローカル） | Phase 0.5 完了 |
| アバター | **B0–B3 済**: フル 10 体 WebP + `PlayerAvatar` 画像表示（失敗時絵文字） |
| ロゴ / favicon | **B2 済**: `favicon.svg` + `logo-mark.webp`（`AppLogo` / `GameHeader`）+ PWA 用 `icons/` |
| 見た目 | **B4–B5 済**: 席 UI モック寄せ + 結果公開アニメ / 特殊札 CSS |
| ローカルデモ UX | **B6 済**: ボット賢さ・人数/表示名・終了導線 |
| 背景・PWA | **B7 済**: 砂漠夜背景強化 + `vite-plugin-pwa` / マニフェスト |

参照: `docs/ui-mock.md` / `docs/design-overview.md` / `docs/画面イメージ.png`

---

## Phase 分け概要

| Phase | 名前 | 成果物 | 依存 |
|-------|------|--------|------|
| **B0** | アセット仕様の固定 | サイズ・パス・命名・表示ルール | なし |
| **B1** | アバター生成・配置 | デモ 4 体 → フル 10 体 | B0 |
| **B2** | ブランドアイコン | favicon / アプリアイコン / ヘッダーマーク | B0 |
| **B3** | アバターを UI に接続 | `PlayerAvatar` 画像化、profiles 更新 | B1 |
| **B4** | 席・ゲーム画面のブラッシュアップ | **済**: 手番リング、宣言チップ、モック寄せ | B3 |
| **B5** | 結果・カード演出 | **済**: 公開アニメ、特殊札 CSS/SVG、計算ステップ演出 | B3 |
| **B6** | ローカルデモ UX | **済**: ボット賢さ、終了フロー、人数など | B3 推奨 |
| **B7**（任意） | 背景・PWA 仕上げ | **済**: 砂漠背景強化、マニフェスト | B2 |

推奨実施順: **B0 → B1 → B2 → B3 → B4 → B5 → B6**（B7 は空き時間）。

---

## Phase B0 — アセット仕様

### 目的

生成と実装でブレないルールを先に決める。  
**このセクションを正本とする。** 機械可読コピー: `src/localGame/avatarCatalog.ts`。

### 決定事項（確定）

| 項目 | 採用 |
|------|------|
| アスペクト | **1:1**（円形クリップ前提） |
| マスター解像度 | **512×512** 生成（必要なら 1024 からダウン） |
| リポジトリ配置 | `public/avatars/{assetId}.webp` |
| 公開 URL | `/avatars/{assetId}.webp`（Vite `public/` 直出し） |
| 表示用解像度 | **1 ファイル = 256×256 WebP**（帯域と鮮明さの折衷） |
| 128 版 | 当面なし（必要になったら `{assetId}-128.webp` を追加検討） |
| フォーマット | WebP、透過なし可（円クリップは CSS） |
| フォールバック | 画像欠落・`onerror` 時は **絵文字**（下表 `emoji`） |
| 著作権 | オリジナルのみ。公式・他社 IP の模倣禁止 |

### 表示サイズ（UI トークン ↔ CSS）

`PlayerAvatar` の `size` と対応。円直径の目安。

| size | 用途 | 直径（概算） | Tailwind 相当（現状） |
|------|------|--------------|----------------------|
| `sm` | イベントログ・小 UI | **36px** | `h-9 w-9` |
| `md` | 席（デフォルト） | **44px** | `h-11 w-11` |
| `lg` | 強調・結果など | **56px** | `h-14 w-14` |

- 画像は常に **256 WebP** を載せ、CSS で縮小する（srcset は後回しで可）。
- リング（手番 gold / self teal）は画像の外側。クリップは `rounded-full` + `object-cover`。

### アセット ID（フル 10 + ブランド任意）

ファイル名の stem = **assetId**（小文字・ハイフンなし）。

| assetId | 表示名（既定） | emoji | 備考 |
|---------|----------------|-------|------|
| `self` | あなた | 🐻 | ローカルプレイヤー用。**クマ肖像**。ファイル `self.webp` |
| `owl` | フクロウ | 🦉 | カウボーイハット可（モック準拠） |
| `kit` | キタロー | 🦊 | 子ギツネ（デモ 4 の 3 席目） |
| `raccoon` | アライグマ | 🦝 | |
| `wolf` | オオカミ | 🐺 | |
| `fox` | キツネ | 🦊 | 成体（`kit` と別ファイル） |
| `deer` | シカ | 🦌 | |
| `falcon` | ハヤブサ | 🦅 | |
| `squirrel` | リス | 🐿️ | |
| `coyote` | コヨーテ | 🐺 | ブランド寄り・任意（B2 と共有可） |
| `koi` | コイ | 🐟 | 煽り波: ドヤ顔の錦鯉 |
| `crow` | カラス | 🐦‍⬛ | 煽り波: あざ笑い |
| `peacock` | クジャク | 🦚 | 煽り波: マウント虚栄 |
| `hyena` | ハイエナ | 😆 | 煽り波: ゲラゲラ煽り |
| `cat` | ネコ | 🐱 | 煽り波: ニヤニヤ上から目線 |

補足:

- **`bear` は assetId にしない。** クマ肖像は `self.webp` のみ。10 人モックの「別席のクマ」も同じ `self` 画像を参照してよい（表示名だけ「クマ」）。
- デモ 4 は **`kit`**（キタロー）。以前案のデモ `fox.webp` は不採用（成体 `fox` はフルセット用）。

### デモ 4 体（B1 優先）

| 優先 | assetId | ファイル | 既定表示名 |
|------|---------|----------|------------|
| 1 | `self` | `public/avatars/self.webp` | あなた |
| 2 | `owl` | `public/avatars/owl.webp` | フクロウ |
| 3 | `kit` | `public/avatars/kit.webp` | キタロー |
| 4 | `wolf` | `public/avatars/wolf.webp` | オオカミ |

### プレイヤー ID ↔ assetId（ローカルデモ）

エンジン / `profiles.ts` の **player id** と、画像 **assetId** は分ける。

| player id | assetId | 表示名 | 現状 emoji |
|-----------|---------|--------|------------|
| `self` | `self` | あなた | 🐻 |
| `bot1` | `owl` | フクロウ | 🦉 |
| `bot2` | `kit` | キタロー | 🦊 |
| `bot3` | `wolf` | オオカミ | 🐺 |

B3 では `PlayerProfile` に `avatarSrc?: string`（例: `/avatars/owl.webp`）を足し、`avatar` は emoji フォールバックのまま残す想定。

### 10 人モック（`?mock=1`）対応目安

| モック席名 | assetId |
|------------|---------|
| フクロウ | `owl` |
| キタロー | `kit` |
| アライグマ | `raccoon` |
| オオカミ | `wolf` |
| キツネ | `fox` |
| シカ | `deer` |
| ハヤブサ | `falcon` |
| あなた | `self` |
| クマ | `self`（同一画像） |
| リス | `squirrel` |

### ディレクトリ

```
public/avatars/
  README.md          # 配置ルール（本仕様へのポインタ）
  self.webp          # B1 で追加
  owl.webp
  kit.webp
  wolf.webp
  …（フル 10）
```

空ディレクトリは Git 用に README で保持。画像本体は B1。

### 完了条件

- [x] パス・ID・サイズをこのドキュメントで確定
- [x] `public/avatars/` ディレクトリ用意
- [x] `src/localGame/avatarCatalog.ts` に ID / パス / emoji をコード化（UI 未接続）

---

## Phase B1 — アバター生成

### 目的

一貫したスタイルの動物ポートレートを揃える。

### 作業手順

1. **スタイル見本 1 枚**（クマ or フクロウ）を共通スタイル全文で生成
2. 見本を固定し、Subject だけ差し替えて量産（可能なら参照生成で光・背景を揃える）
3. デモ用 **4 体**（`self` / `owl` / `kit` / `wolf`）を先に確定 → 問題なければ **10 体**
4. **256×256 WebP** に書き出し、`public/avatars/{assetId}.webp` へ配置

### 共通スタイル（英語・生成用）

```text
Wild Count game avatar, original character art (not a real brand or licensed IP).
Style: refined digital painting, soft painterly brush, semi-realistic animal portrait,
warm gold rim light, cool night-blue shadows, subtle desert dust in the air.
Composition: head-and-shoulders only, face centered, looking slightly toward camera,
circular badge-friendly framing with generous padding, plain dark navy circular backdrop
(#0b1220 to #1a2740 gradient), no text, no UI chrome, no watermark.
Mood: mysterious night desert poker night, premium board-game quality.
Aspect ratio 1:1, high detail fur/feathers, readable at 48–64px icon size (clear silhouette, not busy).
```

### 共通スタイル（日本語・短縮）

```text
オリジナルの動物ポートレート（著作権キャラではない）。
半写実のデジタルペイント、夜の砂漠、金の縁光と紺の影。
バストアップ・顔中央・円形アイコン向け余白多め。
背景は暗い紺のグラデーションのみ。文字・UI・透かしなし。
1:1、小さなアイコンでもシルエットが分かる明瞭さ。
```

### Subject 一覧（共通スタイルの後に続ける）

| id | Subject |
|----|---------|
| `owl` | A wise barn owl wearing a small brown cowboy hat, large amber eyes, soft cream and brown plumage, gentle smirk. |
| `kit` | A clever red fox kit, bright orange fur, sharp curious eyes, slight playful grin, desert-night vibes. |
| `raccoon` | A racoon bandit-mask face, silver-grey fur, inquisitive expression, soft gold highlight on whiskers. |
| `wolf` | A grey wolf with calm confident eyes, dense fur, noble but friendly for a game avatar. |
| `fox` | An elegant adult red fox, sleek fur, knowing smile, slightly more mature than the kit. |
| `deer` | A graceful deer with small antlers, warm brown coat, gentle eyes, soft gold rim light on antlers. |
| `falcon` | A peregrine falcon portrait, sharp gaze, blue-grey plumage, fierce but stylized for a game icon. |
| `bear` / `self` | A friendly brown bear, soft rounded snout, warm brown fur, calm reliable expression (local player feel). |
| `squirrel` | A desert squirrel, tufted ears, alert eyes, sandy-brown fur, tiny energetic smile. |
| `coyote` | A desert coyote, sandy coat, sly smile, moonlit gold eyes — brand mascot energy. |
| `koi` | A smug Japanese koi carp, gold-orange and white scales, long barbels, cocky trash-talk smirk. |
| `crow` | A glossy black crow, sharp eyes, mocking mid-caw sneer, blue-violet sheen on feathers. |
| `peacock` | A peacock with iridescent blue-green neck and crest, arrogantly vain chin-up look. |
| `hyena` | A spotted hyena, sandy coat, open-mouth laughing cackle, trash-talk energy. |
| `cat` | A ginger tabby house cat, half-lidded eyes, classic smug superior smirk. |

### フルプロンプト例（フクロウ）

```text
Wild Count game avatar, original character art. A wise barn owl wearing a small brown cowboy hat, large amber eyes, soft cream and brown plumage, gentle smirk. Style: refined digital painting, soft painterly brush, semi-realistic animal portrait, warm gold rim light (#c9a84c), cool night-blue shadows. Head-and-shoulders only, face centered, circular badge-friendly framing, plain dark navy circular backdrop, no text, no UI. Readable as a small icon. 1:1.
```

### 生成時の注意

- 背景に砂漠全景を入れすぎない（円クリップで切れる）
- 全身・小物過多はアイコンで潰れる
- 「公式コヨーテ」「既存ゲームのコピー」は使わない（オリジナル明記）

### 完了条件

- [x] デモ 4 体（`self.webp`, `owl.webp`, `kit.webp`, `wolf.webp`）が `public/avatars/` にある
- [x] フル 10 体（+ raccoon / fox / deer / falcon / squirrel / coyote）
- [x] 小サイズでも誰の動物か判別できる

---

## Phase B2 — ブランドアイコン

### 目的

favicon・PWA・ヘッダーで同じ世界観を出す。

### プロンプト

**アプリアイコン（1:1）**

```text
App icon for a browser game called Wild Count. Centered emblem: a stylized coyote or wolf silhouette howling under a crescent moon, desert dunes implied at the bottom, deep night navy background (#0b1220), warm gold (#c9a84c) and soft teal accents. Simple bold shapes readable at small sizes, flat-to-soft-gradient finish, no tiny details, no text, no photoreal clutter. Premium indie board-game feel. Square 1:1, safe padding for rounded-square mask.
```

**favicon（単純）**

```text
Minimal favicon: single gold coyote head silhouette on deep navy circle, very simple shapes, high contrast, no text, 1:1.
```

**ヘッダーロゴマーク**

```text
Small horizontal logo mark for Wild Count: circular badge with wolf howling at a crescent moon, night desert palette (navy, gold, sand), clean vector-like edges, transparent-friendly solid background, no lettering.
```

### 配置案

| ファイル | 用途 |
|----------|------|
| `public/favicon.svg` または `.png` | ブラウザタブ |
| `public/icons/app-192.png` / `app-512.png` | PWA（後でマニフェスト接続） |
| `public/brand/logo-mark.webp` | `AppLogo` / `GameHeader` |

### 完了条件

- [x] favicon 差し替え済み
- [x] ヘッダーにロゴマーク表示（任意でテキストロゴ併用）

配置済み:

| パス | 用途 |
|------|------|
| `public/favicon.svg` | ブラウザタブ（SVG・金コヨーテ頭シルエット） |
| `public/favicon-32.png` | PNG フォールバック |
| `public/icons/app-192.png` / `app-512.png` | PWA（マニフェスト接続は B7） |
| `public/icons/apple-touch-icon.png` | iOS ホーム画面 |
| `public/brand/logo-mark.webp` | `AppLogo` / `GameHeader` |

---

## Phase B3 — アバターを UI に接続

### 目的

生成画像をゲーム・ロビー・ログで使う。

### 実装タスク

1. `PlayerProfile.avatar` を  
   - 当面: 絵文字 + `avatarSrc?: string`  
   - または: `avatar: { emoji, src }`  
2. `PlayerAvatar.vue` で `src` があれば `<img>`、なければ絵文字
3. `profiles.ts` / mock データを画像パスに更新
4. 円形クリップ・手番リング・self の teal リングを維持
5. 読み込み失敗時の絵文字フォールバック

### 主なパス

- `src/components/game/PlayerAvatar.vue`
- `src/localGame/profiles.ts`
- `src/data/mockGame.ts` / `mockLobby.ts`（任意）
- `src/mappers/toGameView.ts`（profile 経由なら最小）

### 完了条件

- [x] `/game` ローカルデモで画像アバター表示
- [x] イベントログ・モバイルカルーセルも同様
- [x] `npm run build` 成功

---

## Phase B4 — 席・ゲーム画面のブラッシュアップ

### 目的

`docs/画面イメージ.png` に寄せる（大幅リデザインはしない）。

### タスク案

| 項目 | 内容 |
|------|------|
| 手番強調 | 金リング + 軽い glow（既存強化） |
| 宣言済み | 小さな「宣言済み」チップ or 状態色 |
| 手札タイル | 他人: 表 / 自分: `?`（現状維持・見た目だけ改善） |
| 宣言チップ | 手札の下に金枠の数値（モック寄せ） |
| ライフ | ♥ 表示の位置・可読性 |
| ステータスバー | ボット思考・コヨーテ待ちの視認性 |
| 「結果を見る」 | バナー余白・階層 |

### 実施内容（B4）

| 項目 | 対応 |
|------|------|
| 手番強調 | `PlayerAvatar` 金リング 3px + `shadow-turn-glow` + パルス（`avatar-turn-ring`） |
| 宣言済み | `seat-chip-declared` 等の状態チップ（手番 / 済 / あなた / 待機 / 脱落） |
| 手札タイル | `card-tile` / `card-tile-mystery` の質感改善、self・手番で `emphasized` |
| 宣言チップ | 手札下の `bid-chip`（金枠・display 数字） |
| ライフ | ♥ を rose で明示、5 超は ×N |
| ステータスバー | ボット思考 / 手番 / コヨーテ待ちで色分け |
| 「結果を見る」 | バナー余白・宣言数値バッジ・ボタン階層 |

主なパス: `PlayerSeat.vue` / `PlayerAvatar.vue` / `BidCard.vue` / `MobilePlayerCarousel.vue` / `GameView.vue` / `main.css`

### 完了条件

- [x] PC / モバイル両方で「仮モック感」が一段減る
- [x] インディアンポーカー見え方を壊さない

---

## Phase B5 — 結果・カード演出

### 目的

コヨーテ後の「めくり・計算」を気持ちよくする。

### タスク案

- カード公開の軽いスタッガー表示
- 計算ステップの段階ハイライト（既に steps あり）
- 特殊カード（×2 / MAX→0）は **AI 文字より CSS/SVG タイル**
- 勝者バナー・ライフ減少の一文を見やすく

### 実施内容（B5）

| 項目 | 対応 |
|------|------|
| カード公開 | 席順スタッガー flip-in（`reveal-card-flip`、約 90ms 間隔） |
| 特殊札 | `RevealCardTile` — ×2 / MAX→0 / ? / 捨札混を CSS+SVG（数字は金タイル） |
| 計算過程 | steps を順に `calc-step--active` / `--done` でハイライト。最終合計バー |
| スキップ | ヘッダー「スキップ」で即時全公開 |
| バナー | 勝敗・ライフ −1 コールアウト（`life-lost-pulse`）を見やすく |

主なパス: `ResultView.vue` / `RevealCardTile.vue` / `main.css`  
データ: 引き続き `toResultView` → `lastOutcome.calculation`（domain 非変更）

### 完了条件

- [x] 結果画面が「仮置き」感から脱している
- [x] 合計過程は引き続き `lastOutcome.calculation` 由来

---

## Phase B6 — ローカルデモ UX

### 目的

見た目以外の「遊び心地」。

### タスク案

| 項目 | 内容 |
|------|------|
| ボット | 見える他人のカード合計を大まかに見て宣言・チャレンジ |
| 設定 | 人数 3–4、表示名、シード（任意） |
| 終了 | 勝者表示 → もう一度 / トップ の導線明確化 |
| モック導線 | `?mock=1` を開発用に残す or 整理 |
| ペース | 思考 3–5 秒・結果手動は現状維持（調整可） |

### 実施内容（B6）

| 項目 | 対応 |
|------|------|
| ボット | `estimateRoundTotal`（他者札 + 自分の期待値）で宣言・チャレンジ確率を調整 |
| 設定 | トップで人数 3/4・表示名・任意シード。`buildDemoLineup` |
| 終了 | 勝者バナー +「もう一度遊ぶ」（設定維持）。結果画面にトップへは置かない |
| モック導線 | トップの `?mock=1` リンクを `<details>` 開発用に折りたたみ |
| ペース | 思考 3–5 秒・結果手動は現状維持 |

主なパス: `src/localGame/bot.ts` / `profiles.ts` / `stores/localGame.ts` / `HomeView.vue` / `ResultView.vue`

### 完了条件

- [x] 友人に URL なしでも「一人デモ」として見せられる
- [x] 明らかな UX 引っかかりがない

---

## Phase B7（任意）— 背景・PWA

### 目的

夜砂漠の雰囲気を一段上げ、ホーム画面追加（PWA）を有効にする。

### 実施内容（B7）

| 項目 | 対応 |
|------|------|
| 砂漠背景 | `.desert-bg` を強化：月の光暈・多層砂丘・星・地平線ヘイズ・サボテンシルエット。UI 可読性優先で低コントラスト |
| PWA | `vite-plugin-pwa`（`registerType: autoUpdate`）+ Web App Manifest。B2 の `icons/app-192.png` / `app-512.png` を接続 |
| HTML | `theme-color` / apple-touch / description メタを整備 |
| 追加ポーズ | **未実施**（勝利・脱落アバターは優先度低のまま） |

主なパス: `src/styles/main.css` / `vite.config.ts` / `index.html` / `public/icons/*`

### 完了条件

- [x] 背景がフラットな単色から「夜砂漠」に見える
- [x] ビルド成果物にマニフェスト + SW が含まれる
- [x] `npm run build` 成功

---

## チェックリスト（横断）

- [ ] オリジナルアート方針を守る（他社 IP 不使用）
- [ ] domain（`src/domain/game`）に UI を混ぜない
- [ ] 変更セッションは `docs/work-log.md` 追記（`AGENTS.md`）
- [ ] `npm test` / `npm run build`

---

## 次のアクション（すぐやるなら）

1. ~~**B0** 確定~~ → 完了
2. ~~**B1** アバター~~ → フル 10 体配置済み
3. ~~**B3** `PlayerAvatar` 接続~~ → `avatarSrc` + 絵文字フォールバック
4. ~~**B2** favicon / ロゴ~~ → 完了
5. ~~**B4** 席・ゲーム画面~~ → 完了
6. ~~**B5** 結果・カード演出~~ → 完了
7. ~~**B6** ローカルデモ UX~~ → 完了
8. ~~任意 **B7** 背景・PWA~~ → 完了（追加ポーズは対象外）

Phase B 見た目磨きは一通り完了。次は Phase 1（Worker / マルチプレイ）または細部の遊び心地調整。

---

## 関連ドキュメント

| パス | 内容 |
|------|------|
| `docs/画面イメージ.png` | 目標 UI モック |
| `docs/ui-mock.md` | ルート・画面構成 |
| `docs/design-overview.md` | 全体設計 |
| `docs/game-rules.md` | ルール・カード見え方 |
| `docs/work-log.md` | 作業ログ |
| `src/localGame/profiles.ts` | デモ用プレイヤー定義 |
| `src/localGame/avatarCatalog.ts` | アセット ID / パス / emoji（B0） |
| `public/avatars/` | ポートレート WebP 配置先 |
| `src/components/game/PlayerAvatar.vue` | アバター表示 |
