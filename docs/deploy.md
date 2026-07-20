# 本番デプロイ手順（HOLD-5）

身内向け招待制を前提に、Cloudflare へ載せる手順をまとめる。  
**実際の `wrangler deploy` / Pages 公開はユーザー確認後に行う**（phase1 非交渉）。

関連: `docs/backlog.md`（HOLD-5）· `docs/phase1-multiplayer.md` · `src/online/workerUrl.ts`

---

## 0. 本番 URL（決定）

| 項目 | 値 |
|------|-----|
| **公開 URL** | **`https://wildcount.rysh.dev`** |
| ゾーン | `rysh.dev`（Cloudflare 管理想定） |
| 構成 | **同一オリジン** — SPA と `/api` を同じホストで配信 |

```
https://wildcount.rysh.dev/              → Cloudflare Pages（静的 SPA / PWA）
https://wildcount.rysh.dev/api/*         → Cloudflare Worker（HTTP + WebSocket → DO）
wss://wildcount.rysh.dev/api/rooms/…/ws  → 同上
```

この構成ならフロントは **`VITE_WORKER_URL` 不要**（相対 `/api`・現在 host の `wss`）。  
開発時の Vite proxy と同じ形。

---

## 1. 何をどこに載せるか

| 役割 | 中身 | 載せ先 |
|------|------|--------|
| **フロント（SPA / PWA）** | `npm run build` → `dist/` | **Cloudflare Pages**（カスタムドメイン `wildcount.rysh.dev`） |
| **API + WebSocket + ルーム状態** | `worker/` + Durable Object `GameRoom` | **Cloudflare Workers**（ルート `wildcount.rysh.dev/api/*`） |

```
[ブラウザ] https://wildcount.rysh.dev
    │  / …              → Pages
    └  /api/… と WS     → Worker → GameRoom (DO)
```

### なぜ分けるか

| 部品 | 理由 |
|------|------|
| **Worker** | Durable Objects・WebSocket Hibernation が必要 |
| **Pages** | Vite の静的成果物（`dist/`）配信向き。PWA も素直 |

### いまのコードとの関係

- `VITE_WORKER_URL` が **空** → 同一オリジンの `/api` と `wss://現在の host/...`（`src/online/workerUrl.ts`）
- 別ホスト Worker を指すときだけ `VITE_WORKER_URL` をビルド時に設定
- Worker は CORS `*` 済み（別オリジン構成でも HTTP は通る）

### 将来の別案（必須ではない）

- **Workers Static Assets** で SPA も同じ Worker に載せる（デプロイ 1 本）。要設定追加

---

## 2. 前提チェックリスト

- [ ] Cloudflare アカウントあり
- [ ] **`rysh.dev` が Cloudflare ゾーンとして管理されている**（DNS / プロキシ）
- [ ] ローカルで `npm test` / `npm run build` が通る
- [ ] `wrangler login` 済み
- [ ] 招待制の範囲でよいこと（README: 一般公開時は追加確認）

```bash
npm test
npm run build
npx wrangler whoami
```

---

## 3. 構成パターン

### 3-B. 本番採用 — `wildcount.rysh.dev` 同一オリジン（推奨）

| パス | 向き先 |
|------|--------|
| `https://wildcount.rysh.dev/` | Pages プロジェクト（例: `wild-count`） |
| `https://wildcount.rysh.dev/api/*` | Worker `wild-count`（`wrangler.jsonc` の name） |

1. Worker をデプロイ  
2. Pages に `dist/` をデプロイ（**`VITE_WORKER_URL` 未設定**で build）  
3. Pages にカスタムドメイン `wildcount.rysh.dev` を付与  
4. Worker にルート `wildcount.rysh.dev/api/*` を付与  

詳細は §4〜§6。

### 3-A. 予備 — サブドメイン分離（ドメイン前の動作確認用）

| URL 例 | 中身 |
|--------|------|
| `https://wild-count.pages.dev` | フロント |
| `https://wild-count.<account>.workers.dev` | Worker |

`VITE_WORKER_URL=https://<workers.dev ホスト>` で build。  
本番 URL 確定後は **3-B に寄せる**（招待リンクは `https://wildcount.rysh.dev` に統一）。

### 3-C. 使わないもの

- **Pages だけ** … DO / WS が動かない  
- **`npm run deploy` だけ** … SPA が載らない  

---

## 4. 手順 A — Worker（API + DO）

```bash
npx wrangler login   # 初回のみ
npm run deploy       # wrangler deploy → Worker + DO
```

成功時: まず `*.workers.dev` URL が出る。あとでカスタムルートを足す。

### workers.dev での疎通（任意）

```bash
curl -sS "https://<WORKER_HOST>/api/health"
# → {"ok":true,"service":"wild-count",...}

curl -sS -X POST "https://<WORKER_HOST>/api/rooms"
```

### メモ

- DO migration: `wrangler.jsonc` の `v1` / `GameRoom`  
- 本番デプロイはユーザー確認後  

---

## 5. 手順 B — フロント（Pages）

### 5.1 ビルド（本番 = 同一オリジン）

```bash
unset VITE_WORKER_URL   # または未 export
npm run build
```

成果物: `dist/`（PWA 含む）。`public/_headers` も `dist/` にコピーされる（Pages 用キャッシュ制御）。

### 5.1b PWA 更新が反映されないとき

本番は Service Worker が静的資産を precache する。次を入れてある:

| 仕組み | 役割 |
|--------|------|
| `src/pwa.ts`（`virtual:pwa-register` + `autoUpdate`） | 新 SW 有効化時にタブを自動リロード |
| フォーカス / 5 分間隔の `registration.update()` | 開きっぱなしタブでも更新を検知 |
| `public/_headers` | `index.html` / `sw.js` を `no-cache`（CDN が古い SW を握らない） |

**この修正を初めて載せた直後**は、すでに古い SW を掴んでいる端末が 1 回だけ強制リロード（または DevTools → Application → Unregister）が必要なことがある。それ以降のデプロイは自動更新を期待できる。

### 5.2 Pages へ載せる

```bash
npx wrangler pages deploy dist --project-name=wild-count
```

Git 連携する場合の例:

| 項目 | 値 |
|------|-----|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | リポジトリルート |
| `VITE_WORKER_URL` | **設定しない**（3-B） |

---

## 6. 手順 C — `wildcount.rysh.dev` の紐付け

`rysh.dev` が Cloudflare にある前提。

### 6.1 Pages にカスタムドメイン

1. Dashboard → **Workers & Pages** → プロジェクト `wild-count`（Pages）  
2. **Custom domains** → `wildcount.rysh.dev` を追加  
3. DNS に CNAME（または必要なレコード）が自動 / 案内どおりに入るのを確認  
4. SSL が Active になるまで待つ  

### 6.2 Worker に `/api/*` ルート

`wildcount.rysh.dev` の **パス `/api/*` だけ** Worker に向ける。

**ダッシュボード例:**

1. **Workers & Pages** → Worker `wild-count`  
2. **Settings** → **Domains & Routes** → **Add** → **Route**  
3. Route パターン: `wildcount.rysh.dev/api/*`  
4. Zone: `rysh.dev`  
5. 保存  

**または `wrangler.jsonc` に routes を書いてデプロイで反映**（ゾーン ID はアカウント依存）:

```jsonc
// 例（zone_id はダッシュボードの rysh.dev ゾーン概要から。コミット前に実 ID を入れる）
// "routes": [
//   { "pattern": "wildcount.rysh.dev/api/*", "zone_name": "rysh.dev" }
// ]
```

※ `routes` をリポジトリに入れる場合は **実ゾーンに合わせた値**にしてから。未確定なら Dashboard のみでよい。

### 6.3 競合に注意

- ホスト全体を Pages に付けたうえで **`/api/*` は Worker ルートが優先**される想定で設定する  
- Worker にホスト丸ごと（`wildcount.rysh.dev/*`）を付けると SPA が Worker の 404 になるので **付けない**  
- 逆に `/api` が Pages に吸われるとルーム作成が失敗する → Route を再確認  

### 6.4 本番 URL での確認

```bash
curl -sS "https://wildcount.rysh.dev/api/health"
curl -sS -X POST "https://wildcount.rysh.dev/api/rooms"
```

ブラウザ:

1. `https://wildcount.rysh.dev` を開く  
2. ルーム作成 → 別端末で参加  
3. 1 ラウンド → リロード再接続 → 再戦  

---

## 7. 初回リリース順（チェックリスト）

1. [ ] `npm test` / `npm run build` が緑  
2. [ ] `npx wrangler login`  
3. [ ] `npm run deploy`（Worker）  
4. [ ] workers.dev で `/api/health`（任意）  
5. [ ] `VITE_WORKER_URL` **なし**で `npm run build`  
6. [ ] `npx wrangler pages deploy dist --project-name=wild-count`  
7. [ ] Pages カスタムドメイン: **`wildcount.rysh.dev`**  
8. [ ] Worker ルート: **`wildcount.rysh.dev/api/*`**  
9. [ ] `curl https://wildcount.rysh.dev/api/health`  
10. [ ] 2 端末で受け入れ（作成 / 参加 / 対戦 / 再接続 / 再戦）  
11. [ ] 招待 URL を **`https://wildcount.rysh.dev`** で共有  
12. [ ] `docs/backlog.md` の HOLD-5 を `done` に  

---

## 8. 運用・トラブル

| 症状 | 確認すること |
|------|----------------|
| `/api/health` が HTML / 404 | Worker ルート `wildcount.rysh.dev/api/*` が無い、または Pages に吸われている |
| ルーム作成失敗・UI は出る | 同上。Network タブで `/api/rooms` の向き先 |
| WS だけ切れる | `wss://wildcount.rysh.dev/...` になっているか（http ページや別ホスト混在に注意） |
| 古い UI | PWA キャッシュ。ハードリロード / SW 更新待ち |
| DNS / SSL 待ち | Pages カスタムドメインが Active か。ゾーンが Cloudflare プロキシ（オレンジ雲）か |
| 誤って `VITE_WORKER_URL` を入れた build | 別ホストを向く。同一オリジン運用なら **外して rebuild → Pages 再デプロイ** |

### 再デプロイ

```bash
# API だけ
npm run deploy

# UI だけ（本番・同一オリジン）
unset VITE_WORKER_URL
npm run build
npx wrangler pages deploy dist --project-name=wild-count
```

### ロールバック

- Pages: デプロイ履歴から以前を Activate  
- Worker: バージョン履歴、または git を戻して `npm run deploy`

---

## 9. スクリプト対応表

| コマンド | 範囲 |
|----------|------|
| `npm run dev` | フロント（`/api` → ローカル wrangler） |
| `npm run worker:dev` | ローカル Worker（:8787） |
| `npm run build` | `dist/`（`VITE_WORKER_URL` があればそれを埋める） |
| `npm run deploy` | **Worker のみ** |
| `npx wrangler pages deploy dist ...` | **Pages** |

将来スクリプト例（未追加）:

```json
"deploy:worker": "wrangler deploy",
"deploy:pages": "wrangler pages deploy dist --project-name=wild-count"
```

---

## 10. 非交渉の再掲

1. 本番デプロイは **ユーザー確認後**  
2. 秘密情報をリポジトリに載せない  
3. 変更セッションは `docs/work-log.md` に追記  
4. デプロイ完了後は backlog **HOLD-5** を更新  

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-07-12 | 初版。Worker + Pages |
| 2026-07-12 | 本番 URL を **`https://wildcount.rysh.dev`** に決定。同一オリジン（Pages + Worker `/api/*`）を本線手順に |
