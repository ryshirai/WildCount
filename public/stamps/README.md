# Character stamps (`public/stamps/`)

Per-character reaction art for chat stamps (UX-7 + character skin).  
Avatars: `public/avatars/` · Catalog code: `src/online/stamps.ts` · `src/localGame/avatarCatalog.ts`.

## Layout

```
public/stamps/{avatarId}/{stampId}.webp
```

| Item | Value |
|------|--------|
| Aspect | 1:1 circular portrait (matches avatars) |
| Ship size | **256×256** WebP |
| Master | 1024 generate → downscale |
| Fallback | Stamp emoji from `STAMP_CATALOG` |

## Animals (10)

Same ids as `AVATAR_ASSETS`: `self`, `owl`, `kit`, `raccoon`, `wolf`, `fox`, `deer`, `falcon`, `squirrel`, `coyote`.

## Emotions (9)

Character art exists for these stamp ids only:

| stampId | Label |
|---------|--------|
| `thumbs` | いいね |
| `laugh` | 笑う |
| `fire` | 燃える |
| `shock` | びっくり |
| `clap` | 拍手 |
| `cry` | 悲しい |
| `think` | 考える |
| `party` | やった |
| `skull` | 詰んだ |

Brand stamp `coyote` (🐺) stays **emoji-only** for every seat.

## Total

**10 animals × 9 emotions = 90** WebP files.

## Runtime

- Wire still sends semantic `stampId` only (server allowlist unchanged).
- Clients resolve display with `characterStampSrc(avatarId, stampId)`.
- Picker previews use the **sender’s** animal; float / chat history use the **message author’s** animal.
