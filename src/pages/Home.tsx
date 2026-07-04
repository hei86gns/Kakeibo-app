import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import Tesseract from 'tesseract.js'
import type { CategoryMap, KakeiboEntry } from '../types'
import { DEFAULT_ASSET_OPTIONS } from '../constants'
import { parseAmountFromText, today } from '../utils'

type Props = {
  onAdd: (entry: KakeiboEntry) => void
  onUpdate: (entry: KakeiboEntry) => void
  categoryMap: CategoryMap
  sortedCategories: string[]
  descriptions: string[]
  entries: KakeiboEntry[]
  onDelete: (id: string) => void
  editingEntry: KakeiboEntry | null
  onStartEdit: (entry: KakeiboEntry) => void
  onEndEdit: () => void
  presetDate: string | null
  onPresetConsumed: () => void
  onCancelled: () => void
  setMessage: (msg: string) => void
}

const getInitialForm = (date?: string) => ({
  date: date ?? today(),
  asset: '現金',
  category: '',
  subcategory: '',
  description: '',
  amount: 0,
  type: '支出',
  memo: '',
  currency: 'JPY',
})

const scrollTop = () => document.querySelector('.main-content')?.scrollTo({ top: 0, behavior: 'smooth' })

export default function Home({
  onAdd, onUpdate, categoryMap, sortedCategories, descriptions, entries,
  onDelete, editingEntry, onStartEdit, onEndEdit, presetDate, onPresetConsumed, onCancelled, setMessage,
}: Props) {
  const [form, setForm] = useState(getInitialForm)
  const [receiptImageUrl, setReceiptImageUrl] = useState<string | null>(null)
  const [receiptText, setReceiptText] = useState('')
  const [ocrBusy, setOcrBusy] = useState(false)
  const dateRef = useRef<HTMLInputElement>(null)
  const ocrInputRef = useRef<HTMLInputElement>(null)

  const isEditing = editingEntry !== null

  // Populate form when an entry is selected for editing
  useEffect(() => {
    if (!editingEntry) return
    setForm({
      date: editingEntry.date,
      asset: editingEntry.asset,
      category: editingEntry.category,
      subcategory: editingEntry.subcategory,
      description: editingEntry.description,
      amount: editingEntry.amount,
      type: editingEntry.type,
      memo: editingEntry.memo,
      currency: editingEntry.currency,
    })
    scrollTop()
  }, [editingEntry])

  // Apply date passed from the calendar page
  useEffect(() => {
    if (!presetDate) return
    setForm((prev) => ({ ...prev, date: presetDate }))
    onPresetConsumed()
  }, [presetDate, onPresetConsumed])

  const subcategories = form.category ? (categoryMap[form.category] ?? []) : []

  const now = new Date()
  const currentMonthEntries = useMemo(
    () =>
      entries.filter((e) => {
        const d = new Date(e.date)
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
      }),
    [entries],
  )
  const totalIncome  = currentMonthEntries.filter((e) => e.type === '収入').reduce((s, e) => s + e.amount, 0)
  const totalExpense = currentMonthEntries.filter((e) => e.type === '支出').reduce((s, e) => s + e.amount, 0)
  const balance      = totalIncome - totalExpense

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: name === 'amount' ? Number(value) : value,
      ...(name === 'category' ? { subcategory: '' } : {}),
    }))
  }

  const openDatePicker = () => {
    try { dateRef.current?.showPicker() } catch { dateRef.current?.click() }
  }

  const handleReceiptImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setReceiptImageUrl(URL.createObjectURL(file))
    setReceiptText('解析中…')
    setOcrBusy(true)
    setForm((prev) => ({ ...prev, description: '', amount: 0 }))
    try {
      const result = await Tesseract.recognize(file, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setReceiptText(`OCR ${Math.round((m.progress ?? 0) * 100)}%`)
          }
        },
      })
      const text = result.data.text
      setReceiptText(text)
      const autoAmount = parseAmountFromText(text)
      setForm((prev) => ({
        ...prev,
        description: text.split(/\n/).find((r) => r.trim().length > 1) ?? prev.description,
        amount: autoAmount ?? prev.amount,
      }))
      setMessage(
        autoAmount
          ? `OCR で金額 ¥${autoAmount.toLocaleString()} を検出しました。`
          : 'OCR で金額を検出できませんでした。手動で入力してください。',
      )
    } catch {
      setReceiptText('OCR 失敗')
      setMessage('レシートの解析に失敗しました。')
    } finally {
      setOcrBusy(false)
    }
  }

  const handleSave = () => {
    if (isEditing && editingEntry) {
      onUpdate({ ...editingEntry, ...form })
      onEndEdit()
      setMessage('更新しました！')
    } else {
      onAdd({ id: `${Date.now()}`, ...form, source: 'manual' })
      setMessage('保存しました！')
    }
    // Keep the same date so consecutive entries for one day are quick
    setForm(getInitialForm(form.date))
    setReceiptImageUrl(null)
    setReceiptText('')
  }

  const handleCancel = () => {
    if (isEditing) onEndEdit()
    setForm(getInitialForm())
    setReceiptImageUrl(null)
    setReceiptText('')
    onCancelled()
  }

  return (
    <>
    <div className="page">
      {/* Form card with OCR button in title */}
      <div className="card">
        <div className="card-title">
          <span>{isEditing ? '🖊️' : '✏️'}</span> {isEditing ? '記録を編集中' : '入力フォーム'}
          <button
            type="button"
            className="ocr-inline-btn"
            onClick={() => ocrInputRef.current?.click()}
            title="レシートを読み取る"
            disabled={ocrBusy}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span>{ocrBusy ? '読取中…' : 'OCR'}</span>
          </button>
          <input
            ref={ocrInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleReceiptImage}
            style={{ display: 'none' }}
          />
        </div>

        {/* OCR compact result */}
        {(receiptImageUrl || receiptText) && (
          <div className="ocr-compact">
            {receiptImageUrl && <img src={receiptImageUrl} alt="レシート" className="ocr-thumb" />}
            {receiptText && <pre className="ocr-text-compact">{receiptText}</pre>}
          </div>
        )}

        <div className="form-grid">
          <div className="field-row">
            <label className="field-label">
              <span className="label-txt">日付</span>
              <div className="date-wrapper">
                <input
                  ref={dateRef}
                  type="date"
                  name="date"
                  value={form.date}
                  onChange={handleChange}
                  className="field-input date-input"
                />
                <button type="button" className="calendar-btn" onClick={openDatePicker} aria-label="カレンダーを開く">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </button>
              </div>
            </label>
            <label className="field-label">
              <span className="label-txt">種別</span>
              <select name="type" value={form.type} onChange={handleChange} className="field-input">
                <option value="支出">支出</option>
                <option value="収入">収入</option>
              </select>
            </label>
          </div>
          <div className="field-row">
            <label className="field-label">
              <span className="label-txt">科目</span>
              <select name="category" value={form.category} onChange={handleChange} className="field-input">
                <option value="">選択</option>
                {sortedCategories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </label>
            <label className="field-label">
              <span className="label-txt">分類</span>
              <select name="subcategory" value={form.subcategory} onChange={handleChange} className="field-input" disabled={!form.category}>
                <option value="">{form.category ? '選択' : '先に科目'}</option>
                {subcategories.map((sub) => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="field-row">
            <label className="field-label">
              <span className="label-txt">金額</span>
              <input
                type="number"
                name="amount"
                value={form.amount || ''}
                min="0"
                placeholder="0"
                inputMode="numeric"
                pattern="[0-9]*"
                onChange={handleChange}
                onFocus={(e) => e.target.select()}
                className="field-input"
              />
            </label>
            <label className="field-label">
              <span className="label-txt">資産</span>
              <select name="asset" value={form.asset} onChange={handleChange} className="field-input">
                {DEFAULT_ASSET_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="field-label">
            <span className="label-txt">内容</span>
            <input
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="コンビニ、スーパー…"
              className="field-input"
              list="description-list"
              autoComplete="off"
            />
            {/* Options exist only after typing, so no big list pops up on focus */}
            <datalist id="description-list">
              {form.description.length > 0 &&
                descriptions
                  .filter((d) => d.includes(form.description))
                  .slice(0, 8)
                  .map((d) => <option key={d} value={d} />)}
            </datalist>
          </label>
          <label className="field-label">
            <span className="label-txt">メモ</span>
            <textarea name="memo" value={form.memo} onChange={handleChange} rows={1} placeholder="任意" className="field-input" />
          </label>
        </div>
      </div>

      {/* Current month history */}
      <div className="card">
        <div className="card-title">
          <span>📋</span> {now.getMonth() + 1}月の記録
        </div>

        <div className="summary-row" style={{ marginBottom: '12px' }}>
          <div className="summary-card income-card">
            <div className="summary-label">収入</div>
            <div className="summary-value income-value">¥{totalIncome.toLocaleString()}</div>
          </div>
          <div className="summary-card expense-card">
            <div className="summary-label">支出</div>
            <div className="summary-value expense-value">¥{totalExpense.toLocaleString()}</div>
          </div>
          <div className="summary-card balance-card">
            <div className="summary-label">収支</div>
            <div className={`summary-value ${balance >= 0 ? 'income-value' : 'expense-value'}`}>
              {balance >= 0 ? '+' : '-'}¥{Math.abs(balance).toLocaleString()}
            </div>
          </div>
        </div>

        {currentMonthEntries.length === 0 ? (
          <div className="empty-state" style={{ padding: '16px 0' }}>
            <p>今月のデータがまだありません</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>日付</th>
                  <th>科目</th>
                  <th>内容</th>
                  <th>種別</th>
                  <th>金額</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {currentMonthEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    data-type={entry.type}
                    className={`tappable ${editingEntry?.id === entry.id ? 'editing-row' : ''}`}
                    onClick={() => onStartEdit(entry)}
                  >
                    <td>{entry.date.slice(5)}</td>
                    <td>{entry.category}</td>
                    <td>{entry.description}</td>
                    <td>
                      <span className={`type-badge ${entry.type === '収入' ? 'badge-income' : 'badge-expense'}`}>
                        {entry.type}
                      </span>
                    </td>
                    <td className="amount-cell">¥{entry.amount.toLocaleString()}</td>
                    <td className="row-actions">
                      <button
                        type="button"
                        className="delete-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (window.confirm('この項目を削除してもよいですか？')) onDelete(entry.id)
                        }}
                        aria-label="削除"
                      >✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>

    {/* Fixed save / cancel bar above nav */}
    <div className="save-bar">
      <button type="button" className="btn-cancel" onClick={handleCancel}>
        キャンセル
      </button>
      <button type="button" className="btn-primary save-bar-btn" onClick={handleSave} disabled={ocrBusy}>
        {isEditing ? '更新する' : '保存する'}
      </button>
    </div>
    </>
  )
}
