// toISOString() is UTC, so in Japan (UTC+9) it returns the previous day before 9:00.
// Format with the local calendar date instead.
const localYmd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const parseExcelDate = (value: unknown): string => {
  if (typeof value === 'number') {
    // An Excel serial number is a calendar date; this arithmetic yields that date at UTC midnight
    const date = new Date(Math.round((value - 25569) * 86400 * 1000))
    return date.toISOString().slice(0, 10)
  }
  // xlsx returns date cells as local-midnight Date objects
  if (value instanceof Date) return localYmd(value)
  if (typeof value === 'string') {
    const m = value.trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return localYmd(parsed)
  }
  return today()
}

export const normalizeHeader = (value: string): string =>
  value.trim().replace(/\s+/g, '')

export const parseAmountFromText = (text: string): number | null => {
  const matches = [...text.matchAll(/(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/g)]
  if (!matches.length) return null
  const numeric = matches
    .map((m) => Number(m[0].replace(/,/g, '')))
    .filter((n) => Number.isFinite(n))
  return numeric.length ? Math.max(...numeric) : null
}

export const today = (): string => localYmd(new Date())
