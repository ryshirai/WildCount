# 残タスク一覧（Backlog）

作業ログ（`docs/work-log.md`）とは別に、**いま未完了の積み残し**だけを一覧する。  
着手・完了したらこのファイルを更新する（完了は打ち消し or 完了セクションへ移動）。

関連: `docs/phase1-multiplayer.md` · `docs/design-overview.md` · `docs/work-log.md`

**凡例**

| 状態 | 意味 |
|------|------|
| `todo` | やると決まっている / 次に取る候補 |
| `hold` | 方針は出たが意図的に後回し |
| `idea` | 要望・改善案。未採択でもよい |
| `done` | 完了（履歴用。溜まったら間引いてよい） |

---

## Phase 1 — マルチプレイ（本線）

| ID | 状態 | 内容 | 受け入れの目安 | メモ |
|----|------|------|----------------|------|
| P1-0 | done | 設計メモ | `phase1-multiplayer.md` | |
| P1-1 | done | Worker / DO / WS 足場 | `wrangler dev` + WS | |
| P1-2 | done | 作成・参加・ロビー同期 | 2 タブで一覧・host 開始 | |
| P1-3 | done | bid / challenge / マスク / 結果 | 同期進行 + 手札マスク | |
| P1-4 | done | resumeToken 再接続 | リロードで席復帰 | 切断バナー・自動再接続含む |
| P1-5 | done | ホスト移譲・空ルーム削除 | host 切断 60s 移譲 / idle alarm で storage 削除 | 仕様: phase1 §7.5–7.6 |
| P1-6 | done | エラー UI・テスト・docs 仕上げ | test/build 緑、主要 error code が分かる UI | `src/online/errorMessages.ts` |

---

## 意図的に後回し（hold）

動確・設計で出たが、今は実装しないもの。

| ID | 状態 | 内容 | 背景 |
|----|------|------|------|
| **HOLD-1** | done | **開始同期（全員 ready 必須）** | host start は全員 ready。`PLAYERS_NOT_READY` / `canStart` 連動 |
| **HOLD-2** | done | **結果のサーバ側全員 ACK** | `dismiss_result` + `resultAcks`。接続中全員まで `pendingResult` 保持。次 bid では消さない |
| **HOLD-3** | done | **オンライン再戦（もう一度遊ぶ）** | `rematch` → 同席のままロビー。ready をリセットして再スタート |
| **HOLD-4** | done | **wrangler 長時間稼働ハング** | ローカル workerd 既知。8s タイムアウト + README 復旧手順。本番未再現のため深掘り打ち切り |
| **HOLD-5** | hold | **本番 `wrangler deploy`** | ユーザー確認なしでは行わない（phase1 非交渉） |

---

## 改善・バグ・UX（idea / todo）

| ID | 状態 | 内容 | メモ |
|----|------|------|------|
| UX-1 | done | エラーコード別の丁寧な日本語メッセージ | P1-6 で `errorMessages.ts` に実装 |
| **UX-5** | **done** | **ヘルプ機能**（差し込み） | モーダル: 遊び方 / 特殊札 / 合計計算 / 操作。Home・Lobby・Game（ヘッダ `?`）から。本文 `src/data/helpContent.ts` |
| UX-2 | idea | 切断中ホストの「移譲まであと N 秒」表示 | P1-5 実装時に検討 |
| UX-3 | idea | ゲーム中の退出・キック（長時間切断） | MVP 外だった離脱踢出 |
| UX-4 | idea | 観戦モード（開始後 join） | MVP は開始後 join 拒否 |
| UX-6 | idea | ルーム内チャット | **未実装**。UI シェル（タブ・アイコン）のみ。「準備中」トースト。design-overview §8 / phase1 で MVP 外 |
| TEST-1 | idea | Playwright E2E（2 ブラウザ） | design-overview §7。手動 2 タブが当面の受け入れ |
| OPS-1 | idea | Worker ヘルス表示（ホームに「Worker 未接続」） | create タイムアウト文言は済 |

---

## Phase 0 / ローカル・デザイン（参照）

マルチプレイ以外で、ドキュメント上まだ開いているもの。詳細は各 plan を正とする。

| 出典 | 内容 | 状態メモ |
|------|------|----------|
| design-polish / ui-mock | 細部 UX（ボット思考時間スライダー等） | 任意 |
| design-polish | ドーパミン系マイクロ演出（bid / 結果 / 手番） | **done**（CSS・効果音は未） |
| prod-copy | 本番はオンラインのみ・mock/ローカル/開発文言を DEV 限定 | **done**（`src/config/runtime.ts`） |
| design-overview | 公式素材は使わない・オリジナル維持 | 方針固定 |
| ローカルデモ | DEV では並存・壊さない / **本番 UI からは除外** | `allowLocalPlay`（`runtime.ts`） |

---

## 直近のおすすめ着手順

1. **HOLD-5**（本番 deploy）はユーザー確認後  
2. UX-2（ホスト移譲カウントダウン）・TEST-1 / OPS-1 は任意  
3. **UX-6 チャット** は未着手。MVP 外のまま（シェルのみ）

---

## 更新ルール

1. セッションで「やらないと決めた」「後回しにした」項目は **ここへ追記**（work-log の「明示的にやっていないこと」と二重でもよい。一覧の正本は本ファイル）  
2. 完了したら状態を `done` にし、数セッション後に表から落としてよい  
3. Phase 1 スライスの ID（P1-x）は `phase1-multiplayer.md` §10 と揃える  

最終更新: 2026-07-12（UX-5 ヘルプ done）
