import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { CategoryMap, ColorTheme, KakeiboEntry, PageId } from './types'
import { loadCategoryMap, loadEntries, loadTheme, saveCategoryMap, saveEntries, saveTheme } from './storage'
import Login from './pages/Login'
import Home from './pages/Home'
import History from './pages/History'
import Stats from './pages/Stats'
import Data from './pages/Data'
import './App.css'

const THEMES: { id: ColorTheme; label: string; color: string }[] = [
  { id: 'purple', label: '紫', color: '#7c3aed' },
  { id: 'pink',   label: 'ピンク', color: '#db2777' },
  { id: 'green',  label: '緑', color: '#059669' },
  { id: 'blue',   label: '青', color: '#2563eb' },
]

const NAV: { id: PageId; label: string; icon: string }[] = [
  { id: 'home',    label: 'ホーム', icon: '🏠' },
  { id: 'history', label: '履歴',   icon: '📋' },
  { id: 'stats',   label: '統計',   icon: '📊' },
  { id: 'data',    label: 'データ', icon: '⚙️' },
]

export default function App() {
  const [user, setUser]               = useState<User | null>(null)
  const [authReady, setAuthReady]     = useState(false)
  const [entries, setEntries]         = useState<KakeiboEntry[]>([])
  const [categoryMap, setCategoryMap] = useState<CategoryMap>({})
  const [theme, setTheme]             = useState<ColorTheme>(() => loadTheme())
  const [page, setPage]               = useState<PageId>('home')
  const [message, setMessage]         = useState('')

  // Auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        setEntries(loadEntries(u.id))
        setCategoryMap(loadCategoryMap(u.id))
      }
      setAuthReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        setEntries(loadEntries(u.id))
        setCategoryMap(loadCategoryMap(u.id))
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) saveEntries(user.id, entries)
  }, [entries, user])

  useEffect(() => {
    if (user) saveCategoryMap(user.id, categoryMap)
  }, [categoryMap, user])

  // Auto-dismiss notification after 5 s
  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(''), 5000)
    return () => clearTimeout(t)
  }, [message])

  const descriptions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.description).filter(Boolean))).sort(),
    [entries],
  )

  const sortedCategories = useMemo(() => {
    const freq = new Map<string, number>()
    entries.forEach((e) => {
      if (e.category) freq.set(e.category, (freq.get(e.category) ?? 0) + 1)
    })
    return Object.keys(categoryMap).sort((a, b) => (freq.get(b) ?? 0) - (freq.get(a) ?? 0))
  }, [entries, categoryMap])

  const handleTheme = (t: ColorTheme) => { setTheme(t); saveTheme(t) }
  const handleAdd    = (e: KakeiboEntry) => setEntries((prev) => [e, ...prev])
  const handleDelete = (id: string) => setEntries((prev) => prev.filter((e) => e.id !== id))
  const handleImport = (newEntries: KakeiboEntry[]) => setEntries((prev) => [...prev, ...newEntries])
  const handleClearAll = () => {
    if (!window.confirm('保存されているすべての家計簿データを削除しますか？\nこの操作は元に戻せません。')) return
    setEntries([])
    setMessage('すべてのデータを削除しました。')
  }
  const handleLogout = async () => {
    if (!window.confirm('ログアウトしますか？')) return
    await supabase.auth.signOut()
    setEntries([])
    setCategoryMap({})
  }

  // Loading state
  if (!authReady) {
    return (
      <div className="app-shell" data-theme={theme} style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>読み込み中…</div>
      </div>
    )
  }

  // Not logged in → show login screen
  if (!user) return <Login />

  return (
    <div className="app-shell" data-theme={theme}>
      {/* ===== Header ===== */}
      <header className="app-header">
        <span className="app-title">Kakeibo</span>
        <img src="/kakeibo-app/dog.png" alt="" className="header-dog" aria-hidden="true" />
        <div className="header-bottom-row">
          <div className="theme-picker">
            {THEMES.map(({ id, label, color }) => (
              <button
                key={id}
                type="button"
                className={`theme-dot ${theme === id ? 'active' : ''}`}
                style={{ background: color }}
                onClick={() => handleTheme(id)}
                title={label}
                aria-label={`テーマ: ${label}`}
              />
            ))}
          </div>
          <button type="button" className="logout-btn" onClick={handleLogout}>
            ログアウト
          </button>
        </div>
      </header>

      {/* ===== Notification ===== */}
      {message && (
        <div className="notification" onClick={() => setMessage('')} role="status">
          {message}
        </div>
      )}

      {/* ===== Page Content ===== */}
      <main className="main-content">
        {page === 'home' && (
          <Home
            onAdd={handleAdd}
            categoryMap={categoryMap}
            sortedCategories={sortedCategories}
            descriptions={descriptions}
            entries={entries}
            onDelete={handleDelete}
            setMessage={setMessage}
          />
        )}
        {page === 'history' && (
          <History entries={entries} onDelete={handleDelete} />
        )}
        {page === 'stats' && (
          <Stats entries={entries} />
        )}
        {page === 'data' && (
          <Data
            entries={entries}
            categoryMap={categoryMap}
            onImport={handleImport}
            onCategoryMapChange={setCategoryMap}
            onClearAll={handleClearAll}
            setMessage={setMessage}
          />
        )}
      </main>

      {/* ===== Bottom Navigation ===== */}
      <nav className="nav-bar">
        {NAV.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            className={`nav-item ${page === id ? 'active' : ''}`}
            onClick={() => setPage(id)}
          >
            <span className="nav-icon">{icon}</span>
            <span className="nav-label">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
