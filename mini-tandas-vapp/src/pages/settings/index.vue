<script setup lang="ts">
import { useSettingsStore } from '@shared/stores/settings'
import { formatMoney } from '@shared/db/format'

const store = useSettingsStore()

function onCurrencyChange(event: Event): void {
  const code = (event.target as HTMLSelectElement).value
  store.changeCurrency(code)
}
</script>

<template>
  <div class="card">
    <h1>Settings</h1>

    <div class="field">
      <label class="label" for="currency-select">Currency</label>
      <select
        id="currency-select"
        class="select"
        :value="store.currency"
        @change="onCurrencyChange"
      >
        <option v-for="code in store.supportedCurrencies" :key="code" :value="code">
          {{ code }}
        </option>
      </select>
      <p class="muted">Sample: {{ formatMoney(1234.5) }}</p>
    </div>
  </div>
</template>
