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
| **HOLD-4** | done | **wrangler ローカルハング（IPv4/IPv6）** | Node が `[::1]`、workerd が `127.0.0.1` で不一致 → CPU 100%。`worker:dev` に `NODE_OPTIONS=--dns-result-order=ipv4first`（#12910） |
| **HOLD-5** | hold | **本番デプロイ（Worker + Pages）** | 公開 URL: `https://wildcount.rysh.dev`。手順: `docs/deploy.md`。ユーザー確認なしでは行わない |

---

## エクストラルール（Phase E）

正本: `docs/extra-rules.md` · 概要リンク: `docs/game-rules.md`  
デフォルト OFF。各スライスはトグル OFF 時の回帰を壊さないこと。

| ID | 状態 | 内容 | 受け入れの目安 | メモ |
|----|------|------|----------------|------|
| **ER-0** | done | 設定スケルトン `ExtraRulesConfig` | OFF で既存テスト全通 | `change` フラグ含む |
| **ER-1** | done | **1/2 カード**（計算・山札） | trunc 端数・×2 併用。`specials.half` | エクストラトグル対象外 |
| **ER-2** | done | **セイム** | 連続不可・初手不可 | 個人枠不要。E1 と並列可 |
| **ER-3** | done | **リバース** + 個人アクション枠 | 方向反転・次 R で枠復活 | 付随+チェンジで枠共有 |
| **ER-3b** | done | **チェンジ** | 7→9→Change で 8/10+ のみ。次手番は使用者の次 | ER-3 必須。強制再宣言モード |
| **ER-4** | done | **ショット** | 次手番指名（自分以外） | ER-3 後。E5 と並列可 |
| **ER-5** | done | **ダブル**（ライフ −2） | 次がチャレンジ時のみ −2。Change で消滅 | ER-3 後 |
| **ER-6** | done | **ドロー1** | 複数手札・R 全体 1 回・自分以外 | hands を Card[] 化 |
| **ER-7** | done | ロビー UI・WS 同期・ヘルプ | host トグルが全員に見える | 強制再宣言 UI / 付随セレクト含む |

**推奨順**: ER-0 → ER-1 ∥ ER-2 → ER-3 → **ER-3b** → ER-4 ∥ ER-5 → ER-6 → ER-7

---

## 改善・バグ・UX（idea / todo）

| ID | 状態 | 内容 | メモ |
|----|------|------|------|
| UX-1 | done | エラーコード別の丁寧な日本語メッセージ | P1-6 で `errorMessages.ts` に実装 |
| **UX-5** | **done** | **ヘルプ機能**（差し込み） | モーダル: 遊び方 / 特殊札 / 合計計算 / 操作。Home・Lobby・Game（ヘッダ `?`）から。本文 `src/data/helpContent.ts` |
| UX-2 | idea | 切断中ホストの「移譲まであと N 秒」表示 | P1-5 実装時に検討 |
| **UX-3** | **done** | ゲーム中の途中抜け（60s 後自動脱落）+ 意図的 leave 即脱落 | 結果全員 dismiss まで次ラウンド開始しない |
| UX-4 | idea | 観戦モード（開始後 join） | MVP は開始後 join 拒否 |
| **UX-6** | **done** | ルーム内チャット | WS `chat` / `chat_history`。履歴 50・120 字・800ms クールダウン。ロビー＋ゲーム UI |
| **UX-7** | **done** | スタンプリアクション | 固定 10 種。`reaction` + chat 履歴 + 浮遊オーバーレイ。メンション・未読なし |
| UX-8 | done | 表示名入力（ホーム共通・ロビー変更） | 作成/参加で共有フィールド。ロビーで「名前を反映」 |
| **UX-11** | **done** | **アバター選択・変更 + インデックス検証** | カタログ 10 種。Home/Lobby ピッカー。`join.avatarIndex` 厳密検証。localStorage 永続 |
| UX-9 | done | ロビー意図的退出で席削除 | `leave` メッセージ。切断ゴーストではなく一覧から消える |
| **UX-10** | **done** | **ロビー山札カスタマイズ** | host `set_deck` + `PlayerView.deck`。`DeckSettingsPanel`。10〜120 枚。`start` で適用 |
| TEST-1 | idea | Playwright E2E（2 ブラウザ） | design-overview §7。手動 2 タブが当面の受け入れ |
| OPS-1 | idea | Worker ヘルス表示（ホームに「Worker 未接続」） | create タイムアウト文言は済 |

---

## Phase 0 / ローカル・デザイン（参照）

マルチプレイ以外で、ドキュメント上まだ開いているもの。詳細は各 plan を正とする。

| 出典 | 内容 | 状態メモ |
|------|------|----------|
| design-polish / ui-mock | 細部 UX（ボット思考時間スライダー等） | 任意 |
| design-polish | ドーパミン系マイクロ演出（bid / 結果 / 手番） | **done** 第1波 |
| design-polish | ドーパミン演出 第2波（ROUND / 特殊札 / ライフ / ロビー等） | **done**（CSS only。効果音・触覚は未） |
| prod-copy | 本番はオンラインのみ・mock/ローカル/開発文言を DEV 限定 | **done**（`src/config/runtime.ts`） |
| design-overview | 公式素材は使わない・オリジナル維持 | 方針固定 |
| ローカルデモ | DEV では並存・壊さない / **本番 UI からは除外** | `allowLocalPlay`（`runtime.ts`） |

---

## 直近のおすすめ着手順

1. **HOLD-5** — `https://wildcount.rysh.dev`（Pages + Worker `/api/*`）。手順は `docs/deploy.md`。実行はユーザー確認後  
2. エクストラ磨き: 複数札 UI のタイル表示、ライフ −2 の結果文言、ローカルデモでの extras トグル  
3. UX-2（ホスト移譲カウントダウン）・TEST-1 / OPS-1 は任意

---

## 更新ルール

1. セッションで「やらないと決めた」「後回しにした」項目は **ここへ追記**（work-log の「明示的にやっていないこと」と二重でもよい。一覧の正本は本ファイル）  
2. 完了したら状態を `done` にし、数セッション後に表から落としてよい  
3. Phase 1 スライスの ID（P1-x）は `phase1-multiplayer.md` §10 と揃える  
4. エクストラルールの ID（ER-x）は `docs/extra-rules.md` §4 と揃える  

最終更新: 2026-07-13（ドーパミン演出 第2波）
