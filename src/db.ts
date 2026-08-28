import { supabase } from './supabase'
import type { CategoryMap, KakeiboEntry } from './types'

const ENTRIES_TABLE  = 'kakeibo_entries'
const SETTINGS_TABLE = 'kakeibo_settings'

type EntryRow = KakeiboEntry & { user_id: string; created_at?: string }

const toRow = (userId: string, e: KakeiboEntry): EntryRow => ({ ...e, user_id: userId })

export const fetchEntries = async (userId: string): Promise<KakeiboEntry[]> => {
  const { data, error } = await supabase
    .from(ENTRIES_TABLE)
    .select('id, date, asset, category, subcategory, description, amount, type, memo, currency, source')
    .eq('user_id', userId)
    .order('date', { ascending: false })
  if (error) throw error
  return (data ?? []) as KakeiboEntry[]
}

export const insertEntry = async (userId: string, entry: KakeiboEntry): Promise<void> => {
  const { error } = await supabase.from(ENTRIES_TABLE).insert(toRow(userId, entry))
  if (error) throw error
}

export const insertEntries = async (userId: string, entries: KakeiboEntry[]): Promise<void> => {
  if (entries.length === 0) return
  const { error } = await supabase.from(ENTRIES_TABLE).insert(entries.map((e) => toRow(userId, e)))
  if (error) throw error
}

export const updateEntry = async (entry: KakeiboEntry): Promise<void> => {
  const { id, ...rest } = entry
  const { error } = await supabase.from(ENTRIES_TABLE).update(rest).eq('id', id)
  if (error) throw error
}

export const deleteEntry = async (id: string): Promise<void> => {
  const { error } = await supabase.from(ENTRIES_TABLE).delete().eq('id', id)
  if (error) throw error
}

export const deleteAllEntries = async (userId: string): Promise<void> => {
  const { error } = await supabase.from(ENTRIES_TABLE).delete().eq('user_id', userId)
  if (error) throw error
}

export const fetchCategoryMap = async (userId: string): Promise<CategoryMap | null> => {
  const { data, error } = await supabase
    .from(SETTINGS_TABLE)
    .select('category_map')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return (data?.category_map as CategoryMap | undefined) ?? null
}

export const saveCategoryMap = async (userId: string, map: CategoryMap): Promise<void> => {
  const { error } = await supabase
    .from(SETTINGS_TABLE)
    .upsert({ user_id: userId, category_map: map, updated_at: new Date().toISOString() })
  if (error) throw error
}
