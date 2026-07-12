# Phase 1 — マルチプレイ設計メモ（Worker / DO / WebSocket）

身内招待制のリアルタイム対戦。状態の正本はサーバー（Durable Object）。  
ローカルデモ（bots）は並存し、本ドキュメントの対象外（壊さない）。

関連: `docs/design-overview.md` · `docs/game-rules.md` · `docs/ui-mock.md`  
エンジン正本: `src/domain/game/`（純粋関数。ルール改変はしない）

---

## 1. スコープ

### 含む（MVP）

| 項目 | 内容 |
|------|------|
| ルーム | 作成・コード参加。2〜10 人。ホストが開始 |
| 通信 | HTTP（作成）+ WebSocket（以降）。Hibernation 前提 |
| 状態 | 1 ルーム = 1 DO。game は domain `GameState` |
| 進行 | ロビー → 配札 → 宣言 / コヨーテ → 結果 → 次 R / 終了 |
| 視界 | 自分の手札はサーバから送らない（結果公開時のみ可） |
| 冪等 | `actionId` + `expectedRevision` |
| 再接続 | `resumeToken` + localStorage + view 再送 |
| ホスト | 切断 60s 猶予 → 最長参加者へ |
| 削除 | 空 / idle で DO 状態クリア（alarm） |

### 含まない

- ユーザー登録 / ランキング / 公開マッチング
- チャット本体
- D1 / 外部 DB
- 公式・他社 IP 素材
- domain ルール改変（バグ修正以外）

---

## 2. アーキテクチャ

```
Browser (Vue)
  ├── stores/localGame.ts     # 既存ローカルデモ（維持・オンライン時は使わない）
  └── stores/onlineGame.ts    # WS クライアント状態（P1-2 以降）
        │  WebSocket / fetch
        ▼
Worker (worker/index.ts)
  ├── POST /api/rooms              → roomCode 発行 + DO 初期化
  ├── GET  /api/rooms/:code        → 存在確認（任意）
  └── GET  /api/rooms/:code/ws     → Upgrade → GameRoom DO
        │
        ▼
GameRoom (Durable Object)
  ├── Hibernation WebSockets
  ├── RoomState（meta + game + tokens）
  └── domain: createInitialState / startGame / applyAction / getLegalMoves
```

- DO id = `env.GAME_ROOM.idFromName(roomCode)`（roomCode を名前空間に使用）
- フロントは Vite dev 時 `server.proxy` で Worker（既定 `http://127.0.0.1:8787`）へ。本番は同一オリジン or `VITE_WORKER_URL`

---

## 3. ルームコード（決定）

| 項目 | 決定 |
|------|------|
| 長さ | **6 文字**（口頭共有・モバイル入力のしやすさ優先。design-overview の「8」から意図的に短縮） |
| 文字集合 | `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`（`0 O 1 I l` 除外） |
| 生成 | Worker がランダム生成。衝突時は再生成（最大 N 回） |
| 正規化 | 入力は trim + 大文字化。上記以外は拒否 |
| DO マッピング | `idFromName(roomCode)`。コード空間が広いため実用上衝突は無視可能だが、作成時に DO へ `init` して「未使用」を確認する |

UI の入力上限は 6〜8 を許容してよいが、**発行は常に 6**。

---

## 4. メッセージ型（固定）

JSON テキストフレーム。未知 `type` は `error`（`UNKNOWN_TYPE`）。

### 4.1 Client → Server

```ts
type ClientMessage =
  | { type: 'join'; displayName: string; resumeToken?: string }
  | { type: 'ready'; ready: boolean }           // 任意（UI 用。開始条件には使わない）
  | { type: 'start' }                           // host only。人数 ≥ 2
  | {
      type: 'action'
      actionId: string                          // クライアント生成 UUID
      expectedRevision: number
      action: ClientGameAction
    }
  | { type: 'resume'; resumeToken: string }     // join の代替導線でも可
  | { type: 'ping' }                            // アプリ層。Hibernation auto-response と併用可

/** domain GameAction のうちプレイヤー操作分（START_GAME は start メッセージ） */
type ClientGameAction =
  | { type: 'PLACE_BID'; value: number }
  | { type: 'CHALLENGE' }
```

### 4.2 Server → Client

```ts
type ServerMessage =
  | {
      type: 'hello'
      playerId: string
      resumeToken: string
      roomCode: string
      isHost: boolean
    }
  | {
      type: 'view'
      revision: number
      view: PlayerView
    }
  | {
      type: 'event'
      level?: 'info' | 'warn'
      message: string
      code?: string
    }
  | {
      type: 'error'
      code: string
      message: string
      actionId?: string
    }
  | { type: 'room_closed'; reason: string }
  | { type: 'pong' }                            // ping 応答（auto と別経路でも可）
```

### 4.3 PlayerView 要件

| フィールド案 | 内容 |
|--------------|------|
| `phase` | ロビー / ゲーム / 結果向けの部屋フェーズ |
| `room` | `roomCode`, `hostId`, `players[]`（id, displayName, seatIndex?, ready, connected, isHost） |
| `game` | domain 由来の公開情報 + **マスク済み hands** |
| `self` | `playerId`, `legalMoves?`, `isMyTurn` |
| `pendingResult?` | チャレンジ直後の結果用（自分の札も公開可） |
| `revision` | 部屋全体の単調増加カウンタ（`view.revision` とメッセージの `revision` は同値） |

**手札マスク規則**

1. 通常プレイ中: 自分の `hand` は送らない / 常に hidden（`?`）。他生存者の `kind`/`value` は domain `Card` をシリアライズしてよい  
2. チャレンジ解決後の結果フェーズのみ: 自分の札も `pendingResult`（または result 専用 payload）で公開してよい  
3. クライアントは `expectedRevision` で楽観制御。不一致は `error`（`REVISION_MISMATCH`）+ 最新 `view` 再送

既存 UI へ寄せる: `toGameView` / `toResultView` が期待する形に近い DTO にする（完全一致は必須ではない。online mapper を挟んでよい）。

---

## 5. ルーム状態（DO 内）

```ts
interface RoomState {
  roomCode: string
  createdAt: number
  lastActivityAt: number
  hostId: string | null
  revision: number
  /** 参加順。seatIndex はゲーム開始時に確定（参加順 or 明示） */
  players: RoomPlayer[]
  /** resumeToken → playerId */
  resumeTokens: Record<string, string>
  /** 切断中ホスト移譲用タイマー管理 */
  disconnectDeadlines: Record<string, number> // playerId → epoch ms
  /** null = ロビー。開始後は domain GameState */
  game: GameState | null
  /** チャレンジ直後、次 R 表示前に UI へ載せるスナップショット */
  pendingResult: PendingResultSnapshot | null
  status: 'open' | 'playing' | 'closed'
}

interface RoomPlayer {
  id: string
  displayName: string
  joinedAt: number
  ready: boolean
  connected: boolean
  /** WS attachment 用。Hibernation では getWebSockets で復元 */
}
```

永続: DO `storage`（SQLite-backed class）。接続そのものは Hibernation が保持。

---

## 6. domain 呼び出し対応表

| タイミング | domain API | 備考 |
|------------|------------|------|
| ルーム作成 | なし | meta のみ |
| join（2 人目以降） | なし（lobby） / 観戦は非対応 MVP | ゲーム中 join は拒否 or 観戦（**MVP: 開始後の新規 join 拒否**） |
| host `start` | `createInitialState` → `applyAction(..., START_GAME)` または `startGame` | 参加者 id 順で seat。rng は DO 内 `seedRandom` or crypto |
| 宣言 / コヨーテ | `applyAction(state, PLACE_BID \| CHALLENGE, rng)` | 事前に `getLegalMoves` / 手番検証 |
| チャレンジ後 | `lastOutcome` + 直前 hands を `pendingResult` 化 | domain は既に次 R へ進んでいる点に注意（ローカルデモと同じ） |
| 合法手表示 | `getLegalMoves(state)` | 手番者の view に載せる |
| ルール計算 | 触らない（engine 内） | 計算順の正本は `game-rules.md`（合計値0化カード即0は未採用） |

**二重実装禁止**: 合計・勝敗・合法手は必ず domain。Worker は I/O・権限・マスク・ライフサイクルのみ。

---

## 7. ライフサイクル

### 7.1 作成

1. `POST /api/rooms` → roomCode 生成  
2. DO `init`（未作成なら meta 保存）  
3. レスポンス `{ roomCode }`  
4. クライアントが WS 接続 → `join`

### 7.2 参加

1. WS `GET /api/rooms/:code/ws`  
2. `join { displayName, resumeToken? }`  
3. 新規: `playerId` / `resumeToken` 発行 → `hello` + 全員へ `view`  
4. 上限 10。満員は `error`（`ROOM_FULL`）

### 7.3 開始

- host のみ。`players.length >= 2`  
- `status = playing`、domain `startGame`  
- 以降 `action` のみで進行

### 7.4 再接続

1. クライアントは `hello.resumeToken` を `localStorage`（キー例: `wc:resume:{roomCode}`）に保存  
2. 再接続時 `join` に `resumeToken` を付ける（または `resume`）  
3. 同一 `playerId` で `connected=true`、最新 `view` を送る  
4. 不明 token → 新規参加扱い（開始後は拒否）

### 7.5 ホスト移譲

1. host の WS 切断 → `disconnectDeadlines[hostId] = now + 60_000`、alarm 設定  
2. 60s 以内に resume → キャンセル  
3. タイムアウト: `joinedAt` が最古の **connected** 参加者へ host 移譲。誰もいなければ空ルーム処理  
4. 非 host 切断は「接続フラグ」のみ（ゲーム中は席を維持。離脱踢出は MVP 外でも、長時間全員切断は idle TTL で削除）

### 7.6 空ルーム / idle TTL

| 条件 | 動作 |
|------|------|
| 接続 0 かつ `status === 'open'` で **10 分** | 状態削除・`room_closed` 不要（誰もいない） |
| 接続 0 かつ playing で **30 分** | 同上（再接続猶予を超えた放棄） |
| `status === 'closed'` | 即座または短 TTL で storage 削除 |

実装: DO `alarm()` で `lastActivityAt` / 接続数を見て `storage.deleteAll()`。

---

## 8. 操作の冪等・revision

1. 部屋 `revision` は **成功した状態変更のたび +1**（join/leave/start/action/host 移譲など）  
2. `action` は `expectedRevision === room.revision` のときのみ適用  
3. 同一 `actionId` の再送: 既に適用済みなら **成功扱いで現在 view を返す**（副作用なし）  
4. mismatch: `error` + 最新 `view`  
5. domain の `GameState.revision` は参考値。**権威は RoomState.revision**

---

## 9. フロント接続方針

| 導線 | 挙動 |
|------|------|
| トップ「ルームを作成 / 参加」 | オンライン本線（P1-2 で `onlineGame` 接続） |
| トップ「ローカルデモを開始」 | 現状どおり `localGame` + bots |
| オンライン中 | ボット無効。`localGame` を触らない |
| 画面 | `/lobby` `/game` `/result` を流用。view mapper で差分吸収 |

環境変数:

- `VITE_WORKER_URL` — 未設定時は相対パス（`/api/...`）。dev は Vite proxy → wrangler  
- Worker 既定ポート: **8787**

---

## 10. 実装スライス

進捗・hold・改善案の **一覧正本** は `docs/backlog.md`。

| ID | 状態 | 内容 | 受け入れの核 |
|----|------|------|----------------|
| **P1-0** | done | 本ドキュメント | 型・TTL・domain 対応が書かれている |
| **P1-1** | done | Worker 足場・DO・WS accept・proxy | `wrangler dev` 起動、WS 接続可 |
| **P1-2** | done | 作成・参加・ロビー同期 | 2 タブでメンバー一覧更新、host 開始ボタン |
| **P1-3** | done | start / bid / challenge / result | 同期進行 + 手札マスク |
| **P1-4** | done | resumeToken 再接続 | リロードで席復帰 |
| P1-5 | done | ホスト移譲・空ルーム削除 | 60s / idle alarm |
| **P1-6** | **done** | エラー UI・テスト・docs 更新 | test/build 緑・code→日本語 |

---

## 11. エラーコード（初期セット）

| code | 意味 |
|------|------|
| `UNKNOWN_TYPE` | 未知メッセージ |
| `UNAUTHORIZED` | host 限定操作など |
| `ROOM_FULL` | 10 人超 |
| `ROOM_NOT_FOUND` | 未初期化コード |
| `GAME_ALREADY_STARTED` | 開始後の新規 join |
| `NOT_ENOUGH_PLAYERS` | 開始時 < 2 |
| `REVISION_MISMATCH` | expectedRevision 不一致 |
| `ILLEGAL_ACTION` | domain / 手番違反 |
| `INVALID_TOKEN` | resume 失敗（開始後） |
| `BAD_REQUEST` | バリデーション |

**クライアント表示（P1-6）**

- ワイヤ上の `message` は英語の技術文のままでよい  
- UI 文言は `src/online/errorMessages.ts` が `code` から日本語へ変換する  
- `REVISION_MISMATCH` / `ILLEGAL_ACTION` は soft（接続は維持・トースト／ログのみ。mismatch 時はサーバが最新 `view` を再送）  
- HTTP 作成失敗も `{ error, message }` を同じマッパで表示

---

## 12. テスト方針（Phase 1）

- domain 既存テストは回帰のまま  
- Worker: メッセージ検証・view マスク・revision 拒否を単体（純粋関数として抽出したもの）  
- 手動: 2 ブラウザで受け入れ条件 1–5  
- E2E Playwright は後続（design-overview §7）

---

## 13. 非交渉の再掲

1. `src/domain/game/` に DOM / WS / Vue / Pinia / localStorage を入れない  
2. ロジック二重実装禁止  
3. 計算順正本 = `docs/game-rules.md`  
4. ローカルデモを壊さない  
5. 変更セッションは `docs/work-log.md` 追記  
6. 秘密情報・本番デプロイはユーザー確認なしでしない  

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-07-12 | P1-0 初版。ルームコード 6 文字に決定。メッセージ型・TTL・domain 対応表を固定 |
| 2026-07-12 | P1-1 Worker 足場（init / WS accept / health） |
| 2026-07-12 | **P1-2 完了** — join/ready/start・view broadcast・onlineGame・Home/Lobby 本線接続。action は P1-3 |
| 2026-07-12 | **P1-3 完了** — action（bid/challenge）・マスク済み game seats・pendingResult・Game/Result UI 接続 |
| 2026-07-12 | **P1-4 完了** — resumeToken 再接続（localStorage lastRoom、ensureSession、自動再接続、切断バナー、ホーム復帰） |
| 2026-07-12 | スライス状態列を追加。残タスク正本を `docs/backlog.md` に分離 |
| 2026-07-12 | **P1-5 完了** — host 切断 60s 移譲（alarm）・idle TTL で storage 削除（open 10m / playing 30m） |
| 2026-07-12 | **P1-6 完了** — error code→日本語 UI（`errorMessages.ts`）・テスト・docs 締め |
