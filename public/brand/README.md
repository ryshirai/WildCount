# Brand assets (`public/brand/`)

Phase **B2** marks for Wild Count. Spec: [`docs/design-polish-plan.md`](../../docs/design-polish-plan.md) (Phase B2).

| File | Use |
|------|-----|
| `logo-mark.webp` | Header / `AppLogo` circular mark (256×256) |
| `logo-mark.png` | Same mark, PNG fallback |

Related:

| Path | Use |
|------|-----|
| `public/favicon.svg` | Browser tab (SVG, primary) |
| `public/favicon-32.png` | PNG favicon fallback |
| `public/icons/app-192.png` | PWA icon 192 |
| `public/icons/app-512.png` | PWA icon 512 |
| `public/icons/apple-touch-icon.png` | iOS home screen |

PWA manifest is wired in Phase **B7** (`vite.config.ts` → `VitePWA`).
