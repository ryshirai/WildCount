# デザイン磨きプラン（Phase B）

ローカルデモ（Phase 0.5）を土台に、**見た目と遊び心地**を段階的に上げる計画。  
本線の Worker / マルチプレイ（Phase 1）とは独立して進められる。

## ゴール

- 絵文字アバターを、夜砂漠テーマの**オリジナル動物ポートレート**に差し替える
- モック（`docs/画面イメージ.png`）に寄せた UI の密度・演出を整える
- ローカルデモだけで「製品の雰囲気」が伝わる状態にする

## 非ゴール（このプランではやらない）

- Cloudflare Worker / Durable Object / WebSocket
- ルームコード本実装・再接続・ホスト移譲
- 公式・他社 IP の模倣
- チャット本体

## 現状

| 項目 | 状態 |
|------|------|
| ゲームエンジン | Phase 0 完了 |
| UI ↔ エンジン（ローカル） | Phase 0.5 完了 |
| アバター | 絵文字暫定（`src/localGame/profiles.ts` 等） |
| ロゴ / favicon | 仮 |
| 見た目 | Tailwind 夜砂漠トークン済み、モックより簡素 |

参照: `docs/ui-mock.md` / `docs/design-overview.md` / `docs/画面イメージ.png`

---

## Phase 分け概要

| Phase | 名前 | 成果物 | 依存 |
|-------|------|--------|------|
| **B0** | アセット仕様の固定 | サイズ・パス・命名・表示ルール | なし |
| **B1** | アバター生成・配置 | デモ 4 体 → フル 10 体 | B0 |
| **B2** | ブランドアイコン | favicon / アプリアイコン / ヘッダーマーク | B0 |
| **B3** | アバターを UI に接続 | `PlayerAvatar` 画像化、profiles 更新 | B1 |
| **B4** | 席・ゲーム画面のブラッシュアップ | 手番リング、宣言チップ、モック寄せ | B3 |
| **B5** | 結果・カード演出 | 公開アニメ、特殊札は CSS/SVG | B3 |
| **B6** | ローカルデモ UX | ボット賢さ、終了フロー、人数など | B3 推奨 |
| **B7**（任意） | 背景・PWA 仕上げ | 砂漠背景強化、マニフェスト | B2 |

推奨実施順: **B0 → B1 → B2 → B3 → B4 → B5 → B6**（B7 は空き時間）。

---

## Phase B0 — アセット仕様

### 目的

生成と実装でブレないルールを先に決める。

### 決定事項

| 項目 | 採用案 |
|------|--------|
| アバター表示サイズ | 席: 約 44–56px / ログ・小: 約 28–36px |
| マスター解像度 | 512×512（または 1024×1024）生成 → 表示用 256 / 128 WebP |
| アスペクト | **1:1**（円形クリップ前提） |
| 配置 | `public/avatars/{id}.webp` |
| 命名（デモ 4） | `self.webp`, `owl.webp`, `fox.webp`, `wolf.webp` |
| 命名（フル 10） | 下表 |
| フォールバック | 画像失敗時は従来絵文字 |

### フル 10 体 ID 案

| id | 表示名 | 備考 |
|----|--------|------|
| `self` / `bear` | あなた / クマ | ローカルプレイヤー |
| `owl` | フクロウ | カウボーイハット可（モック準拠） |
| `kit` | キタロー | 子ギツネ |
| `raccoon` | アライグマ | |
| `wolf` | オオカミ | |
| `fox` | キツネ | 成体 |
| `deer` | シカ | |
| `falcon` | ハヤブサ | |
| `squirrel` | リス | |
| `coyote` | コヨーテ | ブランド寄り・任意 |

### 完了条件

- [ ] パス・ID・サイズをこのドキュメントで確定
- [ ] `public/avatars/` ディレクトリ用意

---

## Phase B1 — アバター生成

### 目的

一貫したスタイルの動物ポートレートを揃える。

### 作業手順

1. **スタイル見本 1 枚**（クマ or フクロウ）を共通スタイル全文で生成
2. 見本を固定し、Subject だけ差し替えて量産（可能なら参照生成で光・背景を揃える）
3. デモ用 **4 体**を先に確定 → 問題なければ **10 体**
4. 256 / 128 WebP に書き出し、`public/avatars/` へ配置

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

### フルプロンプト例（フクロウ）

```text
Wild Count game avatar, original character art. A wise barn owl wearing a small brown cowboy hat, large amber eyes, soft cream and brown plumage, gentle smirk. Style: refined digital painting, soft painterly brush, semi-realistic animal portrait, warm gold rim light (#c9a84c), cool night-blue shadows. Head-and-shoulders only, face centered, circular badge-friendly framing, plain dark navy circular backdrop, no text, no UI. Readable as a small icon. 1:1.
```

### 生成時の注意

- 背景に砂漠全景を入れすぎない（円クリップで切れる）
- 全身・小物過多はアイコンで潰れる
- 「公式コヨーテ」「既存ゲームのコピー」は使わない（オリジナル明記）

### 完了条件

- [ ] デモ 4 体が `public/avatars/` にある
- [ ]（任意）フル 10 体
- [ ] 小サイズでも誰の動物か判別できる

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

- [ ] favicon 差し替え済み
- [ ] ヘッダーにロゴマーク表示（任意でテキストロゴ併用）

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

- [ ] `/game` ローカルデモで画像アバター表示
- [ ] イベントログ・モバイルカルーセルも同様
- [ ] `npm run build` 成功

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

### 完了条件

- [ ] PC / モバイル両方で「仮モック感」が一段減る
- [ ] インディアンポーカー見え方を壊さない

---

## Phase B5 — 結果・カード演出

### 目的

コヨーテ後の「めくり・計算」を気持ちよくする。

### タスク案

- カード公開の軽いスタッガー表示
- 計算ステップの段階ハイライト（既に steps あり）
- 特殊カード（×2 / MAX→0）は **AI 文字より CSS/SVG タイル**
- 勝者バナー・ライフ減少の一文を見やすく

### 完了条件

- [ ] 結果画面が「仮置き」感から脱している
- [ ] 合計過程は引き続き `lastOutcome.calculation` 由来

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

### 完了条件

- [ ] 友人に URL なしでも「一人デモ」として見せられる
- [ ] 明らかな UX 引っかかりがない

---

## Phase B7（任意）— 背景・PWA

- 砂漠夜背景の強化（CSS or 1 枚の背景イラスト）
- `vite-plugin-pwa` とアプリアイコン接続
- オリジナル動物の追加ポーズ（勝利・脱落）は優先度低

---

## チェックリスト（横断）

- [ ] オリジナルアート方針を守る（他社 IP 不使用）
- [ ] domain（`src/domain/game`）に UI を混ぜない
- [ ] 変更セッションは `docs/work-log.md` 追記（`AGENTS.md`）
- [ ] `npm test` / `npm run build`

---

## 次のアクション（すぐやるなら）

1. **B0** 確定（このドキュメントを正とする）
2. **B1** デモ 4 体生成 → `public/avatars/`
3. **B3** `PlayerAvatar` 接続
4. 余力で **B2** favicon、**B4** 席 UI

生成ツールは Imagine / 外部ツールいずれでも可。実装接続は B3 で一括でも、1 体ずつ差し替えでもよい。

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
| `src/components/game/PlayerAvatar.vue` | アバター表示 |
