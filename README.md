# Wild Count

リアルタイムで遊べる数字推理・ブラフゲーム「Wild Count」のWeb版。

Coyote系ゲームをベースに、複数人（最大10人）でブラウザから同じ部屋に参加して遊べるようにしたものです。

## 特徴

- **ブラウザのみ**で完結（iPhone / Android / PC対応）
- PWA対応（ホーム画面に追加可能）
- Cloudflare Workers + Durable Objects で低遅延リアルタイム通信
- 1ルーム = 1 Durable Object で状態管理
- 再接続・ホスト移譲・切断耐性に強い設計

## 技術スタック

- **Frontend**: Vue 3 + TypeScript + Vite + Pinia + Vue Router
- **Backend**: Cloudflare Workers + Durable Objects + SQLite-backed Storage
- **PWA**: vite-plugin-pwa
- **開発環境**: Dev Container (Node 22)

## 開発環境のセットアップ

### 1. Dev Containerで開く（推奨）

1. このリポジトリをVS Codeで開く
2. `Dev Containers: Reopen in Container` を実行
3. 自動で `npm install` が実行されます

### 2. 手動セットアップ

```bash
npm install
```

### 3. 開発サーバー起動

```bash
# Frontend（Vite）
npm run dev

# Backend（Wrangler）— 別ターミナル
npm run worker:dev
```

### wrangler dev が応答しなくなったとき

Dev Container / Linux 上で、**ポート 8787 は LISTEN しているのに HTTP が返らない**ことがあります。

**原因（ローカル固有）**: Node が内部 loopback を `[::1]` のみに bind し、workerd が `localhost` → `127.0.0.1` へ繋ごうとして Connection refused を無 backoff で連打 → workerd が **CPU 100%** でハングする（[workers-sdk#12910](https://github.com/cloudflare/workers-sdk/issues/12910)）。

**対策**: `npm run worker:dev` は `NODE_OPTIONS=--dns-result-order=ipv4first` 付きで起動する（`package.json` に設定済み）。Node が `127.0.0.1` に bind し、workerd と一致する。

それでも応答しないとき:

1. ホームの「ルームを作成」は約 8 秒でタイムアウトし、再起動を促す文言を出します  
2. 復旧: `worker:dev` を止めて再起動（`workerd` が残っていれば PID を kill）  
3. 確認: `curl -s http://127.0.0.1:8787/api/health` → `{"ok":true,...}`  
4. workerd が 100% CPU なら上記 IPv4 設定を確認

本番 Cloudflare 上では同じ症状は未確認。

## 主なスクリプト

```bash
npm run dev          # Vite開発サーバー
npm run build        # 本番ビルド（フロント dist/）
npm run worker:dev   # Wrangler開発サーバー
npm run deploy       # Cloudflare Worker のみデプロイ（API / DO）
npm run lint         # ESLint
npm run format       # Prettier
```

本番の載せ方（**Worker + Pages**、公開 URL: **`https://wildcount.rysh.dev`**）は [`docs/deploy.md`](docs/deploy.md) を参照。

## プロジェクト構造

```
wild-count/
├── .devcontainer/          # VS Code Dev Container設定
├── docs/                   # 仕様・作業ログ・残タスク
│   ├── backlog.md          # 残タスク一覧（正本）
│   ├── phase1-multiplayer.md
│   └── work-log.md         # セッション作業ログ
├── public/                 # 静的ファイル（icons, images）
├── src/                    # フロントエンド
│   ├── domain/game/        # 純粋ゲームエンジン（Phase 0）
│   ├── components/
│   ├── views/
│   ├── stores/
│   └── online/
├── worker/                 # Cloudflare Workers
│   ├── GameRoom.ts
│   └── ...
├── tests/                  # テスト
├── vite.config.ts
├── wrangler.jsonc
└── README.md
```

## ドキュメント

| パス | 内容 |
|------|------|
| [`docs/backlog.md`](docs/backlog.md) | **残タスク・hold・改善案の一覧** |
| [`docs/deploy.md`](docs/deploy.md) | **本番デプロイ手順（Worker + Pages）** |
| [`docs/phase1-multiplayer.md`](docs/phase1-multiplayer.md) | マルチプレイ設計（Worker / DO / WS） |
| [`docs/work-log.md`](docs/work-log.md) | セッションごとの作業ログ |
| [`docs/game-rules.md`](docs/game-rules.md) | ゲームルール |

## 開発フロー

1. **Phase 0**: ゲームルール確定 → ゲームエンジン実装（純粋関数）
2. **Phase 1**: Durable Object基盤 + WebSocket
3. **Phase 2**: 基本UI
4. **Phase 3**: 再接続・ホスト移譲
5. **Phase 4**: 10人対応UI
6. **Phase 5**: 公開準備

詳細は `docs/game-rules.md` および設計書を参照。

---

**注意**: 現在は身内向け招待制運用を前提としています。
一般公開する場合はセキュリティ・権利面の追加確認が必要です。