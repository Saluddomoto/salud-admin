'use client'

import { Fragment, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Modal } from '@/components/Modal'
import {
  fetchProjects, fetchRevenueLedger, formatAmount, type DbProject, type DbRevenueEntry,
  fetchSubsidyProgramDeadlines, insertSubsidyProgramDeadline, deleteSubsidyProgramDeadline,
  type DbSubsidyProgramDeadline,
} from '@/lib/db'
import { matchRevenueCategoryFromSubsidyName, buildCategoryAcceptanceStats, MIN_DECIDED_FOR_ACTUAL_ACCEPTANCE_RATE } from '@/lib/revenueCategories'

const MINISTRIES = ['経済産業省', '厚生労働省', '都道府県・市区町村', 'その他'] as const

const STATUS_META: Record<DbProject['status'], { label: string; cls: string }> = {
  planning:    { label: '見込み',     cls: 'bg-slate-100 text-slate-600' },
  in_progress: { label: '申請準備中', cls: 'bg-amber-100 text-amber-700' },
  submitted:   { label: '申請済み',   cls: 'bg-indigo-100 text-indigo-700' },
  accepted:    { label: '採択',       cls: 'bg-emerald-100 text-emerald-700' },
  rejected:    { label: '不採択',     cls: 'bg-rose-100 text-rose-700' },
  lost:        { label: '失注',       cls: 'bg-zinc-200 text-zinc-600' },
  completed:   { label: '完了',       cls: 'bg-slate-100 text-slate-500' },
}

const FILTERS = [
  { key: '',            label: 'すべて' },
  { key: 'planning',    label: '見込み' },
  { key: 'in_progress', label: '申請準備中' },
  { key: 'submitted',   label: '申請済み' },
  { key: 'accepted',    label: '採択' },
] as const

type CategoryStat = {
  name: string
  list: DbProject[]
  ledgerList: DbRevenueEntry[]
  total: number
  acceptedFromProjects: number
  acceptedFromLedger: number
  accepted: number
  rejected: number
  pending: number
  decided: number
  actualRate: number | null
  assumedRate: number | null
}

// カテゴリ別の採択実績を集計する。件数の数え方（採択/不採択/審査中の判定、売上台帳との
// 合算、簡易集計である点の注意）は lib/revenueCategories.ts の buildCategoryAcceptanceStats
// に集約した（/revenue のパイプライン採択率加重と数字を一致させるため）。
function buildCategoryStats(projects: DbProject[], ledger: DbRevenueEntry[]): CategoryStat[] {
  const subsidyProjects = projects.filter(p => p.project_type !== 'web')
  const map = new Map<string, DbProject[]>()
  for (const p of subsidyProjects) {
    const cat = matchRevenueCategoryFromSubsidyName(p.subsidy_name ?? '')
    const name = cat?.name ?? 'その他・未分類'
    if (!map.has(name)) map.set(name, [])
    map.get(name)!.push(p)
  }

  const ledgerByCategory = new Map<string, DbRevenueEntry[]>()
  for (const entry of ledger) {
    if (entry.status !== 'confirmed') continue
    if (!map.has(entry.category)) continue // 補助金以外のカテゴリ（HP制作・保守など）は対象外
    if (!ledgerByCategory.has(entry.category)) ledgerByCategory.set(entry.category, [])
    ledgerByCategory.get(entry.category)!.push(entry)
  }

  const acceptanceStats = buildCategoryAcceptanceStats(projects, ledger)

  return Array.from(map.entries()).map(([name, list]) => {
    const stat = acceptanceStats.get(name)!
    const ledgerList = (ledgerByCategory.get(name) ?? []).sort((a, b) => b.entry_date.localeCompare(a.entry_date))
    const cat = matchRevenueCategoryFromSubsidyName(name)
    return {
      name,
      list: list.sort((a, b) => (b.deadline ?? '').localeCompare(a.deadline ?? '')),
      ledgerList,
      total: list.length,
      acceptedFromProjects: stat.acceptedFromProjects,
      acceptedFromLedger: stat.acceptedFromLedger,
      accepted: stat.accepted,
      rejected: stat.rejected,
      pending: stat.pending,
      decided: stat.decided,
      actualRate: stat.actualRate != null ? Math.round(stat.actualRate * 100) : null,
      assumedRate: cat?.acceptanceRate != null ? Math.round(cat.acceptanceRate * 100) : null,
    }
  }).sort((a, b) => b.total - a.total)
}

export default function SubsidiesPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<DbProject[]>([])
  const [ledger,   setLedger]   = useState<DbRevenueEntry[]>([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('')
  const [view,     setView]     = useState<'list' | 'category' | 'deadlines'>('list')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [year,     setYear]     = useState<number | null>(new Date().getFullYear())

  const [deadlines,        setDeadlines]        = useState<DbSubsidyProgramDeadline[]>([])
  const [deadlinesLoading, setDeadlinesLoading]  = useState(true)
  const [deadlineModalOpen, setDeadlineModalOpen] = useState(false)
  const [deadlineSaving,    setDeadlineSaving]    = useState(false)

  useEffect(() => {
    Promise.all([fetchProjects(), fetchRevenueLedger()])
      .then(([p, l]) => { setProjects(p); setLedger(l) })
      .finally(() => setLoading(false))
  }, [])

  const loadDeadlines = () => {
    setDeadlinesLoading(true)
    fetchSubsidyProgramDeadlines().then(setDeadlines).finally(() => setDeadlinesLoading(false))
  }
  useEffect(loadDeadlines, [])

  const handleDeadlineSubmit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault()
    const f = new FormData(ev.currentTarget)
    setDeadlineSaving(true)
    try {
      await insertSubsidyProgramDeadline({
        program_name:  String(f.get('program_name')),
        ministry:      String(f.get('ministry')) || null,
        round_label:   String(f.get('round_label')) || null,
        deadline_date: String(f.get('deadline_date')),
        notes:         String(f.get('notes')) || null,
      })
      setDeadlineModalOpen(false)
      loadDeadlines()
    } catch (e) {
      alert(`保存に失敗しました: ${e instanceof Error ? e.message : e}`)
    } finally {
      setDeadlineSaving(false)
    }
  }

  const handleDeadlineDelete = async (id: string) => {
    if (!confirm('この締切を削除しますか？')) return
    await deleteSubsidyProgramDeadline(id)
    loadDeadlines()
  }

  const filtered = filter ? projects.filter(p => p.status === filter) : projects
  const accepted = projects.filter(p => p.status === 'accepted')
  const inFlight = projects.filter(p => p.status === 'submitted')
  const active   = projects.filter(p => !['accepted', 'rejected', 'lost', 'completed'].includes(p.status))
  const total    = inFlight.reduce((sum, p) => sum + (p.applied_amount ?? 0), 0)
  const pipeline = projects
    .filter(p => p.status === 'planning' || p.status === 'in_progress')
    .reduce((sum, p) => sum + (p.applied_amount ?? 0), 0)

  // カテゴリ別実績タブの年度フィルタ。「申請期限」の年で年度を判定する
  // （submitted_at は未入力運用のため使わず、案件管理で必ず入る deadline を使う）。
  const projectsForYear = year == null
    ? projects
    : projects.filter(p => p.deadline && new Date(p.deadline).getFullYear() === year)
  const ledgerForYear = year == null
    ? ledger
    : ledger.filter(e => e.entry_date && new Date(e.entry_date).getFullYear() === year)
  const categoryStats = buildCategoryStats(projectsForYear, ledgerForYear)

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader title="補助金管理" description="申請状況の一覧・進捗管理" />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: '進行中の申請', value: `${active.length}件`,   color: 'text-slate-900' },
          { label: '審査待ち',     value: `${inFlight.length}件`, color: 'text-indigo-600' },
          { label: '採択済み',     value: `${accepted.length}件`, color: 'text-emerald-600' },
          { label: '申請総額（申請済み）', value: formatAmount(total),    color: 'text-slate-900' },
          { label: '申請見込み（見込み・準備中）', value: formatAmount(pipeline), color: 'text-amber-600' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={`mt-1 text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {[
          { key: 'list' as const,      label: '案件一覧' },
          { key: 'category' as const,  label: 'カテゴリ別実績' },
          { key: 'deadlines' as const, label: '公募締切' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setView(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              view === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === 'list' && (
        <>
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
        </>
      )}

      {view === 'category' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <button className="btn-secondary text-sm" onClick={() => setYear(y => (y ?? new Date().getFullYear()) - 1)}>← {(year ?? new Date().getFullYear()) - 1}年</button>
            <span className="text-sm font-semibold text-slate-700">{year == null ? '全期間' : `${year}年`}</span>
            <button className="btn-secondary text-sm" onClick={() => setYear(y => (y ?? new Date().getFullYear()) + 1)}>{(year ?? new Date().getFullYear()) + 1}年 →</button>
            <button
              className={`ml-2 rounded-full px-3 py-1 text-xs font-medium transition-colors ${year == null ? 'bg-brand-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
              onClick={() => setYear(y => y == null ? new Date().getFullYear() : null)}
            >
              全期間
            </button>
            <span className="text-xs text-slate-400">「申請期限」の年で集計（案件管理の期限欄）</span>
          </div>
          <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-4 py-3 font-medium">カテゴリ</th>
                <th className="px-4 py-3 font-medium text-right">{year == null ? '累計申請数' : '申請数'}</th>
                <th className="px-4 py-3 font-medium text-right">審査中</th>
                <th className="px-4 py-3 font-medium text-right">採択</th>
                <th className="px-4 py-3 font-medium text-right">不採択</th>
                <th className="px-4 py-3 font-medium text-right">採択率（実績）</th>
                <th className="px-4 py-3 font-medium text-right">採択率（予測用の設定値）</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">読み込み中...</td></tr>
              )}
              {!loading && categoryStats.map(c => (
                <Fragment key={c.name}>
                  <tr
                    onClick={() => setExpanded(expanded === c.name ? null : c.name)}
                    className="cursor-pointer border-b border-slate-50 transition-colors hover:bg-slate-50/60"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <span className="mr-1 inline-block w-3 text-slate-400">{expanded === c.name ? '▾' : '▸'}</span>
                      {c.name}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">{c.total}件</td>
                    <td className="px-4 py-3 text-right text-indigo-600">{c.pending}件</td>
                    <td className="px-4 py-3 text-right text-emerald-600">
                      {c.accepted}件
                      {c.acceptedFromLedger > 0 && (
                        <span className="ml-1 text-[10px] text-slate-400">（案件{c.acceptedFromProjects}+台帳{c.acceptedFromLedger}）</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-rose-500">{c.rejected}件</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {c.actualRate == null ? '— （採択/不採択の実績なし）' : `${c.actualRate}%（${c.accepted}/${c.decided}）`}
                      {c.decided >= MIN_DECIDED_FOR_ACTUAL_ACCEPTANCE_RATE && (
                        <span className="ml-1.5 badge bg-brand-100 text-brand-700 text-[10px] align-middle">予測に反映中</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400">
                      {c.assumedRate == null ? '—' : `${c.assumedRate}%`}
                      {c.decided >= MIN_DECIDED_FOR_ACTUAL_ACCEPTANCE_RATE && (
                        <span className="ml-1.5 text-[10px] text-slate-300">（未使用）</span>
                      )}
                    </td>
                  </tr>
                  {expanded === c.name && (
                    <tr key={`${c.name}-detail`}>
                      <td colSpan={7} className="bg-slate-50/60 px-4 py-3">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-slate-400">
                              <th className="py-1.5 font-medium">案件名</th>
                              <th className="py-1.5 font-medium">顧客</th>
                              <th className="py-1.5 font-medium text-right">申請額</th>
                              <th className="py-1.5 font-medium">期限</th>
                              <th className="py-1.5 font-medium">ステータス</th>
                            </tr>
                          </thead>
                          <tbody>
                            {c.list.map(p => {
                              const st = STATUS_META[p.status]
                              return (
                                <tr
                                  key={p.id}
                                  onClick={(e) => { e.stopPropagation(); router.push(`/projects/${p.id}`) }}
                                  className="cursor-pointer border-t border-slate-100 hover:bg-white"
                                >
                                  <td className="py-2 font-medium text-slate-800">{p.title}</td>
                                  <td className="py-2 text-slate-600">{p.customers?.company_name ?? '—'}</td>
                                  <td className="py-2 text-right text-slate-700">{formatAmount(p.applied_amount)}</td>
                                  <td className="py-2 text-slate-500">{p.deadline ?? '—'}</td>
                                  <td className="py-2"><span className={`badge ${st.cls}`}>{st.label}</span></td>
                                </tr>
                              )
                            })}
                            {c.list.length === 0 && (
                              <tr><td colSpan={5} className="py-3 text-center text-slate-300">案件管理には登録がありません</td></tr>
                            )}
                          </tbody>
                        </table>

                        {c.ledgerList.length > 0 && (
                          <div className="mt-3 border-t border-slate-200 pt-3">
                            <p className="mb-1.5 text-[11px] font-medium text-slate-400">売上台帳から検出した採択実績（案件管理には未登録）</p>
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-left text-slate-400">
                                  <th className="py-1.5 font-medium">顧客</th>
                                  <th className="py-1.5 font-medium text-right">金額（税抜）</th>
                                  <th className="py-1.5 font-medium">日付</th>
                                  <th className="py-1.5 font-medium">メモ</th>
                                </tr>
                              </thead>
                              <tbody>
                                {c.ledgerList.map(entry => (
                                  <tr key={entry.id} className="border-t border-slate-100">
                                    <td className="py-2 text-slate-700">{entry.payer_name}</td>
                                    <td className="py-2 text-right text-slate-700">{formatAmount(entry.amount_excl_tax)}</td>
                                    <td className="py-2 text-slate-500">{entry.entry_date}</td>
                                    <td className="py-2 text-slate-400">{entry.memo ?? '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {!loading && categoryStats.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">案件がありません。</td></tr>
              )}
            </tbody>
          </table>
          <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
            採択率（実績）は「採択／（採択＋不採択）」で計算しています（審査中は含みません）。
            採択は案件管理のステータスに加えて、売上台帳に手入力された過去の確定済み成功報酬（案件管理未登録分）も合算しています。
            不採択は案件管理のステータス更新に頼っているため、更新が漏れていると実績より高い採択率に見える点にご注意ください。
            採択率（予測用の設定値）は売上管理の月次予測で使っている値です。決定件数（採択＋不採択）が
            {MIN_DECIDED_FOR_ACTUAL_ACCEPTANCE_RATE}件に達したカテゴリは、この採択率（実績）が予測にも自動で反映されます
            （それ未満のカテゴリは業界目安の固定値のまま）。つまり不採択の記録が増えるほど、そのカテゴリの売上予測は実態に近づきます。
          </p>
          </div>
        </div>
      )}

      {view === 'deadlines' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              特定の顧客案件とは別に、各補助金プログラムの公式な公募回の締切を管理します（経済産業省・厚生労働省・自治体など）。
            </p>
            <button className="btn-primary text-sm" onClick={() => setDeadlineModalOpen(true)}>+ 締切を追加</button>
          </div>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs text-slate-500">
                  <th className="px-4 py-3 font-medium">プログラム名</th>
                  <th className="px-4 py-3 font-medium">省庁・自治体</th>
                  <th className="px-4 py-3 font-medium">回次</th>
                  <th className="px-4 py-3 font-medium">締切日</th>
                  <th className="px-4 py-3 font-medium">メモ</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {deadlinesLoading && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">読み込み中...</td></tr>
                )}
                {!deadlinesLoading && deadlines.map(d => (
                  <tr key={d.id} className="border-b border-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{d.program_name}</td>
                    <td className="px-4 py-3">
                      {d.ministry && (
                        <span className={`badge ${d.ministry === '経済産業省' ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-600'}`}>
                          {d.ministry}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{d.round_label ?? '—'}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{d.deadline_date}</td>
                    <td className="px-4 py-3 text-slate-500">{d.notes ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button className="text-xs text-slate-400 hover:text-rose-600" onClick={() => handleDeadlineDelete(d.id)}>削除</button>
                    </td>
                  </tr>
                ))}
                {!deadlinesLoading && deadlines.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    登録されている締切はありません。「+ 締切を追加」から登録してください。
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal title="補助金プログラムの締切を追加" open={deadlineModalOpen} onClose={() => setDeadlineModalOpen(false)}>
        <form onSubmit={handleDeadlineSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">プログラム名 *</label>
            <input name="program_name" required className="input" placeholder="例: 小規模事業者持続化補助金（第20回）" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">省庁・自治体</label>
              <select name="ministry" className="input" defaultValue="経済産業省">
                {MINISTRIES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">回次</label>
              <input name="round_label" className="input" placeholder="例: 第20回" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">締切日 *</label>
            <input name="deadline_date" type="date" required className="input" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">メモ</label>
            <textarea name="notes" rows={2} className="input" />
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" className="btn-secondary text-sm" onClick={() => setDeadlineModalOpen(false)}>キャンセル</button>
            <button type="submit" disabled={deadlineSaving} className="btn-primary text-sm">
              {deadlineSaving ? '保存中...' : '保存する'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
