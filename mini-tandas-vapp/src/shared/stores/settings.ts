import { computed, shallowRef } from 'vue'
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

  /**
   * The data an import replaced, kept in memory for this session so
   * "Replace all data" can be reverted from Settings after the Undo toast is
   * gone. Only the latest import is kept; null when there is nothing to restore.
   */
  const restorePoint = shallowRef<{ backup: unknown; replacedAt: string } | null>(null)

  /**
   * Import a backup over ALL current data, keeping the current data as the
   * restore point. A file that fails validation changes nothing.
   */
  function replaceAllData(payload: unknown): number {
    const previous: unknown = JSON.parse(JSON.stringify(exportBackup()))
    const rows = importBackup(payload)
    restorePoint.value = { backup: previous, replacedAt: new Date().toISOString() }
    return rows
  }

  /** Put back the data from before the last import (and forget the restore point). */
  function restorePrevious(): void {
    const point = restorePoint.value
    if (!point) return
    importBackup(point.backup)
    restorePoint.value = null
  }

  function dismissRestorePoint(): void {
    restorePoint.value = null
  }

  return {
    currency: currentCurrency,
    supportedCurrencies,
    changeCurrency,
    exportBackup,
    importBackup,
    restorePoint,
    replaceAllData,
    restorePrevious,
    dismissRestorePoint,
  }
})
