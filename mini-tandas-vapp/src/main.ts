import '@shared/assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from '@core/App.vue'
import { renderBootError } from '@core/bootError'
import router from '@core/router'
import { prefetchAllRoutes } from '@core/router/prefetch'
import { initDatabase } from '@shared/db/database'
import { loadSettings } from '@shared/db/settings'
import { initTheme } from '@shared/ui/useTheme'
import { whenIdle } from '@shared/ui/whenIdle'
import { scheduleThumbnailBackfill } from '@/features/products/lib/thumbnail'

async function bootstrap() {
  initTheme()
  await initDatabase()
  loadSettings()

  const app = createApp(App)

  app.use(createPinia())
  app.use(router)

  app.mount('#app')

  // Photos migrated or restored from older versions get their list thumbnail.
  scheduleThumbnailBackfill()
  // Fetch the other sections' code while idle so the first visit is instant.
  whenIdle(() => void prefetchAllRoutes(router))
}

bootstrap().catch((error: unknown) => {
  console.error(error)
  const container = document.getElementById('app')
  if (container) renderBootError(container, error)
})
