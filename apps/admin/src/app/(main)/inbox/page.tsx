'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { mockMessages } from '@/lib/mock-data'

const CHANNEL_CLS = {
  LINE:   'bg-emerald-100 text-emerald-700',
  メール: 'bg-blue-100 text-blue-700',
  Web:    'bg-purple-100 text-purple-700',
} as const

const CONVERTED_META = {
  project: { label: '案件に変換済み',   cls: 'bg-brand-100 text-brand-700' },
  task:    { label: 'タスクに変換済み', cls: 'bg-amber-100 text-amber-700' },
  event:   { label: '予定に変換済み',   cls: 'bg-indigo-100 text-indigo-700' },
} as const

export default function InboxPage() {
  const [channel, setChannel] = useState('')
  const [status,  setStatus]  = useState('')

  const filtered = mockMessages.filter(m => {
    if (channel && m.channel !== channel) return false
    if (status === 'unread'    && (m.read || m.converted)) return false
    if (status === 'converted' && !m.converted) return false
    if (status === 'read'      && (!m.read || m.converted)) return false
    return true
  })

  const unread = mockMessages.filter(m => !m.read && !m.converted).length

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="受信トレイ" description={`未対応 ${unread} 件`}>
        <select className="input w-36 text-sm" value={channel} onChange={e => setChannel(e.target.value)}>
          <option value="">全チャネル</option>
          <option value="LINE">LINE</option>
          <option value="メール">メール</option>
          <option value="Web">Webフォーム</option>
        </select>
        <select className="input w-36 text-sm" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">全ステータス</option>
          <option value="unread">未対応</option>
          <option value="converted">変換済み</option>
          <option value="read">既読</option>
        </select>
      </PageHeader>

      <div className="card divide-y divide-slate-50 overflow-hidden">
        {filtered.map(m => (
          <div
            key={m.id}
            className={`flex cursor-pointer items-start gap-4 p-4 transition-colors hover:bg-slate-50/60 ${
              !m.read && !m.converted ? 'bg-brand-50/40' : ''
            }`}
          >
            <span className={`badge mt-0.5 flex-shrink-0 ${CHANNEL_CLS[m.channel]}`}>{m.channel}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className={`text-sm ${!m.read && !m.converted ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                  {m.sender}
                </p>
                <p className="text-xs text-slate-400">{m.company}</p>
                {m.converted && (
                  <span className={`badge text-xs ${CONVERTED_META[m.converted].cls}`}>
                    {CONVERTED_META[m.converted].label}
                  </span>
                )}
              </div>
              <p className="mt-1 truncate text-sm text-slate-500">{m.preview}</p>
            </div>
            <div className="flex flex-shrink-0 flex-col items-end gap-2">
              <span className="text-xs text-slate-400">{m.receivedAt}</span>
              {!m.read && !m.converted && <span className="h-2 w-2 rounded-full bg-brand-500" />}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="p-12 text-center text-sm text-slate-400">該当するメッセージがありません</p>
        )}
      </div>
    </div>
  )
}
