export const parseExcelDate = (value: unknown): string => {
  if (typeof value === 'number') {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000))
    return date.toISOString().slice(0, 10)
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'string') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  }
  return new Date().toISOString().slice(0, 10)
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

export const today = (): string => new Date().toISOString().slice(0, 10)
