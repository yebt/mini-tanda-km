import '@shared/assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from '@core/App.vue'
import { renderBootError } from '@core/bootError'
import router from '@core/router'
import { initDatabase } from '@shared/db/database'
import { loadSettings } from '@shared/db/settings'
import { initTheme } from '@shared/ui/useTheme'

async function bootstrap() {
  initTheme()
  await initDatabase()
  loadSettings()

  const app = createApp(App)

  app.use(createPinia())
  app.use(router)

  app.mount('#app')
}

bootstrap().catch((error: unknown) => {
  console.error(error)
  const container = document.getElementById('app')
  if (container) renderBootError(container, error)
})
