import { createRouter, createWebHistory } from 'vue-router'
import { allowUiMock } from '@/config/runtime'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
      meta: { title: 'Wild Count' },
    },
    {
      path: '/lobby',
      name: 'lobby',
      component: () => import('@/views/LobbyView.vue'),
      meta: { title: 'Wild Count — 待機ロビー' },
    },
    {
      path: '/game',
      name: 'game',
      component: () => import('@/views/GameView.vue'),
      meta: { title: 'Wild Count — ゲーム画面' },
    },
    {
      path: '/result',
      name: 'result',
      component: () => import('@/views/ResultView.vue'),
      meta: { title: 'Wild Count — 結果' },
    },
    // Back-compat for earlier mock entry (DEV only; prod → home)
    {
      path: '/game-mock',
      redirect: () =>
        allowUiMock ? { name: 'game', query: { mock: '1' } } : { name: 'home' },
    },
  ],
})

/** Strip ?mock=1 in production so deep links don't hit mock UI. */
router.beforeEach((to) => {
  if (allowUiMock) return true
  if (to.query.mock == null) return true
  const query = { ...to.query }
  delete query.mock
  return { path: to.path, query, hash: to.hash, replace: true }
})

router.afterEach((to) => {
  if (typeof to.meta.title === 'string') {
    document.title = to.meta.title
  }
})

export default router
