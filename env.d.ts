/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

interface ImportMetaEnv {
  /**
   * Absolute Worker origin when not same-origin (optional).
   * Dev default: use Vite proxy to wrangler (`/api/...`).
   * Example: `https://wild-count.example.workers.dev`
   */
  readonly VITE_WORKER_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
