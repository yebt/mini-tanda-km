import { createRouter, createWebHistory } from 'vue-router'
import { routes, handleHotUpdate } from 'vue-router/auto-routes'

import { pageTitle } from '@shared/ui/usePageTitle'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

// Section title on every navigation; detail views refine it with usePageTitle.
router.afterEach((to) => {
  document.title = pageTitle(to.path)
})

export default router

if (import.meta.hot) {
  handleHotUpdate(router)
}
