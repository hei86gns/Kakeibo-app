import { useState } from 'react'
import { supabase } from '../supabase'
import dogImg from '../assets/dog.png'

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [resetSent, setResetSent] = useState(false)

  const handleLogin = async () => {
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) setError('メールアドレスまたはパスワードが正しくありません。')
  }

  const handleResetPassword = async () => {
    if (!email) { setError('メールアドレスを入力してからリセットしてください。'); return }
    setLoading(true)
    const redirectTo = `${window.location.origin}/Kakeibo-app/`
    await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    setLoading(false)
    setResetSent(true)
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-header">
          <img src={dogImg} alt="" className="login-dog" aria-hidden="true" />
          <h1 className="login-title">Kakeibo</h1>
          <p className="login-sub">ログインしてください</p>
        </div>

        {resetSent ? (
          <div className="login-reset-msg">
            パスワードリセットのメールを送信しました。<br />
            メールを確認してください。
          </div>
        ) : (
          <>
            <div className="login-fields">
              <label className="field-label">
                メールアドレス
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="field-input"
                  autoComplete="email"
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
              </label>
              <label className="field-label">
                パスワード
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="パスワード"
                  className="field-input"
                  autoComplete="current-password"
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
              </label>
            </div>

            {error && <p className="login-error">{error}</p>}

            <button
              type="button"
              className="btn-primary login-btn"
              onClick={handleLogin}
              disabled={loading || !email || !password}
            >
              {loading ? 'ログイン中…' : 'ログイン'}
            </button>

            <button
              type="button"
              className="login-reset-link"
              onClick={handleResetPassword}
              disabled={loading}
            >
              パスワードを忘れた場合はこちら
            </button>
          </>
        )}
      </div>
    </div>
  )
}
