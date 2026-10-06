<script setup lang="ts">
import { ref } from 'vue'

import { formatMoney } from '@shared/db/format'
import { useSettingsStore } from '@shared/stores/settings'
import { confirmDialog } from '@shared/ui/useConfirm'
import { notify } from '@shared/ui/useToast'
import { theme, toggleTheme } from '@shared/ui/useTheme'

const store = useSettingsStore()

const importInput = ref<HTMLInputElement | null>(null)
const importMessage = ref('')

function onCurrencyChange(event: Event): void {
  const code = (event.target as HTMLSelectElement).value
  store.changeCurrency(code)
}

function onThemeChange(event: Event): void {
  const wantDark = (event.target as HTMLSelectElement).value === 'dark'
  if (wantDark !== (theme.value === 'dark')) {
    toggleTheme()
  }
}

function exportData(): void {
  const payload = store.exportBackup()
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `mini-tanda-export-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

async function onImportFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const ok = await confirmDialog(
    'Importing replaces ALL current data (products, clients, tandas, sales, payments). You can undo it right after.',
    'Replace all data',
    { tone: 'danger' },
  )
  if (!ok) return
  try {
    const text = await file.text()
    // Snapshot first so the replacement can be undone.
    const previous: unknown = JSON.parse(JSON.stringify(store.exportBackup()))
    const rows = store.importBackup(JSON.parse(text))
    // Success is announced by the toast (with Undo); the inline status keeps errors.
    importMessage.value = ''
    notify(`Imported ${rows} rows.`, {
      action: {
        label: 'Undo',
        run: () => {
          store.importBackup(previous)
          importMessage.value = 'Import undone — previous data restored.'
        },
      },
    })
  } catch (error) {
    importMessage.value = error instanceof Error ? error.message : 'Import failed.'
  }
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

    <div class="field">
      <label class="label" for="theme-select">Theme</label>
      <select id="theme-select" class="select" :value="theme" @change="onThemeChange">
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
      <p class="muted">Follows your system preference until you choose one.</p>
    </div>

    <div class="field" role="group" aria-labelledby="settings-data-label">
      <span id="settings-data-label" class="label">Data</span>
      <div class="row">
        <button type="button" class="btn" @click="exportData">Export data (JSON)</button>
        <button type="button" class="btn" @click="importInput?.click()">Import data</button>
        <input
          ref="importInput"
          type="file"
          accept="application/json"
          class="visually-hidden"
          aria-label="Backup file to import"
          tabindex="-1"
          @change="onImportFile"
        />
      </div>
      <p class="muted">
        Export downloads every table — products, clients, tandas, sales, payments. Importing
        replaces all current data with the backup file.
      </p>
      <p v-if="importMessage" class="muted" role="status">{{ importMessage }}</p>
    </div>
  </div>
</template>

<style scoped>
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
