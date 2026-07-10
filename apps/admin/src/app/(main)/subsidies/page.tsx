'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { fetchProjects, formatAmount, type DbProject } from '@/lib/db'

const STATUS_META: Record<DbProject['status'], { label: string; cls: string }> = {
  planning:    { label: '準備中',     cls: 'bg-slate-100 text-slate-600' },
  in_progress: { label: '申請準備中', cls: 'bg-amber-100 text-amber-700' },
  submitted:   { label: '申請済み',   cls: 'bg-indigo-100 text-indigo-700' },
  accepted:    { label: '採択',       cls: 'bg-emerald-100 text-emerald-700' },
  rejected:    { label: '不採択',     cls: 'bg-rose-100 text-rose-700' },
  completed:   { label: '完了',       cls: 'bg-slate-100 text-slate-500' },
}

const FILTERS = [
  { key: '',            label: 'すべて' },
  { key: 'planning',    label: '準備中' },
  { key: 'in_progress', label: '申請準備中' },
  { key: 'submitted',   label: '申請済み' },
  { key: 'accepted',    label: '採択' },
] as const

export default function SubsidiesPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<DbProject[]>([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('')

  useEffect(() => {
    fetchProjects().then(setProjects).finally(() => setLoading(false))
  }, [])

  const filtered = filter ? projects.filter(p => p.status === filter) : projects
  const accepted = projects.filter(p => p.status === 'accepted')
  const inFlight = projects.filter(p => p.status === 'submitted')
  const active   = projects.filter(p => !['accepted', 'rejected', 'completed'].includes(p.status))
  const total    = projects.reduce((sum, p) => sum + (p.applied_amount ?? 0), 0)

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader title="補助金管理" description="申請状況の一覧・進捗管理" />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: '進行中の申請', value: `${active.length}件`,   color: 'text-slate-900' },
          { label: '審査待ち',     value: `${inFlight.length}件`, color: 'text-indigo-600' },
          { label: '採択済み',     value: `${accepted.length}件`, color: 'text-emerald-600' },
          { label: '申請総額',     value: formatAmount(total),    color: 'text-slate-900' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={`mt-1 text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

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
            {loading && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">読み込み中...</td></tr>
            )}
            {!loading && filtered.map(p => {
              const st = STATUS_META[p.status]
              return (
                <tr
                  key={p.id}
                  onClick={() => router.push(`/projects/${p.id}`)}
                  className="cursor-pointer border-b border-slate-50 transition-colors hover:bg-slate-50/60"
                >
                  <td className="px-4 py-3 font-medium text-slate-900">{p.title}</td>
                  <td className="px-4 py-3 text-slate-700">{p.customers?.company_name ?? '—'}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{formatAmount(p.applied_amount)}</td>
                  <td className="px-4 py-3 text-slate-500">{p.deadline ?? '—'}</td>
                  <td className="px-4 py-3"><span className={`badge ${st.cls}`}>{st.label}</span></td>
                  <td className="px-4 py-3 text-slate-700">{p.profiles?.full_name ?? '—'}</td>
                </tr>
              )
            })}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                案件がありません。「案件管理」から登録してください。
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
