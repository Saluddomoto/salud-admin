'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { mockTasks } from '@/lib/mock-data'

const COLUMNS = [
  { key: 'todo',        label: '未着手', dot: 'bg-slate-400' },
  { key: 'in_progress', label: '進行中', dot: 'bg-amber-500' },
  { key: 'done',        label: '完了',   dot: 'bg-emerald-500' },
] as const

const PRIORITY_CLS = {
  '高': 'bg-rose-100 text-rose-700',
  '中': 'bg-amber-100 text-amber-700',
  '低': 'bg-slate-100 text-slate-500',
} as const

export default function TasksPage() {
  const [assignee, setAssignee] = useState('')
  const assignees = [...new Set(mockTasks.map(t => t.assignee))]

  const filtered = assignee ? mockTasks.filter(t => t.assignee === assignee) : mockTasks
  const doneCount = mockTasks.filter(t => t.status === 'done').length

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <PageHeader title="タスク管理" description={`${doneCount}/${mockTasks.length} 件完了`}>
        <select className="input w-36 text-sm" value={assignee} onChange={e => setAssignee(e.target.value)}>
          <option value="">全担当者</option>
          {assignees.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <button className="btn-primary text-sm">+ タスクを追加</button>
      </PageHeader>

      <div className="grid flex-1 grid-cols-3 gap-4">
        {COLUMNS.map(col => {
          const items = filtered.filter(t => t.status === col.key)
          return (
            <div key={col.key} className="flex flex-col rounded-2xl bg-slate-50/80 p-3">
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                <h3 className="text-sm font-semibold text-slate-700">{col.label}</h3>
                <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">{items.length}</span>
              </div>
              <div className="flex flex-col gap-2.5">
                {items.map(t => (
                  <div key={t.id} className="card cursor-pointer p-3.5 transition-shadow hover:shadow-md">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium leading-snug ${t.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                        {t.title}
                      </p>
                      <span className={`badge flex-shrink-0 text-xs ${PRIORITY_CLS[t.priority]}`}>{t.priority}</span>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-400">{t.related}</p>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-50 pt-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">
                          {t.assignee[0]}
                        </span>
                        <span className="text-xs text-slate-500">{t.assignee}</span>
                      </div>
                      <span className="text-xs text-slate-400">〆 {t.due.slice(5).replace('-', '/')}</span>
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="py-8 text-center text-xs text-slate-300">タスクなし</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
