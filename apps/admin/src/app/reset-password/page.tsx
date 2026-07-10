'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { updateMyPassword } from '@/lib/db'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password,        setPassword]        = useState('')
  const [passwordConfirm, setPasswordConfirm]  = useState('')
  const [loading,         setLoading]          = useState(false)
  const [error,           setError]            = useState('')
  const [done,            setDone]             = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('パスワードは8文字以上にしてください')
      return
    }
    if (password !== passwordConfirm) {
      setError('確認用パスワードが一致しません')
      return
    }
    setLoading(true)
    try {
      await updateMyPassword(password)
      setDone(true)
      setTimeout(() => router.push('/'), 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'リンクの有効期限が切れている可能性があります。もう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-600 to-indigo-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">新しいパスワードを設定</h1>
          <p className="text-indigo-200 text-sm mt-1">Salud 管理システム</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {done ? (
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-slate-900">変更しました</h2>
              <p className="text-sm text-slate-500">まもなくダッシュボードに移動します...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">新しいパスワード</label>
                <input
                  type="password" required autoComplete="new-password" className="input"
                  value={password} onChange={e => setPassword(e.target.value)} placeholder="8文字以上"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">新しいパスワード（確認）</label>
                <input
                  type="password" required autoComplete="new-password" className="input"
                  value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)}
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-base">
                {loading ? '変更中...' : 'パスワードを変更する'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
