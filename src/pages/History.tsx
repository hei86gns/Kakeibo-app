import { useMemo, useState } from 'react'
import type { KakeiboEntry } from '../types'

type Props = {
  entries: KakeiboEntry[]
  onDelete: (id: string) => void
}

export default function History({ entries, onDelete }: Props) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const years = useMemo(() => {
    const ys = new Set(entries.map((e) => new Date(e.date).getFullYear()))
    ys.add(now.getFullYear())
    return Array.from(ys).sort((a, b) => b - a)
  }, [entries])

  const filtered = useMemo(
    () =>
      entries.filter((e) => {
        const d = new Date(e.date)
        return d.getFullYear() === year && d.getMonth() + 1 === month
      }),
    [entries, year, month],
  )

  const totalIncome = filtered.filter((e) => e.type === '収入').reduce((s, e) => s + e.amount, 0)
  const totalExpense = filtered.filter((e) => e.type === '支出').reduce((s, e) => s + e.amount, 0)
  const balance = totalIncome - totalExpense

  return (
    <div className="page">
      {/* Month picker */}
      <div className="card month-picker-card">
        <select className="month-select" value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {years.map((y) => <option key={y} value={y}>{y}年</option>)}
        </select>
        <select className="month-select" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>{m}月</option>
          ))}
        </select>
      </div>

      {/* Summary */}
      <div className="summary-row">
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

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>この月のデータがありません</p>
          <p>ホームから入力するか、データページでインポートしてください。</p>
        </div>
      ) : (
        <div className="card table-card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>日付</th>
                  <th>科目</th>
                  <th>小分類</th>
                  <th>内容</th>
                  <th>種別</th>
                  <th>金額</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr key={entry.id} data-type={entry.type}>
                    <td>{entry.date}</td>
                    <td>{entry.category}</td>
                    <td>{entry.subcategory}</td>
                    <td>{entry.description}</td>
                    <td>
                      <span className={`type-badge ${entry.type === '収入' ? 'badge-income' : 'badge-expense'}`}>
                        {entry.type}
                      </span>
                    </td>
                    <td className="amount-cell">¥{entry.amount.toLocaleString()}</td>
                    <td>
                      <button
                        type="button"
                        className="delete-btn"
                        onClick={() => {
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
        </div>
      )}
    </div>
  )
}
