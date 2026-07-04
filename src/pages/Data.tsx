import { useState, type ChangeEvent } from 'react'
import * as XLSX from 'xlsx'
import type { CategoryMap, KakeiboEntry } from '../types'
import { normalizeHeader, parseExcelDate } from '../utils'

const COLUMNS = {
  period: '期間', asset: '資産', category: '分類', subcategory: '小分類',
  description: '内容', amount: '金額', type: '収入/支出', memo: 'メモ', currency: '通貨',
}

type Props = {
  entries: KakeiboEntry[]
  categoryMap: CategoryMap
  onImport: (entries: KakeiboEntry[]) => void
  onCategoryMapChange: (map: CategoryMap) => void
  onClearAll: () => void
  setMessage: (msg: string) => void
}

const handleExport = (entries: KakeiboEntry[]) => {
  const headers = ['日付', '科目', '小分類', '内容', '入出金', '金額', '資産', 'メモ', '通貨']
  const rows = entries.map((e) => [
    e.date, e.category, e.subcategory, e.description,
    e.type, e.amount, e.asset, e.memo, e.currency,
  ])
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `kakeibo_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Data({ entries, categoryMap, onImport, onCategoryMapChange, onClearAll, setMessage }: Props) {
  const [newCat, setNewCat] = useState('')
  const [selectedCat, setSelectedCat] = useState('')
  const [newSub, setNewSub] = useState('')

  const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true, raw: false })
      const sheet = workbook.SheetNames[0]
      const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheet], { header: 1, defval: '' })
      if (rows.length < 2) { setMessage('インポートできるデータが見つかりませんでした。'); return }
      const headerMap = (rows[0] as unknown[]).map((c) => normalizeHeader(String(c || '')))
      // Accept both らくな家計簿 headers and this app's own CSV export headers
      const aliases: Record<keyof typeof COLUMNS, string[]> = {
        period:      ['期間', '日付'],
        asset:       ['資産'],
        category:    ['分類', '科目'],
        subcategory: ['小分類'],
        description: ['内容'],
        amount:      ['金額'],
        type:        ['収入/支出', '入出金', '種別'],
        memo:        ['メモ'],
        currency:    ['通貨'],
      }
      const idx = Object.fromEntries(
        Object.entries(aliases).map(([k, names]) => {
          const found = names
            .map((n) => headerMap.indexOf(normalizeHeader(n)))
            .find((i) => i >= 0)
          return [k, found ?? -1]
        })
      ) as Record<keyof typeof COLUMNS, number>
      const newEntries: KakeiboEntry[] = []
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i] as unknown[]
        const raw = row[idx.amount]
        const parsed = Number(String(raw).replace(/[,¥\s]/g, ''))
        newEntries.push({
          id: `${Date.now()}-${i}`,
          date: parseExcelDate(row[idx.period]),
          asset: String(row[idx.asset] ?? '').trim() || '現金',
          category: String(row[idx.category] ?? '').trim(),
          subcategory: String(row[idx.subcategory] ?? '').trim(),
          description: String(row[idx.description] ?? '').trim(),
          amount: Number.isNaN(parsed) ? 0 : parsed,
          type: String(row[idx.type] ?? '').trim(),
          memo: String(row[idx.memo] ?? '').trim(),
          currency: String(row[idx.currency] ?? 'JPY').trim(),
          source: 'import',
        })
      }
      onImport(newEntries)
      setMessage(`${newEntries.length} 件インポートしました。`)
      e.target.value = ''
    } catch {
      setMessage('ファイルの読み込みに失敗しました。')
    }
  }

  const addCategory = () => {
    const cat = newCat.trim()
    if (!cat || categoryMap[cat] !== undefined) return
    onCategoryMapChange({ ...categoryMap, [cat]: [] })
    setNewCat('')
    setSelectedCat(cat)
  }

  const deleteCategory = (cat: string) => {
    if (!window.confirm(`「${cat}」の科目を削除しますか？`)) return
    const next = { ...categoryMap }
    delete next[cat]
    onCategoryMapChange(next)
    if (selectedCat === cat) setSelectedCat('')
  }

  const addSubcategory = () => {
    const sub = newSub.trim()
    if (!sub || !selectedCat) return
    const existing = categoryMap[selectedCat] ?? []
    if (existing.includes(sub)) return
    onCategoryMapChange({ ...categoryMap, [selectedCat]: [...existing, sub] })
    setNewSub('')
  }

  const deleteSubcategory = (cat: string, sub: string) => {
    onCategoryMapChange({ ...categoryMap, [cat]: (categoryMap[cat] ?? []).filter((s) => s !== sub) })
  }

  return (
    <div className="page">
      {/* Category management */}
      <div className="card">
        <div className="card-title"><span>🏷️</span> 科目・小分類の管理</div>
        <div className="manage-row">
          <input
            className="field-input"
            placeholder="新しい科目名を入力"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCategory()}
          />
          <button type="button" className="btn-secondary" onClick={addCategory}>追加</button>
        </div>

        <div className="category-list">
          {Object.keys(categoryMap).map((cat) => (
            <div
              key={cat}
              className={`category-item ${selectedCat === cat ? 'selected' : ''}`}
              onClick={() => setSelectedCat(cat === selectedCat ? '' : cat)}
            >
              <span>{cat}</span>
              <button
                type="button"
                className="icon-btn"
                onClick={(e) => { e.stopPropagation(); deleteCategory(cat) }}
                aria-label="削除"
              >✕</button>
            </div>
          ))}
        </div>

        {selectedCat && (
          <div className="subcategory-section">
            <div className="subcategory-title">「{selectedCat}」の小分類</div>
            <div className="manage-row">
              <input
                className="field-input"
                placeholder="新しい小分類名"
                value={newSub}
                onChange={(e) => setNewSub(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSubcategory()}
              />
              <button type="button" className="btn-secondary" onClick={addSubcategory}>追加</button>
            </div>
            <div className="subcategory-chips">
              {(categoryMap[selectedCat] ?? []).map((sub) => (
                <span key={sub} className="sub-chip">
                  {sub}
                  <button type="button" className="chip-delete" onClick={() => deleteSubcategory(selectedCat, sub)}>✕</button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Import */}
      <div className="card">
        <div className="card-title"><span>📥</span> データインポート</div>
        <p className="card-desc">らくな家計簿の Excel ファイル（.xlsx / .xls / .csv）をインポートします。</p>
        <label className="upload-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span>ファイルを選択</span>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} />
        </label>
        <p className="card-desc" style={{ marginTop: '10px', marginBottom: 0 }}>現在のデータ: {entries.length} 件</p>
      </div>

      {/* Export */}
      <div className="card">
        <div className="card-title"><span>📤</span> データエクスポート</div>
        <p className="card-desc">保存されているデータを CSV ファイルとしてダウンロードします。Excel で開けます。</p>
        <button
          type="button"
          className="upload-btn"
          onClick={() => {
            if (entries.length === 0) { setMessage('エクスポートするデータがありません。'); return }
            handleExport(entries)
            setMessage(`${entries.length} 件をエクスポートしました。`)
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span>CSV でダウンロード</span>
        </button>
      </div>

      {/* Danger zone */}
      <div className="card danger-card">
        <div className="card-title"><span>⚠️</span> データ管理</div>
        <button type="button" className="btn-danger" onClick={onClearAll}>
          すべてのデータを削除
        </button>
      </div>
    </div>
  )
}
