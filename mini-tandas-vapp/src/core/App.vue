<script setup lang="ts">
import {
  ChevronLeft,
  LayoutGrid,
  Layers,
  Package,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, useTemplateRef } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'

import ConfirmDialogHost from '@shared/ui/ConfirmDialogHost.vue'
import ToastHost from '@shared/ui/ToastHost.vue'

import { isDetailPath, parentPath } from './router/navigation'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

const navItems: readonly NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid },
  { to: '/tandas', label: 'Tandas', icon: Layers },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const route = useRoute()
const router = useRouter()

/** Back only on detail pages; the bottom nav handles top-level sections. */
const showBack = computed(() => isDetailPath(route.path))

function goBack(): void {
  // Deep link (no in-app history): go to the parent list instead of leaving the app.
  const state = window.history.state as { back?: string | null } | null
  if (state?.back) router.back()
  else void router.push(parentPath(route.path))
}

const main = useTemplateRef<HTMLElement>('main')

/** After a page change, move focus to the new view's heading so it is announced. */
function focusView(): void {
  const container = main.value
  if (!container) return
  const heading = container.querySelector<HTMLElement>('h1')
  const target = heading ?? container
  if (heading) heading.tabIndex = -1
  target.focus()
}

const removeAfterEach = router.afterEach((to, from, failure) => {
  // Skip the initial load and query-only changes (e.g. switching tabs).
  if (failure || from.matched.length === 0 || to.path === from.path) return
  void nextTick(focusView)
})
onBeforeUnmount(removeAfterEach)
</script>

<template>
  <a href="#main" class="skip-link">Skip to content</a>

  <header class="app-header">
    <div class="app-header-inner">
      <button
        v-if="showBack"
        type="button"
        class="back-btn mobile-only"
        aria-label="Go back"
        @click="goBack"
      >
        <ChevronLeft :size="20" />
      </button>
      <RouterLink to="/" class="brand">
        <img src="/logo.svg" alt="" class="brand-logo" width="24" height="24" />
        Mini Tanda
      </RouterLink>
      <nav class="nav desktop-only">
        <RouterLink v-for="item in navItems" :key="item.to" :to="item.to" class="nav-link">
          {{ item.label }}
        </RouterLink>
      </nav>
    </div>
  </header>

  <main id="main" ref="main" class="app-main" tabindex="-1">
    <RouterView />
  </main>

  <nav class="bottom-nav mobile-only" aria-label="Main navigation">
    <RouterLink v-for="item in navItems" :key="item.to" :to="item.to" class="bottom-nav-link">
      <component :is="item.icon" :size="22" :stroke-width="1.8" aria-hidden="true" />
      <span class="bottom-nav-label">{{ item.label }}</span>
    </RouterLink>
  </nav>

  <ConfirmDialogHost />
  <ToastHost />
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
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 800;
  font-size: 1.1rem;
  color: var(--color-primary);
}

.brand-logo {
  display: block;
  border-radius: var(--radius-small);
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  margin-left: calc(-1 * var(--space-2));
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
  outline: none;
  max-width: 960px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-4);
}

.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  min-height: var(--nav-bottom-height);
  padding-bottom: var(--safe-bottom);
  display: flex;
  align-items: stretch;
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  z-index: 40;
}

.bottom-nav-link {
  flex: 1;
  min-width: 0;
  min-height: var(--nav-bottom-height);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: var(--space-1) 2px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-ink-soft);
  container-type: inline-size;
}

.bottom-nav-label {
  max-width: 100%;
  text-align: center;
  overflow-wrap: anywhere;
}

/* Large text: when a label no longer fits its slot, keep it for screen
   readers only instead of clipping it ("Set…"); the icon stays. */
@container (max-width: 5em) {
  .bottom-nav-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
}

.bottom-nav-link.router-link-active {
  color: var(--color-primary);
}

@media (max-width: 720px) {
  .app-header-inner {
    gap: var(--space-3);
  }

  .app-main {
    padding-bottom: calc(var(--nav-bottom-height) + var(--safe-bottom) + var(--space-4));
  }

  /* Pages with a FAB: leave room so it never covers the last row. */
  .app-main:has(.fab) {
    padding-bottom: calc(
      var(--nav-bottom-height) + var(--safe-bottom) + var(--fab-size) + var(--space-6)
    );
  }
}
</style>
