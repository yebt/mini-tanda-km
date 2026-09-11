<script setup lang="ts">
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'

import ConfirmDialogHost from '@shared/ui/ConfirmDialogHost.vue'

interface NavItem {
  to: string
  label: string
  icon: string
}

const ICONS = {
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  layers: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5',
  box: 'M3 8l9-5 9 5v8l-9 5-9-5V8zM3 8l9 5m0 0l9-5m-9 5v8',
  users:
    'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 19v-1a4 4 0 0 0-3-3.85M15.5 3.15a3.5 3.5 0 0 1 0 6.7',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.06-.4.1-.8.1-1.2z',
} as const

const navItems: readonly NavItem[] = [
  { to: '/', label: 'Dashboard', icon: ICONS.grid },
  { to: '/tandas', label: 'Tandas', icon: ICONS.layers },
  { to: '/products', label: 'Products', icon: ICONS.box },
  { to: '/clients', label: 'Clients', icon: ICONS.users },
  { to: '/settings', label: 'Settings', icon: ICONS.gear },
]

const route = useRoute()
const router = useRouter()

function goBack(): void {
  router.back()
}
</script>

<template>
  <header class="app-header">
    <div class="app-header-inner">
      <button
        v-if="route.path !== '/'"
        type="button"
        class="back-btn mobile-only"
        aria-label="Go back"
        @click="goBack"
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <RouterLink to="/" class="brand">Mini Tanda</RouterLink>
      <nav class="nav desktop-only">
        <RouterLink v-for="item in navItems" :key="item.to" :to="item.to" class="nav-link">
          {{ item.label }}
        </RouterLink>
      </nav>
    </div>
  </header>

  <main class="app-main">
    <RouterView />
  </main>

  <nav class="bottom-nav mobile-only" aria-label="Main navigation">
    <RouterLink v-for="item in navItems" :key="item.to" :to="item.to" class="bottom-nav-link">
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path :d="item.icon" />
      </svg>
      <span>{{ item.label }}</span>
    </RouterLink>
  </nav>

  <ConfirmDialogHost />
</template>

<style scoped>
.app-header {
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.app-header-inner {
  max-width: 960px;
  margin: 0 auto;
  padding: var(--space-3) var(--space-4);
  display: flex;
  align-items: center;
  gap: var(--space-6);
}

.brand {
  font-weight: 800;
  font-size: 1.1rem;
  color: var(--color-primary);
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-1);
  border: none;
  background: transparent;
  color: var(--color-ink-soft);
  cursor: pointer;
}

.back-btn:hover {
  color: var(--color-primary);
}

.nav {
  display: flex;
  gap: var(--space-4);
}

.nav-link {
  color: var(--color-ink-soft);
  font-weight: 600;
  font-size: 0.9rem;
}

.nav-link.router-link-active {
  color: var(--color-primary);
}

.app-main {
  max-width: 960px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-4);
}

.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: var(--nav-bottom-height);
  display: flex;
  align-items: stretch;
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  z-index: 40;
}

.bottom-nav-link {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--color-ink-soft);
}

.bottom-nav-link.router-link-active {
  color: var(--color-primary);
}

@media (max-width: 720px) {
  .app-header-inner {
    gap: var(--space-3);
  }

  .app-main {
    padding-bottom: calc(var(--nav-bottom-height) + var(--space-4));
  }
}
</style>
