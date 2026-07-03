'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { mockProjects, type ProjectColumn } from '@/lib/mock-data'

const COLUMNS: { key: ProjectColumn; label: string; dot: string }[] = [
  { key: 'planning',    label: '準備中',     dot: 'bg-slate-400' },
  { key: 'in_progress', label: '申請準備中', dot: 'bg-amber-500' },
  { key: 'submitted',   label: '申請済み',   dot: 'bg-indigo-500' },
  { key: 'accepted',    label: '採択',       dot: 'bg-emerald-500' },
]

const PRIORITY_CLS = {
  '高': 'bg-rose-100 text-rose-700',
  '中': 'bg-amber-100 text-amber-700',
  '低': 'bg-slate-100 text-slate-500',
} as const

export default function ProjectsPage() {
  const [assignee, setAssignee] = useState('')
  const assignees = [...new Set(mockProjects.map(p => p.assignee))]

  const filtered = assignee
    ? mockProjects.filter(p => p.assignee === assignee)
    : mockProjects

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <PageHeader title="案件管理" description={`進行中 ${mockProjects.length} 件`}>
        <select className="input w-36 text-sm" value={assignee} onChange={e => setAssignee(e.target.value)}>
          <option value="">全担当者</option>
          {assignees.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <button className="btn-primary text-sm">+ 新規案件</button>
      </PageHeader>

      {/* カンバン */}
      <div className="grid flex-1 grid-cols-4 gap-4">
        {COLUMNS.map(col => {
          const items = filtered.filter(p => p.status === col.key)
          return (
            <div key={col.key} className="flex flex-col rounded-2xl bg-slate-50/80 p-3">
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                <h3 className="text-sm font-semibold text-slate-700">{col.label}</h3>
                <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">{items.length}</span>
              </div>
              <div className="flex flex-col gap-2.5">
                {items.map(p => (
                  <div key={p.id} className="card cursor-pointer p-3.5 transition-shadow hover:shadow-md">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold leading-snug text-slate-900">{p.title}</p>
                      <span className={`badge flex-shrink-0 text-xs ${PRIORITY_CLS[p.priority]}`}>{p.priority}</span>
                    </div>
                    <p className="text-xs text-slate-500">{p.customer}</p>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">{p.amount}</span>
                      <span className="text-slate-400">〆 {p.deadline.slice(5).replace('-', '/')}</span>
                    </div>
                    <div className="mt-2.5 flex items-center gap-1.5 border-t border-slate-50 pt-2.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">
                        {p.assignee[0]}
                      </span>
                      <span className="text-xs text-slate-500">{p.assignee}</span>
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="py-8 text-center text-xs text-slate-300">案件なし</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
