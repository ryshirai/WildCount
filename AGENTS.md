# Agent instructions (Wild Count)

Follow these instructions when working in this repository.

## Work log (required)

**Every session that changes the project** must append an entry to `docs/work-log.md` before finishing.

### When to write

- After implementing features, UI, fixes, refactors, docs, or config changes
- After investigations that produced a decision or change of direction
- Even for small sessions: a short entry is better than none
- Skip only pure Q&A with no repo changes (no file edits, no installs)

### How to write

1. Open `docs/work-log.md`
2. **Append** a new section under the existing log (do not overwrite past entries)
3. Use this shape:

```markdown
## YYYY-MM-DD — short title

### 背景・目的
- ...

### 実施内容
1. ...
2. ...

### 主なパス変更
| パス | 内容 |
|------|------|
| ... | ... |

### 明示的にやっていないこと
- ...

### 確認結果
- ...

### 次に考えられる作業
1. ...
```

- Date: use the actual work date
- Keep it factual and skimmable; link to specs (`docs/*.md`) instead of repeating them
- List “not done” so the next session does not assume completeness
- If the session is tiny, collapse sections into a few bullets under the same heading

### Related

- **Remaining tasks (backlog)**: `docs/backlog.md` — open / hold items (not the work log)
- UI mock notes: `docs/ui-mock.md`
- Design / rules: `docs/design-overview.md`, `docs/game-rules.md`, `docs/card-design.md`
- Phase 1 multiplayer: `docs/phase1-multiplayer.md`
