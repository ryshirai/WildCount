import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { setupPwa } from './pwa'
import './styles/main.css'

setupPwa()

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
