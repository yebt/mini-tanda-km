import { computed } from 'vue'
import { defineStore } from 'pinia'

import { currency, setCurrency, SUPPORTED_CURRENCIES } from '@shared/db/settings'

export const useSettingsStore = defineStore('settings', () => {
  const currentCurrency = computed(() => currency.value)
  const supportedCurrencies = SUPPORTED_CURRENCIES

  function changeCurrency(code: string): void {
    if ((SUPPORTED_CURRENCIES as readonly string[]).includes(code)) {
      setCurrency(code)
    }
  }

  return { currency: currentCurrency, supportedCurrencies, changeCurrency }
})
