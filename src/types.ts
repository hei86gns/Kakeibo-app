export type KakeiboEntry = {
  id: string
  date: string
  asset: string
  category: string
  subcategory: string
  description: string
  amount: number
  type: string
  memo: string
  currency: string
  source: string
}

export type ColorTheme = 'purple' | 'pink' | 'green' | 'blue'
export type PageId = 'home' | 'history' | 'stats' | 'data'
export type CategoryMap = Record<string, string[]>
