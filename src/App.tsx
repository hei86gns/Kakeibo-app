import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import dogImg from './assets/dog.png'
import { supabase } from './supabase'
import type { CategoryMap, ColorTheme, KakeiboEntry, PageId } from './types'
import { loadTheme, saveTheme } from './storage'
import { loadEntries as loadLocalEntries, loadCategoryMap as loadLocalCategoryMap } from './storage'
import { DEFAULT_CATEGORY_MAP } from './constants'
import {
  fetchEntries, fetchCategoryMap,
  insertEntry, insertEntries, updateEntry, deleteEntry, deleteAllEntries,
  saveCategoryMap as saveCategoryMapRemote,
} from './db'
import Login from './pages/Login'
import Home from './pages/Home'
import Calendar from './pages/Calendar'
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
  { id: 'home',     label: 'ホーム',     icon: '🏠' },
  { id: 'calendar', label: 'カレンダー', icon: '📅' },
  { id: 'history',  label: '履歴',       icon: '📋' },
  { id: 'stats',    label: '統計',       icon: '📊' },
  { id: 'data',     label: 'データ',     icon: '⚙️' },
]

const NETWORK_ERROR_MSG = '通信に失敗しました。電波状況をご確認のうえ、もう一度お試しください。'

export default function App() {
  const [user, setUser]               = useState<User | null>(null)
  const [authReady, setAuthReady]     = useState(false)
  const [dataLoading, setDataLoading] = useState(false)
  const [dataLoadError, setDataLoadError] = useState('')
  const [entries, setEntries]         = useState<KakeiboEntry[]>([])
  const [categoryMap, setCategoryMap] = useState<CategoryMap>({})
  const [theme, setTheme]             = useState<ColorTheme>(() => loadTheme())
  const [page, setPage]               = useState<PageId>('home')
  const [message, setMessage]         = useState('')
  const [editingEntry, setEditingEntry] = useState<KakeiboEntry | null>(null)
  const [presetDate, setPresetDate]     = useState<string | null>(null)
  const [cameFromCalendar, setCameFromCalendar] = useState(false)

  // Auth listener — only tracks who's logged in; data is fetched separately below
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setAuthReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Load this user's data from Supabase whenever they log in
  useEffect(() => {
    if (!user) {
      setEntries([])
      setCategoryMap({})
      return
    }
    let cancelled = false
    setDataLoading(true)
    setDataLoadError('')
    Promise.all([fetchEntries(user.id), fetchCategoryMap(user.id)])
      .then(([remoteEntries, remoteMap]) => {
        if (cancelled) return
        setEntries(remoteEntries)
        setCategoryMap(remoteMap ?? { ...DEFAULT_CATEGORY_MAP })
      })
      .catch((err) => {
        console.error(err)
        if (cancelled) return
        setDataLoadError(NETWORK_ERROR_MSG)
      })
      .finally(() => {
        if (!cancelled) setDataLoading(false)
      })
    return () => { cancelled = true }
  }, [user])

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

  // Every write below is optimistic: the screen updates immediately,
  // and rolls back with an error message if the Supabase call fails.
  const handleAdd = async (entry: KakeiboEntry) => {
    setEntries((prev) => [entry, ...prev])
    if (!user) return
    try {
      await insertEntry(user.id, entry)
    } catch (err) {
      console.error(err)
      setEntries((prev) => prev.filter((e) => e.id !== entry.id))
      setMessage(NETWORK_ERROR_MSG)
    }
  }

  const handleUpdate = async (updated: KakeiboEntry) => {
    const previous = entries.find((e) => e.id === updated.id)
    setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
    if (!user) return
    try {
      await updateEntry(updated)
    } catch (err) {
      console.error(err)
      if (previous) setEntries((prev) => prev.map((e) => (e.id === updated.id ? previous : e)))
      setMessage(NETWORK_ERROR_MSG)
    }
  }

  const handleDelete = async (id: string) => {
    const previous = entries.find((e) => e.id === id)
    setEntries((prev) => prev.filter((e) => e.id !== id))
    if (editingEntry?.id === id) setEditingEntry(null)
    if (!user) return
    try {
      await deleteEntry(id)
    } catch (err) {
      console.error(err)
      if (previous) setEntries((prev) => [previous, ...prev])
      setMessage(NETWORK_ERROR_MSG)
    }
  }

  const handleImport = async (newEntries: KakeiboEntry[]) => {
    setEntries((prev) => [...newEntries, ...prev])
    if (!user) return
    try {
      await insertEntries(user.id, newEntries)
    } catch (err) {
      console.error(err)
      setMessage('インポートしたデータのアップロードに失敗しました。' + NETWORK_ERROR_MSG)
    }
  }

  // One-time helper: pulls whatever this browser had saved locally
  // (from before the cloud migration) and uploads it, skipping any
  // entry whose id is already present in the cloud.
  const handleMigrateLocal = async () => {
    if (!user) return
    const localEntries = loadLocalEntries(user.id)
    const localMap = loadLocalCategoryMap(user.id)
    if (localEntries.length === 0) {
      setMessage('このブラウザには移行できるローカルデータが見つかりませんでした。')
      return
    }
    const existingIds = new Set(entries.map((e) => e.id))
    const toUpload = localEntries.filter((e) => !existingIds.has(e.id))
    try {
      if (toUpload.length > 0) {
        await insertEntries(user.id, toUpload)
        setEntries((prev) =>
          [...toUpload, ...prev].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
        )
      }
      const mergedMap: CategoryMap = { ...categoryMap }
      Object.entries(localMap).forEach(([cat, subs]) => {
        mergedMap[cat] = Array.from(new Set([...(mergedMap[cat] ?? []), ...subs]))
      })
      setCategoryMap(mergedMap)
      await saveCategoryMapRemote(user.id, mergedMap)
      setMessage(
        toUpload.length > 0
          ? `${toUpload.length} 件のデータをクラウドに移行しました。`
          : 'このブラウザのデータはすでにクラウドに反映済みでした。',
      )
    } catch (err) {
      console.error(err)
      setMessage('移行中にエラーが発生しました。' + NETWORK_ERROR_MSG)
    }
  }

  const handleStartEdit = (entry: KakeiboEntry) => {
    setEditingEntry(entry)
    setPage('home')
  }
  const handleSelectDate = (date: string) => {
    setPresetDate(date)
    setEditingEntry(null)
    setCameFromCalendar(true)
    setPage('home')
  }
  const handleHomeCancelled = () => {
    if (cameFromCalendar) {
      setCameFromCalendar(false)
      setPage('calendar')
    }
  }
  const handleNav = (id: PageId) => {
    if (id !== 'home') setCameFromCalendar(false)
    setPage(id)
  }

  const handleClearAll = async () => {
    if (!window.confirm('保存されているすべての家計簿データを削除しますか？\nこの操作は元に戻せません。')) return
    const previous = entries
    setEntries([])
    if (user) {
      try {
        await deleteAllEntries(user.id)
      } catch (err) {
        console.error(err)
        setEntries(previous)
        setMessage(NETWORK_ERROR_MSG)
        return
      }
    }
    setMessage('すべてのデータを削除しました。')
  }

  const handleCategoryMapChange = (map: CategoryMap) => {
    setCategoryMap(map)
    if (!user) return
    saveCategoryMapRemote(user.id, map).catch((err) => {
      console.error(err)
      setMessage(NETWORK_ERROR_MSG)
    })
  }

  const handleLogout = async () => {
    if (!window.confirm('ログアウトしますか？')) return
    await supabase.auth.signOut()
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
        <img src={dogImg} alt="" className="header-dog" aria-hidden="true" />
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
      {dataLoadError && (
        <div className="notification" onClick={() => setDataLoadError('')} role="status">
          {dataLoadError}
        </div>
      )}

      {/* ===== Page Content ===== */}
      <main className="main-content">
        {dataLoading ? (
          <div className="page-loading">読み込み中…</div>
        ) : (
          <>
            {page === 'home' && (
              <Home
                onAdd={handleAdd}
                onUpdate={handleUpdate}
                categoryMap={categoryMap}
                sortedCategories={sortedCategories}
                descriptions={descriptions}
                entries={entries}
                onDelete={handleDelete}
                editingEntry={editingEntry}
                onStartEdit={handleStartEdit}
                onEndEdit={() => setEditingEntry(null)}
                presetDate={presetDate}
                onPresetConsumed={() => setPresetDate(null)}
                onCancelled={handleHomeCancelled}
                setMessage={setMessage}
              />
            )}
            {page === 'calendar' && (
              <Calendar entries={entries} onSelectDate={handleSelectDate} />
            )}
            {page === 'history' && (
              <History entries={entries} onDelete={handleDelete} onEdit={handleStartEdit} />
            )}
            {page === 'stats' && (
              <Stats entries={entries} />
            )}
            {page === 'data' && (
              <Data
                entries={entries}
                categoryMap={categoryMap}
                userEmail={user.email ?? null}
                onImport={handleImport}
                onCategoryMapChange={handleCategoryMapChange}
                onClearAll={handleClearAll}
                onMigrateLocal={handleMigrateLocal}
                setMessage={setMessage}
              />
            )}
          </>
        )}
      </main>

      {/* ===== Bottom Navigation ===== */}
      <nav className="nav-bar">
        {NAV.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            className={`nav-item ${page === id ? 'active' : ''}`}
            onClick={() => handleNav(id)}
          >
            <span className="nav-icon">{icon}</span>
            <span className="nav-label">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
