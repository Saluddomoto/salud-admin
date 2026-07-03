'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { mockEvents } from '@/lib/mock-data'

// 2026-06-29(月) 週から表示
const WEEK_DAYS = ['月', '火', '水', '木', '金', '土', '日']
const WEEK_DATES = ['2026-06-29', '2026-06-30', '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05']
const TODAY = '2026-07-03'

const CATEGORY_CLS = {
  '商談': 'bg-amber-100 text-amber-700',
  '面談': 'bg-indigo-100 text-indigo-700',
  '締切': 'bg-rose-100 text-rose-700',
  '社内': 'bg-slate-100 text-slate-600',
} as const

export default function SchedulePage() {
  const [category, setCategory] = useState('')
  const [assignee, setAssignee] = useState('')

  const assignees = [...new Set(mockEvents.map(e => e.assignee))]

  const filtered = mockEvents.filter(e => {
    if (category && e.category !== category) return false
    if (assignee && e.assignee !== assignee) return false
    return true
  })

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="スケジュール" description="2026年6月29日 〜 7月5日">
        <select className="input w-32 text-sm" value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">全カテゴリ</option>
          {Object.keys(CATEGORY_CLS).map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input w-32 text-sm" value={assignee} onChange={e => setAssignee(e.target.value)}>
          <option value="">全員</option>
          {assignees.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <button className="btn-primary text-sm">+ 予定を追加</button>
      </PageHeader>

      {/* 週カレンダー */}
      <div className="card grid grid-cols-7 divide-x divide-slate-100 overflow-hidden">
        {WEEK_DATES.map((date, i) => {
          const dayEvents = filtered
            .filter(e => e.date === date)
            .sort((a, b) => a.start.localeCompare(b.start))
          const isToday = date === TODAY
          const isWeekend = i >= 5

          return (
            <div key={date} className={`min-h-[420px] ${isToday ? 'bg-brand-50/50' : isWeekend ? 'bg-slate-50/50' : ''}`}>
              <div className={`border-b border-slate-100 px-3 py-2.5 text-center ${isToday ? 'bg-brand-600 text-white' : ''}`}>
                <p className={`text-xs ${isToday ? 'text-brand-100' : 'text-slate-400'}`}>{WEEK_DAYS[i]}</p>
                <p className={`text-lg font-bold ${isToday ? 'text-white' : isWeekend ? 'text-slate-400' : 'text-slate-800'}`}>
                  {parseInt(date.slice(8), 10)}
                </p>
              </div>
              <div className="flex flex-col gap-1.5 p-2">
                {dayEvents.map(e => (
                  <div
                    key={e.id}
                    className="cursor-pointer rounded-lg border-l-[3px] bg-white p-2 shadow-sm transition-shadow hover:shadow"
                    style={{ borderLeftColor: e.color }}
                  >
                    <p className="text-xs font-semibold leading-snug text-slate-800">{e.title}</p>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {e.start === e.end ? e.start : `${e.start}–${e.end}`} · {e.assignee}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* 今後の予定リスト */}
      <div className="card p-5">
        <h3 className="mb-4 font-semibold text-slate-900">今後の予定</h3>
        <div className="space-y-2">
          {filtered
            .filter(e => e.date >= TODAY)
            .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))
            .map(e => (
              <div key={e.id} className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-slate-50">
                <div className="h-10 w-1 flex-shrink-0 rounded-full" style={{ background: e.color }} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">{e.title}</p>
                  <p className="text-xs text-slate-400">
                    {e.date.slice(5).replace('-', '/')} {e.start === e.end ? e.start : `${e.start}–${e.end}`}
                  </p>
                </div>
                <span className={`badge text-xs ${CATEGORY_CLS[e.category]}`}>{e.category}</span>
                <span className="w-12 text-right text-xs text-slate-500">{e.assignee}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
