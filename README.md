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

# Backend（Wrangler）
npm run worker:dev
```

## 主なスクリプト

```bash
npm run dev          # Vite開発サーバー
npm run build        # 本番ビルド
npm run worker:dev   # Wrangler開発サーバー
npm run deploy       # Cloudflareへのデプロイ
npm run lint         # ESLint
npm run format       # Prettier
```

## プロジェクト構造

```
wild-count/
├── .devcontainer/          # VS Code Dev Container設定
├── docs/                   # ゲームルール仕様書など
├── public/                 # 静的ファイル（icons, images）
├── src/                    # フロントエンド
│   ├── domain/game/        # 純粋ゲームエンジン（Phase 0）
│   ├── components/
│   ├── views/
│   ├── stores/
│   └── composables/
├── worker/                 # Cloudflare Workers
│   ├── GameRoom.ts
│   └── ...
├── tests/                  # テスト
├── vite.config.ts
├── wrangler.jsonc
└── README.md
```

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