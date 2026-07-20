import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { setupPwa } from './pwa'
import './styles/main.css'

function showBootError(err: unknown): void {
  const el = document.getElementById('app')
  if (!el) return
  const msg = err instanceof Error ? err.message : String(err)
  el.innerHTML = `
    <div style="box-sizing:border-box;min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.75rem;padding:2rem 1.25rem;color:#e8dcc4;font-family:system-ui,sans-serif;text-align:center;background:#060a12">
      <p style="margin:0;font-size:1.1rem;font-weight:700;color:#e8d5a3">表示に失敗しました</p>
      <p style="margin:0;font-size:0.8rem;color:#c4b49a;max-width:22rem;word-break:break-word">${msg.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c] ?? c)}</p>
      <button type="button" onclick="location.reload()" style="margin-top:0.5rem;padding:0.6rem 1.1rem;border-radius:0.75rem;border:1px solid rgba(201,168,76,0.4);background:#111b2e;color:#e8d5a3;font-size:0.9rem">
        再読み込み
      </button>
    </div>
  `
}

try {
  setupPwa()

  const app = createApp(App)
  app.config.errorHandler = (err) => {
    console.error('[Wild Count]', err)
  }
  app.use(createPinia())
  app.use(router)
  app.mount('#app')
} catch (err) {
  console.error('[Wild Count] boot failed', err)
  showBootError(err)
}
