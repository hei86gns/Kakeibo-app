import { useMemo, useState } from 'react'
import type { KakeiboEntry } from '../types'
import { today } from '../utils'

type Props = {
  entries: KakeiboEntry[]
  onSelectDate: (date: string) => void
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

const pad = (n: number) => String(n).padStart(2, '0')

export default function Calendar({ entries, onSelectDate }: Props) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth()) // 0-11

  const todayStr = today()

  // date string -> { income, expense }
  const dailyTotals = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>()
    entries.forEach((e) => {
      const cur = map.get(e.date) ?? { income: 0, expense: 0 }
      if (e.type === '収入') cur.income += e.amount
      else if (e.type === '支出') cur.expense += e.amount
      map.set(e.date, cur)
    })
    return map
  }, [entries])

  const monthIncome = useMemo(() => {
    let income = 0, expense = 0
    entries.forEach((e) => {
      const d = new Date(e.date)
      if (d.getFullYear() === year && d.getMonth() === month) {
        if (e.type === '収入') income += e.amount
        else if (e.type === '支出') expense += e.amount
      }
    })
    return { income, expense }
  }, [entries, year, month])

  const prevMonth = () => {
    if (month === 0) { setYear(year - 1); setMonth(11) } else setMonth(month - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(year + 1); setMonth(0) } else setMonth(month + 1)
  }
  const goToday = () => { setYear(now.getFullYear()); setMonth(now.getMonth()) }

  // build cells: leading blanks + days
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const fmt = (n: number) =>
    n >= 10000 ? `${Math.round(n / 1000) / 10}万` : n.toLocaleString()

  return (
    <div className="page">
      {/* Month navigation */}
      <div className="card cal-nav">
        <button type="button" className="cal-nav-btn" onClick={prevMonth} aria-label="前の月">‹</button>
        <button type="button" className="cal-title" onClick={goToday}>
          {year}年 {month + 1}月
        </button>
        <button type="button" className="cal-nav-btn" onClick={nextMonth} aria-label="次の月">›</button>
      </div>

      {/* Month summary */}
      <div className="summary-row">
        <div className="summary-card">
          <div className="summary-label">収入</div>
          <div className="summary-value income-value">¥{monthIncome.income.toLocaleString()}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">支出</div>
          <div className="summary-value expense-value">¥{monthIncome.expense.toLocaleString()}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">収支</div>
          <div className={`summary-value ${monthIncome.income - monthIncome.expense >= 0 ? 'income-value' : 'expense-value'}`}>
            {monthIncome.income - monthIncome.expense >= 0 ? '+' : '-'}
            ¥{Math.abs(monthIncome.income - monthIncome.expense).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="card cal-card">
        <div className="cal-grid cal-weekdays">
          {WEEKDAYS.map((w, i) => (
            <div key={w} className={`cal-weekday ${i === 0 ? 'sun' : ''} ${i === 6 ? 'sat' : ''}`}>{w}</div>
          ))}
        </div>
        <div className="cal-grid">
          {cells.map((day, i) => {
            if (day === null) return <div key={`b${i}`} className="cal-cell blank" />
            const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`
            const totals = dailyTotals.get(dateStr)
            const isToday = dateStr === todayStr
            const dow = i % 7
            return (
              <button
                type="button"
                key={dateStr}
                className={`cal-cell ${isToday ? 'today' : ''}`}
                onClick={() => onSelectDate(dateStr)}
              >
                <span className={`cal-day ${dow === 0 ? 'sun' : ''} ${dow === 6 ? 'sat' : ''}`}>{day}</span>
                {totals && totals.income > 0 && (
                  <span className="cal-amt income-value">+{fmt(totals.income)}</span>
                )}
                {totals && totals.expense > 0 && (
                  <span className="cal-amt expense-value">-{fmt(totals.expense)}</span>
                )}
              </button>
            )
          })}
        </div>
        <p className="cal-hint">日付をタップすると、その日の日付で入力画面が開きます</p>
      </div>
    </div>
  )
}
