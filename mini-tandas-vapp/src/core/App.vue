<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <header class="app-header">
    <div class="app-header-inner">
      <RouterLink to="/" class="brand">Mini Tanda</RouterLink>
      <nav class="nav">
        <RouterLink to="/" class="nav-link">Dashboard</RouterLink>
        <RouterLink to="/tandas" class="nav-link">Tandas</RouterLink>
        <RouterLink to="/products" class="nav-link">Products</RouterLink>
        <RouterLink to="/clients" class="nav-link">Clients</RouterLink>
      </nav>
    </div>
  </header>

  <main class="app-main">
    <RouterView />
  </main>
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
</style>
