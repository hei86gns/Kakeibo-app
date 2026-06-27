import type { CategoryMap, ColorTheme, KakeiboEntry } from './types'
import { DEFAULT_CATEGORY_MAP, THEME_KEY } from './constants'

// Keys are scoped per user so each account has isolated data
const entriesKey  = (uid: string) => `kakeibo-${uid}-entries`
const categoryKey = (uid: string) => `kakeibo-${uid}-category-map`

export const loadEntries = (uid: string): KakeiboEntry[] => {
  try { return JSON.parse(localStorage.getItem(entriesKey(uid)) || '[]') } catch { return [] }
}

export const saveEntries = (uid: string, entries: KakeiboEntry[]) =>
  localStorage.setItem(entriesKey(uid), JSON.stringify(entries))

export const loadCategoryMap = (uid: string): CategoryMap => {
  try {
    const stored = localStorage.getItem(categoryKey(uid))
    return stored ? JSON.parse(stored) : { ...DEFAULT_CATEGORY_MAP }
  } catch {
    return { ...DEFAULT_CATEGORY_MAP }
  }
}

export const saveCategoryMap = (uid: string, map: CategoryMap) =>
  localStorage.setItem(categoryKey(uid), JSON.stringify(map))

export const loadTheme = (): ColorTheme => {
  const valid: ColorTheme[] = ['purple', 'pink', 'green', 'blue']
  const stored = localStorage.getItem(THEME_KEY)
  return valid.includes(stored as ColorTheme) ? (stored as ColorTheme) : 'purple'
}

export const saveTheme = (theme: ColorTheme) =>
  localStorage.setItem(THEME_KEY, theme)
