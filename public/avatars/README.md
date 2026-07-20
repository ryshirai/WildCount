# Avatars (`public/avatars/`)

Phase **B0–B1** layout for player portrait assets. Spec: [`docs/design-polish-plan.md`](../../docs/design-polish-plan.md) (Phase B0).

## Rules

| Item | Value |
|------|--------|
| Path | `public/avatars/{assetId}.webp` |
| URL | `/avatars/{assetId}.webp` |
| Aspect | 1:1 |
| Ship size | 256×256 WebP |
| Master | 512×512 (generate) |
| Clip | Circular in CSS (`PlayerAvatar`) |
| Fallback | Emoji from catalog |

Code catalog: `src/localGame/avatarCatalog.ts`.

## Full set (15)

| File | Character | Status |
|------|-----------|--------|
| `self.webp` | あなた（クマ） | ✅ |
| `owl.webp` | フクロウ | ✅ |
| `kit.webp` | キタロー（子ギツネ） | ✅ |
| `raccoon.webp` | アライグマ | ✅ |
| `wolf.webp` | オオカミ | ✅ |
| `fox.webp` | キツネ（成体） | ✅ |
| `deer.webp` | シカ | ✅ |
| `falcon.webp` | ハヤブサ | ✅ |
| `squirrel.webp` | リス | ✅ |
| `coyote.webp` | コヨーテ | ✅（ブランド寄り・任意） |
| `koi.webp` | コイ（煽り） | ✅ |
| `crow.webp` | カラス（煽り） | ✅ |
| `peacock.webp` | クジャク（煽り） | ✅ |
| `hyena.webp` | ハイエナ（煽り） | ✅ |
| `cat.webp` | ネコ（煽り） | ✅ |
