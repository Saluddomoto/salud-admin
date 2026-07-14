'use client'

import { useEffect, useRef, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { fetchMessages, markMessageRead, markMessageReplied, dismissMessage, type DbMessage } from '@/lib/db'

const SWIPE_DISMISS_THRESHOLD = 80

const CHANNEL_META: Record<DbMessage['channel'], { label: string; cls: string }> = {
  line:  { label: 'LINE',   cls: 'bg-emerald-100 text-emerald-700' },
  email: { label: 'メール', cls: 'bg-blue-100 text-blue-700' },
  web:   { label: 'Web',    cls: 'bg-purple-100 text-purple-700' },
}

const CONVERTED_META = {
  project: { label: '案件に変換済み',   cls: 'bg-brand-100 text-brand-700' },
  task:    { label: 'タスクに変換済み', cls: 'bg-amber-100 text-amber-700' },
  event:   { label: '予定に変換済み',   cls: 'bg-indigo-100 text-indigo-700' },
} as const

function formatReceivedAt(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toTimeString().slice(0, 5)
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return '昨日'
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function InboxPage() {
  const [messages, setMessages] = useState<DbMessage[]>([])
  const [loading,  setLoading]  = useState(true)
  const [channel,  setChannel]  = useState('')
  const [status,   setStatus]   = useState('')
  const [swipeX,   setSwipeX]   = useState<Record<string, number>>({})
  const touchStartX = useRef<Record<string, number>>({})

  useEffect(() => {
    const load = () => fetchMessages().then(setMessages).finally(() => setLoading(false))
    load()
    // 別端末での操作を反映するため、画面に戻ってきたら再取得して連動させる
    const onFocus = () => { if (document.visibilityState === 'visible') fetchMessages().then(setMessages).catch(() => {}) }
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  const handleRead = async (m: DbMessage) => {
    if (m.is_read) return
    setMessages(prev => prev.map(x => x.id === m.id ? { ...x, is_read: true } : x))
    try {
      await markMessageRead(m.id)
    } catch {
      setMessages(prev => prev.map(x => x.id === m.id ? { ...x, is_read: false } : x))
    }
  }

  const handleReplied = async (m: DbMessage) => {
    setMessages(prev => prev.map(x => x.id === m.id ? { ...x, needs_reply: false, is_read: true } : x))
    try {
      await markMessageReplied(m.id)
    } catch {
      setMessages(prev => prev.map(x => x.id === m.id ? { ...x, needs_reply: m.needs_reply, is_read: m.is_read } : x))
    }
  }

  const handleDismiss = async (m: DbMessage) => {
    setMessages(prev => prev.filter(x => x.id !== m.id))
    try {
      await dismissMessage(m.id)
    } catch {
      setMessages(prev => [...prev, m].sort((a, b) => b.received_at.localeCompare(a.received_at)))
    }
  }

  const handleTouchStart = (id: string, e: React.TouchEvent) => {
    touchStartX.current[id] = e.touches[0]!.clientX
  }

  const handleTouchMove = (id: string, e: React.TouchEvent) => {
    const start = touchStartX.current[id]
    if (start == null) return
    const dx = e.touches[0]!.clientX - start
    setSwipeX(prev => ({ ...prev, [id]: Math.min(0, dx) }))
  }

  const handleTouchEnd = (m: DbMessage) => {
    const dx = swipeX[m.id] ?? 0
    delete touchStartX.current[m.id]
    if (dx <= -SWIPE_DISMISS_THRESHOLD) {
      handleDismiss(m)
    }
    setSwipeX(prev => {
      const next = { ...prev }
      delete next[m.id]
      return next
    })
  }

  const filtered = messages.filter(m => {
    if (channel && m.channel !== channel) return false
    if (status === 'needs_reply' && !m.needs_reply) return false
    if (status === 'unread'    && (m.is_read || m.converted_to)) return false
    if (status === 'converted' && !m.converted_to) return false
    if (status === 'read'      && (!m.is_read || m.converted_to)) return false
    return true
  })

  const unread     = messages.filter(m => !m.is_read && !m.converted_to).length
  const needsReply = messages.filter(m => m.needs_reply).length

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader title="受信トレイ" description={`未対応 ${unread} 件 · 要返信 ${needsReply} 件`}>
        <select className="input w-36 text-sm" value={channel} onChange={e => setChannel(e.target.value)}>
          <option value="">全チャネル</option>
          <option value="line">LINE</option>
          <option value="email">メール</option>
          <option value="web">Webフォーム</option>
        </select>
        <select className="input w-36 text-sm" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">全ステータス</option>
          <option value="needs_reply">要返信</option>
          <option value="unread">未対応</option>
          <option value="converted">変換済み</option>
          <option value="read">既読</option>
        </select>
      </PageHeader>

      <div className="card divide-y divide-slate-50 overflow-hidden">
        {loading && (
          <p className="p-12 text-center text-sm text-slate-400">読み込み中...</p>
        )}
        {!loading && filtered.map(m => {
          const dx = swipeX[m.id] ?? 0
          return (
          <div key={m.id} className="relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-end bg-rose-500 px-5 text-sm font-medium text-white">
              消す
            </div>
            <div
              onClick={() => handleRead(m)}
              onTouchStart={e => handleTouchStart(m.id, e)}
              onTouchMove={e => handleTouchMove(m.id, e)}
              onTouchEnd={() => handleTouchEnd(m)}
              style={{ transform: `translateX(${dx}px)`, transition: dx === 0 ? 'transform 0.2s ease' : 'none' }}
              className={`group relative flex cursor-pointer items-start gap-4 bg-white p-4 transition-colors hover:bg-slate-50/60 ${
                !m.is_read && !m.converted_to ? 'bg-brand-50/40' : ''
              }`}
            >
              <span className={`badge mt-0.5 flex-shrink-0 ${CHANNEL_META[m.channel].cls}`}>
                {CHANNEL_META[m.channel].label}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className={`text-sm ${!m.is_read && !m.converted_to ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                    {m.sender_name}
                  </p>
                  <p className="text-xs text-slate-400">{m.company_name ?? '—'}</p>
                  {m.needs_reply && (
                    <span className="badge bg-rose-100 text-xs text-rose-700">要返信</span>
                  )}
                  {m.converted_to && (
                    <span className={`badge text-xs ${CONVERTED_META[m.converted_to].cls}`}>
                      {CONVERTED_META[m.converted_to].label}
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-sm text-slate-500">{m.body}</p>
              </div>
              <div className="flex flex-shrink-0 flex-col items-end gap-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={e => { e.stopPropagation(); handleDismiss(m) }}
                    title="消す"
                    className="hidden rounded-lg p-1 text-slate-300 opacity-0 transition-colors hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 md:block"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                  <span className="text-xs text-slate-400">{formatReceivedAt(m.received_at)}</span>
                </div>
                {m.needs_reply ? (
                  <button
                    onClick={e => { e.stopPropagation(); handleReplied(m) }}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 transition-colors hover:border-emerald-300 hover:text-emerald-600"
                  >
                    返信済みにする
                  </button>
                ) : (
                  !m.is_read && !m.converted_to && <span className="h-2 w-2 rounded-full bg-brand-500" />
                )}
              </div>
            </div>
          </div>
          )
        })}
        {!loading && filtered.length === 0 && (
          <p className="p-12 text-center text-sm text-slate-400">該当するメッセージがありません</p>
        )}
      </div>
    </div>
  )
}
