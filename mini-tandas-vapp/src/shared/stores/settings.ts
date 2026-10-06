import { computed } from 'vue'
import { defineStore } from 'pinia'

import { exportPayload, importAllData } from '@shared/db/database'
import { currency, loadSettings, setCurrency, SUPPORTED_CURRENCIES } from '@shared/db/settings'

export const useSettingsStore = defineStore('settings', () => {
  const currentCurrency = computed(() => currency.value)
  const supportedCurrencies = SUPPORTED_CURRENCIES

  function changeCurrency(code: string): void {
    if ((SUPPORTED_CURRENCIES as readonly string[]).includes(code)) {
      setCurrency(code)
    }
  }

  /** Full backup payload (app marker, schema version, all tables). */
  function exportBackup(): ReturnType<typeof exportPayload> {
    return exportPayload()
  }

  /**
   * Replace ALL data with a parsed backup file and reload settings that live
   * in it (currency). Returns the number of rows imported; throws on invalid files.
   */
  function importBackup(payload: unknown): number {
    const rows = importAllData(payload)
    loadSettings()
    return rows
  }

  return {
    currency: currentCurrency,
    supportedCurrencies,
    changeCurrency,
    exportBackup,
    importBackup,
  }
})
