import { get, run } from '../database'

export function getSetting(key: string): string | null {
  return get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key])?.value ?? null
}

export function setSetting(key: string, value: string): void {
  run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  )
}
