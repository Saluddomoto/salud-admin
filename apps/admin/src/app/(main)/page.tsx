'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  fetchCustomerCount, fetchEvents, fetchNeedsReplyCount, fetchProjects, fetchTasks,
  formatAmount, updateTaskStatus, type DbEvent, type DbProject, type DbTask,
} from '@/lib/db'

const EVENT_COLORS: Record<DbEvent['category'], string> = {
  sales: '#f59e0b', meeting: '#6366f1', deadline: '#ef4444', internal: '#64748b',
}

const PRIORITY_META: Record<DbTask['priority'], { label: string; cls: string }> = {
  high:   { label: '高', cls: 'bg-rose-100 text-rose-700' },
  medium: { label: '中', cls: 'bg-amber-100 text-amber-700' },
  low:    { label: '低', cls: 'bg-slate-100 text-slate-500' },
}

const ACTIVE_STATUSES: DbProject['status'][] = ['planning', 'in_progress', 'submitted']

function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function daysUntil(date: string, today: string): number {
  return Math.round((new Date(date).getTime() - new Date(today).getTime()) / 86_400_000)
}

export default function DashboardPage() {
  const [projects,      setProjects]      = useState<DbProject[]>([])
  const [tasks,         setTasks]         = useState<DbTask[]>([])
  const [events,        setEvents]        = useState<DbEvent[]>([])
  const [customerCount, setCustomerCount] = useState(0)
  const [needsReply,    setNeedsReply]    = useState(0)
  const [loading,       setLoading]       = useState(true)

  const now = new Date()
  const today = toISODate(now)

  useEffect(() => {
    Promise.all([
      fetchProjects().then(setProjects),
      fetchTasks().then(setTasks),
      fetchEvents(today, today).then(setEvents),
      fetchCustomerCount().then(setCustomerCount),
      fetchNeedsReplyCount().then(setNeedsReply).catch(() => {}),
    ]).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const active   = projects.filter(p => ACTIVE_STATUSES.includes(p.status))
  const accepted = projects.filter(p => p.status === 'accepted')
  const rejected = projects.filter(p => p.status === 'rejected')
  const totalApplied    = projects.reduce((s, p) => s + (p.applied_amount ?? 0), 0)
  const acceptedApplied = accepted.reduce((s, p) => s + (p.applied_amount ?? 0), 0)
  const decided = accepted.length + rejected.length
  const acceptRate = decided > 0 ? Math.round((accepted.length / decided) * 100) : null

  const kpiCards = [
    { label: '管理中の案件', value: `${active.length}件`, sub: `申請済み ${projects.filter(p => p.status === 'submitted').length}件`, iconBg: 'bg-brand-600' },
    { label: '申請総額',     value: formatAmount(totalApplied), sub: `採択分 ${formatAmount(acceptedApplied)}`, iconBg: 'bg-emerald-500' },
    { label: '顧客数',       value: `${customerCount}`, sub: '登録済みの顧客', iconBg: 'bg-amber-500' },
    { label: '採択実績',     value: `${accepted.length}件`, sub: acceptRate != null ? `採択率 ${acceptRate}%` : '結果待ち', iconBg: 'bg-rose-500' },
  ]

  const alerts = active
    .filter(p => p.deadline && daysUntil(p.deadline, today) >= 0 && daysUntil(p.deadline, today) <= 14)
    .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))
    .slice(0, 5)

  const todayTasks = tasks
    .filter(t => t.due_date && t.due_date <= today)
    .slice(0, 5)
  const doneCount = todayTasks.filter(t => t.status === 'done').length

  const toggleTask = async (t: DbTask) => {
    const next = t.status === 'done' ? 'todo' : 'done'
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, status: next } : x))
    try {
      await updateTaskStatus(t.id, next)
    } catch {
      setTasks(prev => prev.map(x => x.id === t.id ? { ...x, status: t.status } : x))
    }
  }

  const hour = now.getHours()
  const greeting = hour < 12 ? 'おはようございます' : hour < 18 ? 'こんにちは' : 'こんばんは'
  const dateLabel = now.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        title="ダッシュボード"
        description={`${dateLabel} — ${greeting}`}
      >
        <Link href="/subsidies" className="btn-secondary text-sm">補助金一覧</Link>
        <Link href="/projects" className="btn-primary text-sm">新規案件</Link>
      </PageHeader>

      {/* 要返信アラート */}
      {needsReply > 0 && (
        <Link
          href="/inbox"
          className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 transition-colors hover:bg-rose-100/60"
        >
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-rose-100">
            <svg className="h-5 w-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="flex-1 text-sm font-semibold text-rose-900">
            返信が必要なメッセージが {needsReply} 件あります
          </p>
          <span className="text-sm font-medium text-rose-700">受信トレイへ →</span>
        </Link>
      )}

      {/* 期限アラート */}
      {alerts.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">補助金申請期限アラート（14日以内）</p>
              <div className="mt-2 space-y-1.5">
                {alerts.map(p => {
                  const days = daysUntil(p.deadline!, today)
                  const urgent = days <= 5
                  return (
                    <div key={p.id} className="flex items-center gap-2 text-sm text-amber-800">
                      <span className={`h-2 w-2 rounded-full ${urgent ? 'bg-rose-500' : 'bg-amber-500'}`} />
                      <span className="font-medium">{p.customers?.company_name ?? '—'}</span>
                      <span className="text-amber-600">— {p.title}</span>
                      <span className={`ml-auto font-semibold ${urgent ? 'text-rose-700' : 'text-amber-700'}`}>
                        {days === 0 ? '本日締切' : `残り ${days}日`}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
            <Link href="/subsidies" className="text-sm font-medium text-amber-700 whitespace-nowrap hover:underline">
              すべて確認 →
            </Link>
          </div>
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {kpiCards.map(card => (
          <div key={card.label} className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.iconBg}`}>
                <div className="h-5 w-5 rounded bg-white/30" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{loading ? '—' : card.value}</p>
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="mt-1 text-xs text-slate-400">{loading ? '' : card.sub}</p>
          </div>
        ))}
      </div>

      {/* 下段 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 直近の案件 */}
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">期限が近い案件</h3>
            <Link href="/projects" className="text-xs font-medium text-brand-600 hover:underline">すべて見る</Link>
          </div>
          <div className="space-y-3 text-sm">
            {active.slice(0, 4).map(p => (
              <Link key={p.id} href={`/projects/${p.id}`} className="flex gap-3 rounded-lg p-1 -m-1 transition-colors hover:bg-slate-50">
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
                  <div className="h-4 w-4 rounded bg-current opacity-40" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-slate-800">{p.title}</p>
                  <p className="text-xs text-slate-400">
                    {p.customers?.company_name ?? '—'} · 期限 {p.deadline ?? '—'}
                  </p>
                </div>
              </Link>
            ))}
            {!loading && active.length === 0 && (
              <p className="py-6 text-center text-xs text-slate-400">進行中の案件はありません</p>
            )}
          </div>
        </div>

        {/* 今日の予定 */}
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">今日の予定</h3>
            <Link href="/schedule" className="text-xs font-medium text-brand-600 hover:underline">カレンダーへ →</Link>
          </div>
          <div className="space-y-2">
            {events.map(ev => (
              <div key={ev.id} className="flex items-center gap-2.5 rounded-xl p-2.5 hover:bg-slate-50">
                <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ background: EVENT_COLORS[ev.category] }} />
                <div>
                  <p className="text-sm font-medium text-slate-800">{ev.title}</p>
                  <p className="text-xs text-slate-400">
                    {ev.start_time.slice(0, 5)}–{ev.end_time.slice(0, 5)}
                  </p>
                </div>
              </div>
            ))}
            {!loading && events.length === 0 && (
              <p className="py-6 text-center text-xs text-slate-400">今日の予定はありません</p>
            )}
          </div>
        </div>

        {/* 本日のタスク */}
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">本日のタスク</h3>
            <Link href="/tasks" className="text-xs font-medium text-brand-600 hover:underline">すべて見る</Link>
          </div>
          <div className="space-y-2">
            {todayTasks.map(t => {
              const done = t.status === 'done'
              const pr = PRIORITY_META[t.priority]
              return (
                <div key={t.id} className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() => toggleTask(t)}
                    className="rounded border-slate-300 text-brand-600"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${done ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                      {t.title}
                    </p>
                    <p className={`text-xs ${done ? 'text-slate-300' : 'text-slate-400'}`}>
                      {t.projects?.title ?? '社内'} · 期限 {t.due_date}
                    </p>
                  </div>
                  <span className={`badge text-xs flex-shrink-0 ${pr.cls}`}>{pr.label}</span>
                </div>
              )
            })}
            {!loading && todayTasks.length === 0 && (
              <p className="py-6 text-center text-xs text-slate-400">期限を迎えるタスクはありません</p>
            )}
          </div>
          {todayTasks.length > 0 && (
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
              <span>{doneCount}/{todayTasks.length} タスク完了</span>
              <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{ width: `${(doneCount / todayTasks.length) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
