'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { fetchPerformance, formatAmount, type MemberPerformance, type PerfProject } from '@/lib/db'

const PROJECT_STATUS: Record<PerfProject['status'], { label: string; cls: string }> = {
  planning:    { label: '準備中',     cls: 'bg-slate-100 text-slate-600' },
  in_progress: { label: '申請準備中', cls: 'bg-amber-100 text-amber-700' },
  submitted:   { label: '申請済み',   cls: 'bg-indigo-100 text-indigo-700' },
  accepted:    { label: '採択',       cls: 'bg-emerald-100 text-emerald-700' },
  rejected:    { label: '不採択',     cls: 'bg-rose-100 text-rose-700' },
  completed:   { label: '完了',       cls: 'bg-slate-100 text-slate-500' },
}

const pad = (n: number) => String(n).padStart(2, '0')

function jstNow() {
  const d = new Date(Date.now() + 9 * 3600_000)
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 }
}

function winRateLabel(p: MemberPerformance): string {
  if (p.meetings === 0) return '—'
  return `${Math.round((p.deals / p.meetings) * 100)}%`
}

export default function PerformancePage() {
  const [{ y, m }, setYm] = useState(jstNow)
  const [rows,    setRows]    = useState<MemberPerformance[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const { startISO, endISO } = useMemo(() => {
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
    return { startISO: `${y}-${pad(m)}-01`, endISO: `${y}-${pad(m)}-${pad(lastDay)}` }
  }, [y, m])

  const load = useCallback(() => {
    setLoading(true)
    fetchPerformance(startISO, endISO)
      .then(setRows)
      .catch(() => setError('実績の取得に失敗しました'))
      .finally(() => setLoading(false))
  }, [startISO, endISO])

  useEffect(load, [load])

  const shiftMonth = (delta: number) => {
    setYm(prev => {
      const total = (prev.y * 12 + (prev.m - 1)) + delta
      return { y: Math.floor(total / 12), m: (total % 12) + 1 }
    })
  }

  const isCurrentMonth = useMemo(() => {
    const now = jstNow()
    return now.y === y && now.m === m
  }, [y, m])

  const team = useMemo(() => {
    const meetings = rows.reduce((s, r) => s + r.meetings, 0)
    const deals    = rows.reduce((s, r) => s + r.deals, 0)
    const accepted = rows.reduce((s, r) => s + r.accepted_amount, 0)
    return { meetings, deals, accepted, rate: meetings ? Math.round((deals / meetings) * 100) : null }
  }, [rows])

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader title="実績" description="メンバー別・月間の商談〜受注〜採択">
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 p-1">
          <button
            onClick={() => shiftMonth(-1)}
            className="rounded-lg px-2 py-1 text-slate-500 transition-colors hover:bg-slate-100"
            aria-label="前の月"
          >
            ‹
          </button>
          <span className="min-w-[6rem] text-center text-sm font-semibold text-slate-800">
            {y}年{m}月
          </span>
          <button
            onClick={() => shiftMonth(1)}
            disabled={isCurrentMonth}
            className="rounded-lg px-2 py-1 text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30"
            aria-label="次の月"
          >
            ›
          </button>
        </div>
      </PageHeader>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {/* チーム合計 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: '商談件数', value: `${team.meetings} 件` },
          { label: '受注件数', value: `${team.deals} 件` },
          { label: '受注率',   value: team.rate == null ? '—' : `${team.rate}%` },
          { label: '採択金額', value: formatAmount(team.accepted) },
        ].map(t => (
          <div key={t.label} className="card p-4">
            <p className="text-xs text-slate-400">{t.label}（チーム合計）</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{t.value}</p>
          </div>
        ))}
      </div>

      {/* メンバー別 */}
      {loading ? (
        <p className="p-12 text-center text-sm text-slate-400">読み込み中...</p>
      ) : (
        <div className="space-y-4">
          {rows.map(r => (
            <div key={r.user_id} className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                    {r.full_name[0]}
                  </span>
                  <p className="font-semibold text-slate-900">{r.full_name}</p>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <div className="text-right">
                    <span className="text-xs text-slate-400">商談</span>{' '}
                    <span className="font-bold text-slate-800">{r.meetings}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400">受注</span>{' '}
                    <span className="font-bold text-slate-800">{r.deals}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400">受注率</span>{' '}
                    <span className="font-bold text-brand-600">{winRateLabel(r)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400">採択</span>{' '}
                    <span className="font-bold text-emerald-600">{formatAmount(r.accepted_amount)}</span>
                  </div>
                </div>
              </div>

              {r.projects.length > 0 && (
                <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3">
                  <p className="mb-1 text-xs text-slate-400">この月に生まれた案件</p>
                  {r.projects.map(p => {
                    const st = PROJECT_STATUS[p.status]
                    return (
                      <Link
                        key={p.id}
                        href={`/projects/${p.id}`}
                        className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{p.title}</span>
                        <span className="flex-shrink-0 text-xs text-slate-400">
                          申請 {formatAmount(p.applied_amount)}
                          {p.status === 'accepted' && ` · 採択 ${formatAmount(p.subsidy_amount)}`}
                        </span>
                        <span className={`badge flex-shrink-0 text-xs ${st.cls}`}>{st.label}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
          {rows.length === 0 && (
            <p className="p-12 text-center text-sm text-slate-400">メンバーがいません</p>
          )}
        </div>
      )}

      <p className="text-xs text-slate-400">
        ※ 商談件数はカレンダーの「商談」カテゴリの予定、受注件数はこの月に登録された案件、採択金額は採択済み案件の合計です。
      </p>
    </div>
  )
}
