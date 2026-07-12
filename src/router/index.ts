import { createRouter, createWebHistory } from 'vue-router'

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
    // Back-compat for earlier mock entry
    {
      path: '/game-mock',
      redirect: { name: 'game' },
    },
  ],
})

router.afterEach((to) => {
  if (typeof to.meta.title === 'string') {
    document.title = to.meta.title
  }
})

export default router
