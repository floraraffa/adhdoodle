// Thin wrapper over persistentStorageSystem for JSON payloads.
const store = global.persistentStorageSystem.store

export function saveJSON(key: string, value: unknown): void {
  store.putString(key, JSON.stringify(value))
}

export function loadJSON<T>(key: string): T | null {
  const raw = store.getString(key)
  if (!raw || raw.length === 0) return null
  try {
    return JSON.parse(raw) as T
  } catch (error) {
    print(`[FocusPersist] JSON corrupto en ${key}: ${error}`)
    return null
  }
}
