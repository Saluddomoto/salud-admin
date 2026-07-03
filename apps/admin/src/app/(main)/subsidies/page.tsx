'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { mockProjects, type ProjectColumn } from '@/lib/mock-data'

const STATUS_META: Record<ProjectColumn, { label: string; cls: string }> = {
  planning:    { label: '準備中',     cls: 'bg-slate-100 text-slate-600' },
  in_progress: { label: '申請準備中', cls: 'bg-amber-100 text-amber-700' },
  submitted:   { label: '申請済み',   cls: 'bg-indigo-100 text-indigo-700' },
  accepted:    { label: '採択',       cls: 'bg-emerald-100 text-emerald-700' },
}

const FILTERS: { key: '' | ProjectColumn; label: string }[] = [
  { key: '',            label: 'すべて' },
  { key: 'planning',    label: '準備中' },
  { key: 'in_progress', label: '申請準備中' },
  { key: 'submitted',   label: '申請済み' },
  { key: 'accepted',    label: '採択' },
]

export default function SubsidiesPage() {
  const [filter, setFilter] = useState<'' | ProjectColumn>('')

  const filtered = filter ? mockProjects.filter(p => p.status === filter) : mockProjects
  const accepted = mockProjects.filter(p => p.status === 'accepted').length
  const inFlight = mockProjects.filter(p => p.status === 'submitted').length

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="補助金管理" description="申請状況の一覧・進捗管理">
        <button className="btn-primary text-sm">+ 申請を登録</button>
      </PageHeader>

      {/* サマリー */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '進行中の申請', value: `${mockProjects.length - accepted}件`, color: 'text-slate-900' },
          { label: '審査待ち',     value: `${inFlight}件`,  color: 'text-indigo-600' },
          { label: '採択済み',     value: `${accepted}件`,  color: 'text-emerald-600' },
          { label: '申請総額',     value: '¥6,200万',       color: 'text-slate-900' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={`mt-1 text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* フィルター */}
      <div className="flex gap-2">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === f.key
                ? 'bg-brand-600 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* テーブル */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-3 font-medium">案件名</th>
              <th className="px-4 py-3 font-medium">顧客</th>
              <th className="px-4 py-3 font-medium">申請額</th>
              <th className="px-4 py-3 font-medium">期限</th>
              <th className="px-4 py-3 font-medium">ステータス</th>
              <th className="px-4 py-3 font-medium">担当</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const st = STATUS_META[p.status]
              return (
                <tr key={p.id} className="cursor-pointer border-b border-slate-50 transition-colors hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-slate-900">{p.title}</td>
                  <td className="px-4 py-3 text-slate-700">{p.customer}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{p.amount}</td>
                  <td className="px-4 py-3 text-slate-500">{p.deadline}</td>
                  <td className="px-4 py-3"><span className={`badge ${st.cls}`}>{st.label}</span></td>
                  <td className="px-4 py-3 text-slate-700">{p.assignee}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
