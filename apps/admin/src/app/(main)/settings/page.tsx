'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { useAuth } from '@/hooks/useAuth'
import { fetchMyProfile, fetchProfiles, updateMyProfile, type DbProfile } from '@/lib/db'

const TABS = [
  { key: 'profile',       label: 'プロフィール' },
  { key: 'members',       label: 'メンバー管理' },
  { key: 'notifications', label: '通知設定' },
  { key: 'security',      label: 'セキュリティ' },
  { key: 'integrations',  label: '連携サービス' },
] as const

type TabKey = (typeof TABS)[number]['key']

const ROLE_META = {
  admin:   { label: '管理者',       cls: 'bg-brand-100 text-brand-700' },
  manager: { label: 'マネージャー', cls: 'bg-indigo-100 text-indigo-700' },
  staff:   { label: '一般',         cls: 'bg-slate-100 text-slate-600' },
} as const

type GoogleState = {
  connected: boolean
  calendar_id?: string | null
  calendar_name?: string | null
  last_synced_at?: string | null
  calendars?: { id: string; summary: string }[]
}

export default function SettingsPage() {
  const [tab, setTab] = useState<TabKey>('profile')
  const { user } = useAuth()
  const [me,         setMe]         = useState<DbProfile | null>(null)
  const [members,    setMembers]    = useState<DbProfile[]>([])
  const [fullName,   setFullName]   = useState('')
  const [department, setDepartment] = useState('')
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)

  const [google,        setGoogle]        = useState<GoogleState | null>(null)
  const [googleBusy,    setGoogleBusy]    = useState(false)

  const loadGoogle = () => {
    fetch('/api/google/state').then(r => r.json()).then(setGoogle).catch(() => setGoogle({ connected: false }))
  }

  useEffect(() => {
    fetchMyProfile().then(p => {
      setMe(p)
      setFullName(p?.full_name ?? '')
      setDepartment(p?.department ?? '')
    })
    fetchProfiles().then(setMembers).catch(() => setMembers([]))
    loadGoogle()
    // Google 認証から戻ってきた場合は連携サービスタブを開く
    if (new URLSearchParams(window.location.search).get('google')) setTab('integrations')
  }, [])

  const selectCalendar = async (calendar_id: string, calendar_name: string) => {
    setGoogleBusy(true)
    try {
      await fetch('/api/google/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'select', calendar_id, calendar_name }),
      })
      await fetch('/api/google/sync?force=1')
      loadGoogle()
    } finally {
      setGoogleBusy(false)
    }
  }

  const disconnectGoogle = async () => {
    if (!confirm('Google カレンダー連携を解除しますか？\n同期された予定はスケジュールから削除されます。')) return
    setGoogleBusy(true)
    try {
      await fetch('/api/google/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      })
      loadGoogle()
    } finally {
      setGoogleBusy(false)
    }
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    setSaved(false)
    try {
      await updateMyProfile({ full_name: fullName, department: department || null })
      setSaved(true)
    } catch (e) {
      alert(`保存に失敗しました: ${e instanceof Error ? e.message : e}`)
    } finally {
      setSaving(false)
    }
  }

  const myRole = ROLE_META[(me?.role ?? 'staff') as keyof typeof ROLE_META]

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="設定" description="アカウント・組織の設定" />

      <div className="grid grid-cols-[200px_1fr] gap-6">
        {/* 左ナビ */}
        <nav className="flex flex-col gap-1">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {/* パネル */}
        <div>
          {tab === 'profile' && (
            <div className="card space-y-4 p-6">
              <h3 className="font-semibold text-slate-900">プロフィール</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">氏名</label>
                  <input className="input" value={fullName} onChange={e => setFullName(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">メールアドレス</label>
                  <input className="input" value={user?.email ?? ''} disabled />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">部署</label>
                  <input className="input" placeholder="コンサルティング部" value={department} onChange={e => setDepartment(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">権限</label>
                  <input className="input" value={myRole.label} disabled />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                {saved && <span className="text-sm text-emerald-600">保存しました</span>}
                <button className="btn-primary text-sm" onClick={handleSaveProfile} disabled={saving || !me}>
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          )}

          {tab === 'members' && (
            <div className="card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">メンバー管理</h3>
                <button className="btn-primary text-sm">+ メンバーを招待</button>
              </div>
              <div className="divide-y divide-slate-50">
                {members.map(m => {
                  const role = ROLE_META[m.role as keyof typeof ROLE_META] ?? ROLE_META.staff
                  return (
                    <div key={m.id} className="flex items-center gap-3 py-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                        {m.full_name[0] ?? '?'}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-800">{m.full_name || '（未設定）'}</p>
                        <p className="text-xs text-slate-400">{m.department ?? '部署未設定'}</p>
                      </div>
                      {!m.is_active && <span className="badge bg-slate-100 text-xs text-slate-400">停止中</span>}
                      <span className={`badge text-xs ${role.cls}`}>{role.label}</span>
                    </div>
                  )
                })}
                {members.length === 0 && (
                  <p className="py-8 text-center text-sm text-slate-400">
                    メンバー一覧を表示する権限がありません
                  </p>
                )}
              </div>
            </div>
          )}

          {tab === 'notifications' && (
            <div className="card space-y-1 p-6">
              <h3 className="mb-4 font-semibold text-slate-900">通知設定</h3>
              {[
                { label: '申請期限アラート（14日前）', checked: true },
                { label: '新規問い合わせの通知',       checked: true },
                { label: 'タスク期限のリマインド',     checked: true },
                { label: '採択・不採択の結果通知',     checked: true },
                { label: '週次サマリーメール',         checked: false },
              ].map(n => (
                <label key={n.label} className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-3 transition-colors hover:bg-slate-50">
                  <span className="text-sm text-slate-700">{n.label}</span>
                  <input type="checkbox" defaultChecked={n.checked} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
                </label>
              ))}
            </div>
          )}

          {tab === 'security' && (
            <div className="space-y-4">
              <div className="card space-y-4 p-6">
                <h3 className="font-semibold text-slate-900">パスワード変更</h3>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">現在のパスワード</label>
                  <input type="password" className="input max-w-sm" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">新しいパスワード</label>
                  <input type="password" className="input max-w-sm" />
                </div>
                <button className="btn-primary text-sm">パスワードを変更</button>
              </div>
              <div className="card p-6">
                <h3 className="mb-2 font-semibold text-slate-900">ログイン情報</h3>
                <p className="text-sm text-slate-500">
                  最終ログイン: {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('ja-JP') : '—'}
                </p>
              </div>
            </div>
          )}

          {tab === 'integrations' && (
            <div className="card divide-y divide-slate-50 p-6">
              <h3 className="pb-4 font-semibold text-slate-900">連携サービス</h3>

              {/* LINE */}
              <div className="flex items-center gap-4 py-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">LINE 公式アカウント「補助金の窓口」</p>
                  <p className="text-xs text-slate-400">顧客メッセージの受信・予定登録・毎朝のダイジェスト配信</p>
                </div>
                <span className="badge bg-emerald-100 text-xs text-emerald-700">接続済み</span>
              </div>

              {/* Google カレンダー */}
              <div className="py-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800">Google カレンダー</p>
                    <p className="text-xs text-slate-400">
                      選択した仕事用カレンダーの予定をスケジュールに自動反映（他のカレンダーは読みません）
                    </p>
                  </div>
                  {google?.connected ? (
                    <>
                      <span className="badge bg-emerald-100 text-xs text-emerald-700">接続済み</span>
                      <button className="btn-secondary text-xs" disabled={googleBusy} onClick={disconnectGoogle}>解除</button>
                    </>
                  ) : (
                    <a href="/api/google/auth" className="btn-secondary text-xs">接続する</a>
                  )}
                </div>
                {google?.connected && (
                  <div className="mt-3 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                    <label className="text-xs font-medium text-slate-600">同期するカレンダー:</label>
                    <select
                      className="input w-64 text-sm"
                      disabled={googleBusy}
                      value={google.calendar_id ?? ''}
                      onChange={e => {
                        const cal = google.calendars?.find(c => c.id === e.target.value)
                        if (cal) selectCalendar(cal.id, cal.summary)
                      }}
                    >
                      <option value="">選択してください</option>
                      {(google.calendars ?? []).map(c => (
                        <option key={c.id} value={c.id}>{c.summary}</option>
                      ))}
                    </select>
                    {googleBusy && <span className="text-xs text-slate-400">同期中...</span>}
                    {!googleBusy && google.calendar_id && (
                      <span className="text-xs text-emerald-600">
                        「{google.calendar_name}」を同期中 ✓
                      </span>
                    )}
                  </div>
                )}
                {google?.connected && !google.calendar_id && (
                  <p className="mt-2 text-xs text-amber-600">
                    ⚠ 仕事用カレンダーを選択すると同期が始まります。プライベート用と分けたい場合は、
                    Google カレンダー側で仕事専用のカレンダーを作成してから選んでください。
                  </p>
                )}
              </div>

              {/* Google ドライブ */}
              <div className="flex items-center gap-4 py-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">Google ドライブ</p>
                  <p className="text-xs text-slate-400">書類の自動フォルダ管理（将来）</p>
                </div>
                <span className="badge bg-slate-100 text-xs text-slate-500">未対応</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
