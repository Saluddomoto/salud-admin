'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  fetchCustomerCount, fetchEvents, fetchMyProfile, fetchNeedsReplyCount, fetchProjects, fetchTasks,
  fetchRevenueLedger, fetchRecurringContracts, fetchTaskCompletions, setTaskCompletion,
  fetchDashboardSettings, updateDashboardZoomUrl, fetchSubsidyProgramDeadlines,
  formatAmount, updateTaskStatus, type DbEvent, type DbProfile, type DbProject, type DbTask,
  type DbRevenueEntry, type DbRecurringContract, type DbTaskCompletion, type DbDashboardSettings,
  type DbSubsidyProgramDeadline,
} from '@/lib/db'
import { buildLedgerRows, derivePipelineForecastRows, deriveFutureContractForecastRows, sumRowsByBusinessLine } from '@/lib/revenueRows'
import { BUSINESS_LINE_LABELS } from '@/lib/revenueCategories'

const EVENT_COLORS: Record<DbEvent['category'], string> = {
  sales: '#f59e0b', first_meeting: '#14b8a6', meeting: '#6366f1', deadline: '#ef4444', internal: '#64748b',
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

// ヘッダーの常時表示クロック（1秒ごとに更新）
function HeaderClock() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const time = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  const dateLabel = now.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })

  return (
    <div className="flex items-baseline gap-2 rounded-xl border border-slate-100 bg-white px-4 py-2 shadow-sm">
      <span className="font-mono text-2xl font-bold tabular-nums leading-none text-slate-900">{time}</span>
      <span className="whitespace-nowrap text-xs text-slate-500">{dateLabel}</span>
    </div>
  )
}

export default function DashboardPage() {
  const [projects,      setProjects]      = useState<DbProject[]>([])
  const [tasks,         setTasks]         = useState<DbTask[]>([])
  const [events,        setEvents]        = useState<DbEvent[]>([])
  const [customerCount, setCustomerCount] = useState(0)
  const [needsReply,    setNeedsReply]    = useState(0)
  const [me,            setMe]            = useState<DbProfile | null>(null)
  const [ledger,        setLedger]        = useState<DbRevenueEntry[]>([])
  const [contracts,     setContracts]     = useState<DbRecurringContract[]>([])
  const [completions,   setCompletions]   = useState<DbTaskCompletion[]>([])
  const [dashSettings,  setDashSettings]  = useState<DbDashboardSettings | null>(null)
  const [programDeadlines, setProgramDeadlines] = useState<DbSubsidyProgramDeadline[]>([])
  const [loading,       setLoading]       = useState(true)
  const [zoomEditing,   setZoomEditing]   = useState(false)
  const [zoomDraft,     setZoomDraft]     = useState('')
  const [zoomSaving,    setZoomSaving]    = useState(false)
  const [zoomCopied,    setZoomCopied]    = useState(false)

  const now = new Date()
  const today = toISODate(now)

  useEffect(() => {
    Promise.all([
      fetchProjects().then(setProjects),
      fetchTasks().then(setTasks),
      fetchEvents(today, today).then(setEvents),
      fetchCustomerCount().then(setCustomerCount),
      fetchNeedsReplyCount().then(setNeedsReply).catch(() => {}),
      fetchMyProfile().then(setMe).catch(() => {}),
      fetchRevenueLedger().then(setLedger).catch(() => {}),
      fetchRecurringContracts().then(setContracts).catch(() => {}),
      fetchTaskCompletions(today).then(setCompletions).catch(() => {}),
      fetchDashboardSettings().then(setDashSettings).catch(() => {}),
      fetchSubsidyProgramDeadlines().then(setProgramDeadlines).catch(() => {}),
    ]).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isAdmin = me?.role === 'admin'

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

  // 売上（管理者のみ）: /revenue（売上台帳・月次実績）と同じ導出関数を使って今年分を集計する。
  // ここだけ別の計算式を使うと画面ごとに数字がズレるため、必ず lib/revenueRows.ts 経由にする。
  const currentYear = now.getFullYear()
  const allRevenueRows = [
    ...buildLedgerRows(ledger, projects),
    ...derivePipelineForecastRows(projects, ledger),
    ...deriveFutureContractForecastRows(contracts, currentYear),
  ]
  const thisYearRevenueRows = allRevenueRows.filter(
    r => r.entry_date && new Date(r.entry_date).getFullYear() === currentYear
  )
  const confirmedRowsThisYear = thisYearRevenueRows.filter(r => r.status === 'confirmed')
  const confirmedRevenueThisYear = confirmedRowsThisYear.reduce((s, r) => s + r.amount_excl_tax, 0)
  const confirmedCountThisYear = confirmedRowsThisYear.length
  const withForecastRevenueThisYear = thisYearRevenueRows.reduce((s, r) => s + r.amount_excl_tax, 0)
  // 事業別（補助金事業／WEB事業）の内訳。/revenue と同じ集計関数(sumRowsByBusinessLine)を使う。
  const confirmedByLine = sumRowsByBusinessLine(confirmedRowsThisYear)
  const withForecastByLine = sumRowsByBusinessLine(thisYearRevenueRows)

  const alerts = active
    .filter(p => p.deadline && daysUntil(p.deadline, today) >= 0 && daysUntil(p.deadline, today) <= 14)
    .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))
    .slice(0, 5)

  // 各補助金プログラムの公募回締切（案件と紐づかない制度そのものの締切）。
  // 経済産業省系を優先しつつ、直近のものから最大6件表示する。
  const upcomingProgramDeadlines = programDeadlines
    .filter(d => daysUntil(d.deadline_date, today) >= 0)
    .sort((a, b) => {
      const metiDiff = Number(b.ministry === '経済産業省') - Number(a.ministry === '経済産業省')
      return metiDiff !== 0 ? metiDiff : a.deadline_date.localeCompare(b.deadline_date)
    })
    .slice(0, 6)

  // ルーティン（期限なし・毎日）タスクは常に表示し、完了は task_completions（当日分）で判定する。
  // それ以外は従来どおり期限が今日までのものを表示し、status で完了判定する。
  const routineTasks = tasks.filter(t => t.is_routine)
  const dueTasks = tasks.filter(t => !t.is_routine && t.due_date && t.due_date <= today).slice(0, 5)
  const todayTasks = [...routineTasks, ...dueTasks]
  const completedTodayIds = new Set(completions.map(c => c.task_id))
  const doneCount = todayTasks.filter(t => t.is_routine ? completedTodayIds.has(t.id) : t.status === 'done').length

  const toggleTask = async (t: DbTask) => {
    if (t.is_routine) {
      const wasDone = completedTodayIds.has(t.id)
      setCompletions(prev => wasDone
        ? prev.filter(c => c.task_id !== t.id)
        : [...prev, { id: `optimistic-${t.id}`, task_id: t.id, completed_on: today, completed_by: me?.id ?? null }])
      try {
        await setTaskCompletion(t.id, today, !wasDone)
      } catch {
        setCompletions(prev => wasDone
          ? [...prev, { id: `optimistic-${t.id}`, task_id: t.id, completed_on: today, completed_by: me?.id ?? null }]
          : prev.filter(c => c.task_id !== t.id))
      }
      return
    }
    const next = t.status === 'done' ? 'todo' : 'done'
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, status: next } : x))
    try {
      await updateTaskStatus(t.id, next)
    } catch {
      setTasks(prev => prev.map(x => x.id === t.id ? { ...x, status: t.status } : x))
    }
  }

  const startZoomEdit = () => { setZoomDraft(dashSettings?.zoom_url ?? ''); setZoomEditing(true) }

  const saveZoomUrl = async () => {
    setZoomSaving(true)
    try {
      const url = zoomDraft.trim() || null
      await updateDashboardZoomUrl(url)
      setDashSettings({ id: 1, zoom_url: url, updated_at: new Date().toISOString() })
      setZoomEditing(false)
    } catch {
      // 保存失敗時は編集欄を開いたままにして再入力できるようにする
    } finally {
      setZoomSaving(false)
    }
  }

  const copyZoomUrl = async () => {
    if (!dashSettings?.zoom_url) return
    try {
      await navigator.clipboard.writeText(dashSettings.zoom_url)
      setZoomCopied(true)
      setTimeout(() => setZoomCopied(false), 1500)
    } catch {
      // クリップボードが使えない環境では何もしない
    }
  }

  const hour = now.getHours()
  const greeting = hour < 12 ? 'おはようございます' : hour < 18 ? 'こんにちは' : 'こんばんは'

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        title="ダッシュボード"
        description={greeting}
      >
        <HeaderClock />
        <Link href="/subsidies" className="btn-secondary text-sm">補助金一覧</Link>
        <Link href="/projects" className="btn-primary text-sm">新規案件</Link>
      </PageHeader>

      {/* Zoom URL（全社共有・1件） */}
      <div className="card flex items-center gap-3 p-4">
        <span className="flex-shrink-0 text-sm font-medium text-slate-700">Zoom URL</span>
        {zoomEditing ? (
          <>
            <input
              type="url"
              className="input flex-1 text-sm"
              placeholder="https://zoom.us/j/..."
              value={zoomDraft}
              onChange={e => setZoomDraft(e.target.value)}
              autoFocus
            />
            <button type="button" disabled={zoomSaving} className="btn-primary text-sm flex-shrink-0" onClick={saveZoomUrl}>
              {zoomSaving ? '保存中...' : '保存'}
            </button>
            <button type="button" className="btn-secondary text-sm flex-shrink-0" onClick={() => setZoomEditing(false)}>
              キャンセル
            </button>
          </>
        ) : dashSettings?.zoom_url ? (
          <>
            <a
              href={dashSettings.zoom_url}
              target="_blank" rel="noopener noreferrer"
              className="min-w-0 flex-1 truncate text-sm text-brand-600 hover:underline"
            >
              {dashSettings.zoom_url}
            </a>
            <button type="button" className="btn-secondary text-sm flex-shrink-0" onClick={copyZoomUrl}>
              {zoomCopied ? 'コピーしました' : 'コピー'}
            </button>
            <button type="button" className="text-xs font-medium text-slate-400 hover:text-brand-600 hover:underline flex-shrink-0" onClick={startZoomEdit}>
              編集
            </button>
          </>
        ) : (
          <>
            <span className="flex-1 text-sm text-slate-400">未設定</span>
            <button type="button" className="btn-secondary text-sm flex-shrink-0" onClick={startZoomEdit}>
              URLを設定
            </button>
          </>
        )}
      </div>

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

      {/* 補助金プログラムの公募締切（案件と紐づかない、制度そのものの次回締切） */}
      {upcomingProgramDeadlines.length > 0 && (
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">補助金プログラムの公募締切（経済産業省系を優先表示）</p>
            <Link href="/subsidies" className="text-xs font-medium text-brand-600 hover:underline">管理する →</Link>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingProgramDeadlines.map(d => {
              const days = daysUntil(d.deadline_date, today)
              const urgent = days <= 14
              return (
                <div key={d.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm">
                  <span className={`h-2 w-2 flex-shrink-0 rounded-full ${d.ministry === '経済産業省' ? 'bg-brand-500' : 'bg-slate-300'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-800">{d.program_name}{d.round_label ? `（${d.round_label}）` : ''}</p>
                    <p className="text-xs text-slate-400">{d.ministry ?? '—'} · {d.deadline_date}</p>
                  </div>
                  <span className={`flex-shrink-0 text-xs font-semibold ${urgent ? 'text-rose-600' : 'text-slate-500'}`}>
                    {days === 0 ? '本日締切' : `残り${days}日`}
                  </span>
                </div>
              )
            })}
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

      {/* 売上管理（管理者のみ）: /revenue と同じ計算元(lib/revenueRows.ts)を使い、数字が一致するようにしている */}
      {!loading && isAdmin && (
        <div className="card border border-amber-200 bg-amber-50/40 p-5">
          <div className="mb-4 flex items-center gap-2">
            <h3 className="font-semibold text-slate-900">売上管理</h3>
            <span className="badge bg-amber-100 text-xs text-amber-700">管理者のみ表示</span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-white/60 p-4">
              <p className="text-xs text-slate-500">確定売上（{currentYear}年・{confirmedCountThisYear}件）</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">{formatAmount(confirmedRevenueThisYear)}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">入金済み・採択済みなど実額が確定した分</p>
              <div className="mt-2 flex gap-3 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                <span>{BUSINESS_LINE_LABELS.subsidy}: {formatAmount(confirmedByLine.subsidy)}</span>
                <span>{BUSINESS_LINE_LABELS.web}: {formatAmount(confirmedByLine.web)}</span>
              </div>
            </div>
            <div className="rounded-xl bg-white/60 p-4">
              <p className="text-xs text-slate-500">確定＋見込み（{currentYear}年）</p>
              <p className="mt-1 text-2xl font-bold text-amber-600">{formatAmount(withForecastRevenueThisYear)}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">申請中・パイプライン案件を採択率で加重した見込みを含む</p>
              <div className="mt-2 flex gap-3 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                <span>{BUSINESS_LINE_LABELS.subsidy}: {formatAmount(withForecastByLine.subsidy)}</span>
                <span>{BUSINESS_LINE_LABELS.web}: {formatAmount(withForecastByLine.web)}</span>
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link
              href="/revenue"
              className="flex items-center justify-between rounded-xl bg-white/60 p-4 transition-colors hover:bg-white"
            >
              <div>
                <p className="text-sm font-medium text-slate-800">売上管理（詳細）</p>
                <p className="mt-0.5 text-xs text-slate-400">売上台帳・月別推移・目標達成率</p>
              </div>
              <svg className="h-4 w-4 flex-shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <a
              href="https://claude.ai/code/artifact/136bb715-388d-46c8-9e9a-3a69a75f34bd"
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between rounded-xl bg-white/60 p-4 transition-colors hover:bg-white"
            >
              <div>
                <p className="text-sm font-medium text-slate-800">営業・経営分析レポート</p>
                <p className="mt-0.5 text-xs text-slate-400">実データから自動集計・毎週月曜更新</p>
              </div>
              <svg className="h-4 w-4 flex-shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      )}

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
              const done = t.is_routine ? completedTodayIds.has(t.id) : t.status === 'done'
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
                      {t.projects?.title ?? '社内'} · {t.is_routine ? '毎日のルーティン' : `期限 ${t.due_date}`}
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
