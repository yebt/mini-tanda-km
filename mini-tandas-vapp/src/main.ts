import '@shared/assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from '@core/App.vue'
import router from '@core/router'
import { initDatabase } from '@shared/db/database'
import { loadSettings } from '@shared/db/settings'

async function bootstrap() {
  await initDatabase()
  loadSettings()

  const app = createApp(App)

  app.use(createPinia())
  app.use(router)

  app.mount('#app')
}

void bootstrap()
