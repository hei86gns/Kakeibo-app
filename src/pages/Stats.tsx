import { useMemo, useState } from 'react'
import type { KakeiboEntry } from '../types'

type Props = { entries: KakeiboEntry[] }

const COLORS = [
  '#7c3aed', '#f43f5e', '#10b981', '#f59e0b',
  '#3b82f6', '#ec4899', '#14b8a6', '#f97316',
  '#84cc16', '#06b6d4', '#a855f7', '#fbbf24',
]

type Slice = { name: string; amount: number; pct: number; color: string }

function DonutChart({ slices }: { slices: Slice[] }) {
  const cx = 100, cy = 100, r = 82, inner = 52

  if (slices.length === 0) return null

  // Single category: draw full ring
  if (slices.length === 1) {
    return (
      <svg viewBox="0 0 200 200" className="donut-svg">
        <circle cx={cx} cy={cy} r={r} fill={slices[0].color} />
        <circle cx={cx} cy={cy} r={inner} fill="var(--surface)" />
      </svg>
    )
  }

  let angle = -Math.PI / 2
  const paths = slices.map(({ name, pct, color }) => {
    const sweep = (pct / 100) * 2 * Math.PI
    const end = angle + sweep
    const large = sweep > Math.PI ? 1 : 0
    const cos1 = Math.cos(angle), sin1 = Math.sin(angle)
    const cos2 = Math.cos(end), sin2 = Math.sin(end)
    const d = [
      `M ${cx + r * cos1} ${cy + r * sin1}`,
      `A ${r} ${r} 0 ${large} 1 ${cx + r * cos2} ${cy + r * sin2}`,
      `L ${cx + inner * cos2} ${cy + inner * sin2}`,
      `A ${inner} ${inner} 0 ${large} 0 ${cx + inner * cos1} ${cy + inner * sin1}`,
      'Z',
    ].join(' ')
    angle = end
    return { name, color, d }
  })

  return (
    <svg viewBox="0 0 200 200" className="donut-svg">
      {paths.map(({ name, d, color }) => (
        <path key={name} d={d} fill={color} stroke="var(--surface)" strokeWidth="2" />
      ))}
    </svg>
  )
}

export default function Stats({ entries }: Props) {
  const now = new Date()
  const [year, setYear]           = useState(now.getFullYear())
  const [month, setMonth]         = useState(now.getMonth() + 1)
  const [view, setView]           = useState<'month' | 'year'>('month')
  const [chartType, setChartType] = useState<'支出' | '収入'>('支出')

  const years = useMemo(() => {
    const ys = new Set(entries.map((e) => new Date(e.date).getFullYear()))
    ys.add(now.getFullYear())
    return Array.from(ys).sort((a, b) => b - a)
  }, [entries])

  const filtered = useMemo(
    () =>
      view === 'month'
        ? entries.filter((e) => {
            const d = new Date(e.date)
            return d.getFullYear() === year && d.getMonth() + 1 === month
          })
        : entries.filter((e) => new Date(e.date).getFullYear() === year),
    [entries, year, month, view],
  )

  const totalIncome  = filtered.filter((e) => e.type === '収入').reduce((s, e) => s + e.amount, 0)
  const totalExpense = filtered.filter((e) => e.type === '支出').reduce((s, e) => s + e.amount, 0)
  const balance      = totalIncome - totalExpense

  const chartData: Slice[] = useMemo(() => {
    const map = new Map<string, number>()
    filtered
      .filter((e) => e.type === chartType)
      .forEach((e) => {
        const key = e.category || 'その他'
        map.set(key, (map.get(key) ?? 0) + e.amount)
      })
    const total = Array.from(map.values()).reduce((s, v) => s + v, 0)
    return Array.from(map.entries())
      .map(([name, amount], i) => ({
        name,
        amount,
        pct: total > 0 ? (amount / total) * 100 : 0,
        color: COLORS[i % COLORS.length],
      }))
      .sort((a, b) => b.amount - a.amount)
  }, [filtered, chartType])

  const chartTotal = chartData.reduce((s, d) => s + d.amount, 0)

  const monthlyTrend = useMemo(() => {
    if (view !== 'year') return []
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1
      const me = entries.filter((e) => {
        const d = new Date(e.date)
        return d.getFullYear() === year && d.getMonth() + 1 === m
      })
      return {
        month: m,
        income:  me.filter((e) => e.type === '収入').reduce((s, e) => s + e.amount, 0),
        expense: me.filter((e) => e.type === '支出').reduce((s, e) => s + e.amount, 0),
      }
    })
  }, [entries, year, view])

  const maxMonthly = Math.max(...monthlyTrend.map((m) => Math.max(m.income, m.expense)), 1)

  return (
    <div className="page">
      {/* Period controls */}
      <div className="card stats-controls">
        <div className="view-toggle">
          <button type="button" className={`toggle-btn ${view === 'month' ? 'active' : ''}`} onClick={() => setView('month')}>月次</button>
          <button type="button" className={`toggle-btn ${view === 'year'  ? 'active' : ''}`} onClick={() => setView('year')}>年次</button>
        </div>
        <div className="period-selects">
          <select className="month-select" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}年</option>)}
          </select>
          {view === 'month' && (
            <select className="month-select" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{m}月</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="summary-row">
        <div className="summary-card income-card">
          <div className="summary-label">収入合計</div>
          <div className="summary-value income-value">¥{totalIncome.toLocaleString()}</div>
        </div>
        <div className="summary-card expense-card">
          <div className="summary-label">支出合計</div>
          <div className="summary-value expense-value">¥{totalExpense.toLocaleString()}</div>
        </div>
        <div className="summary-card balance-card">
          <div className="summary-label">収支</div>
          <div className={`summary-value ${balance >= 0 ? 'income-value' : 'expense-value'}`}>
            {balance >= 0 ? '+' : '-'}¥{Math.abs(balance).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Monthly trend bar chart (year view only) */}
      {view === 'year' && (
        <div className="card">
          <div className="card-title">月別推移</div>
          <div className="monthly-chart">
            {monthlyTrend.map(({ month: m, income, expense }) => (
              <div className="monthly-group" key={m}>
                <div className="monthly-bars">
                  <div className="monthly-bar income-bar"  style={{ height: `${(income  / maxMonthly) * 100}%` }} title={`収入 ¥${income.toLocaleString()}`} />
                  <div className="monthly-bar expense-bar" style={{ height: `${(expense / maxMonthly) * 100}%` }} title={`支出 ¥${expense.toLocaleString()}`} />
                </div>
                <div className="monthly-label">{m}月</div>
              </div>
            ))}
          </div>
          <div className="chart-legend">
            <span className="legend-dot income-dot" />収入
            <span className="legend-dot expense-dot" />支出
          </div>
        </div>
      )}

      {/* Donut pie chart */}
      <div className="card">
        <div className="card-title">
          内訳（科目別）
          <div className="view-toggle" style={{ marginLeft: 'auto' }}>
            <button type="button" className={`toggle-btn ${chartType === '支出' ? 'active' : ''}`} onClick={() => setChartType('支出')}>支出</button>
            <button type="button" className={`toggle-btn ${chartType === '収入' ? 'active' : ''}`} onClick={() => setChartType('収入')}>収入</button>
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="empty-state" style={{ padding: '20px 0' }}>
            <p>この期間に{chartType}のデータがありません</p>
          </div>
        ) : (
          <div className="pie-section">
            {/* Chart + center label */}
            <div className="donut-wrapper">
              <DonutChart slices={chartData} />
              <div className="donut-center">
                <div className="donut-total">¥{chartTotal.toLocaleString()}</div>
                <div className="donut-type">{chartType}</div>
              </div>
            </div>

            {/* Legend */}
            <div className="pie-legend">
              {chartData.map(({ name, amount, pct, color }) => (
                <div key={name} className="pie-legend-row">
                  <span className="pie-dot" style={{ background: color }} />
                  <span className="pie-name">{name}</span>
                  <span className="pie-pct">{pct.toFixed(1)}%</span>
                  <span className="pie-amount">¥{amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
