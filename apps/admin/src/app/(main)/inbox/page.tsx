'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { fetchMessages, markMessageRead, type DbMessage } from '@/lib/db'

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

  useEffect(() => {
    fetchMessages().then(setMessages).finally(() => setLoading(false))
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

  const filtered = messages.filter(m => {
    if (channel && m.channel !== channel) return false
    if (status === 'unread'    && (m.is_read || m.converted_to)) return false
    if (status === 'converted' && !m.converted_to) return false
    if (status === 'read'      && (!m.is_read || m.converted_to)) return false
    return true
  })

  const unread = messages.filter(m => !m.is_read && !m.converted_to).length

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="受信トレイ" description={`未対応 ${unread} 件`}>
        <select className="input w-36 text-sm" value={channel} onChange={e => setChannel(e.target.value)}>
          <option value="">全チャネル</option>
          <option value="line">LINE</option>
          <option value="email">メール</option>
          <option value="web">Webフォーム</option>
        </select>
        <select className="input w-36 text-sm" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">全ステータス</option>
          <option value="unread">未対応</option>
          <option value="converted">変換済み</option>
          <option value="read">既読</option>
        </select>
      </PageHeader>

      <div className="card divide-y divide-slate-50 overflow-hidden">
        {loading && (
          <p className="p-12 text-center text-sm text-slate-400">読み込み中...</p>
        )}
        {!loading && filtered.map(m => (
          <div
            key={m.id}
            onClick={() => handleRead(m)}
            className={`flex cursor-pointer items-start gap-4 p-4 transition-colors hover:bg-slate-50/60 ${
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
                {m.converted_to && (
                  <span className={`badge text-xs ${CONVERTED_META[m.converted_to].cls}`}>
                    {CONVERTED_META[m.converted_to].label}
                  </span>
                )}
              </div>
              <p className="mt-1 truncate text-sm text-slate-500">{m.body}</p>
            </div>
            <div className="flex flex-shrink-0 flex-col items-end gap-2">
              <span className="text-xs text-slate-400">{formatReceivedAt(m.received_at)}</span>
              {!m.is_read && !m.converted_to && <span className="h-2 w-2 rounded-full bg-brand-500" />}
            </div>
          </div>
        ))}
        {!loading && filtered.length === 0 && (
          <p className="p-12 text-center text-sm text-slate-400">該当するメッセージがありません</p>
        )}
      </div>
    </div>
  )
}
