'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  fetchProjects, updateReferralPaidDate, referralBreakdown, agencyLabel, formatAmount, type DbProject,
} from '@/lib/db'

type Kind = 'base' | 'success'
type Payout = {
  key: string
  project: DbProject
  kind: Kind
  amount: number
  receivedDate: string | null // 入金日（基本料金 or 成功報酬）
  paidDate: string | null
  dueMonth: string | null     // 入金の翌月（YYYY-MM）
}

const STATUS_LABEL: Record<DbProject['status'], string> = {
  planning: '見込み', in_progress: '申請準備中', submitted: '申請済み', accepted: '採択',
  rejected: '不採択', lost: '失注', completed: '完了',
}
const KIND_LABEL: Record<Kind, string> = { base: '基本料金分', success: '成功報酬分' }

// 入金日の翌月（YYYY-MM）。入金後、翌月に支払う運用
function nextMonth(date: string): string {
  const [y, m] = date.split('-').map(Number) as [number, number]
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}
const monthLabel = (ym: string) => `${ym.slice(0, 4)}年${Number(ym.slice(5))}月`
const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function AgencyPayoutsPage() {
  const [projects, setProjects] = useState<DbProject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'unpaid' | 'all'>('unpaid')
  const [tab, setTab] = useState<'list' | 'payout' | 'stats'>('list')
  const [listAgency, setListAgency] = useState('')
  const [listPay, setListPay] = useState<'all' | 'unpaid' | 'paid'>('all')

  const load = () => {
    fetchProjects()
      .then(setProjects)
      .catch(() => setError('データの取得に失敗しました'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const agencyProjects = useMemo(
    () => projects.filter(p => (p.agency_id || p.agency_name_manual) && p.project_type === 'subsidy'),
    [projects],
  )

  const payouts = useMemo<Payout[]>(() => {
    const rows: Payout[] = []
    for (const p of agencyProjects) {
      const { basePart, successPart } = referralBreakdown(p)
      if (basePart > 0) rows.push({
        key: `${p.id}-base`, project: p, kind: 'base', amount: basePart,
        receivedDate: p.payment_received_date, paidDate: p.referral_base_paid_date,
        dueMonth: p.payment_received_date ? nextMonth(p.payment_received_date) : null,
      })
      if (successPart > 0) rows.push({
        key: `${p.id}-success`, project: p, kind: 'success', amount: successPart,
        receivedDate: p.success_fee_received_date, paidDate: p.referral_success_paid_date,
        dueMonth: p.success_fee_received_date ? nextMonth(p.success_fee_received_date) : null,
      })
    }
    return rows
  }, [agencyProjects])

  const thisMonth = todayStr().slice(0, 7)
  const visible = payouts
    .filter(r => filter === 'all' || !r.paidDate)
    .sort((a, b) => (a.dueMonth ?? '9999').localeCompare(b.dueMonth ?? '9999'))

  // 支払月 × 代理店ごとの未払い合計（入金済みで支払月が決まっているもの）
  const dueSummary = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of payouts) {
      if (r.paidDate || !r.dueMonth) continue
      const k = `${r.dueMonth}|${agencyLabel(r.project) ?? '（不明）'}`
      m.set(k, (m.get(k) ?? 0) + r.amount)
    }
    return [...m.entries()].map(([k, v]) => ({ month: k.split('|')[0]!, agency: k.split('|')[1]!, total: v }))
      .sort((a, b) => a.month.localeCompare(b.month) || a.agency.localeCompare(b.agency))
  }, [payouts])

  // 代理店ごとの実績
  const agencyStats = useMemo(() => {
    const m = new Map<string, { name: string; count: number; accepted: number; revenue: number; fee: number; unpaid: number }>()
    for (const p of agencyProjects) {
      const name = agencyLabel(p) ?? '（不明）'
      const s = m.get(name) ?? { name, count: 0, accepted: 0, revenue: 0, fee: 0, unpaid: 0 }
      const { total } = referralBreakdown(p)
      s.count++
      if (p.status === 'accepted' || p.status === 'completed') s.accepted++
      s.revenue += (p.base_fee ?? 0) + (p.subsidy_amount ?? p.applied_amount ?? 0) * ((p.success_fee_rate ?? 0) / 100)
      s.fee += total
      m.set(name, s)
    }
    for (const r of payouts) {
      if (r.paidDate) continue
      const s = m.get(agencyLabel(r.project) ?? '（不明）')
      if (s) s.unpaid += r.amount
    }
    return [...m.values()].sort((a, b) => b.count - a.count)
  }, [agencyProjects, payouts])

  // 紹介料発生案件一覧（案件単位）。紹介料なしの案件は除く
  const listRows = useMemo(() => {
    return agencyProjects
      .filter(p => !p.referral_none)
      .map(p => {
        const b = referralBreakdown(p)
        const mine = payouts.filter(r => r.project.id === p.id)
        const paid = mine.filter(r => r.paidDate).reduce((a, r) => a + r.amount, 0)
        return { p, ...b, paid, unpaid: b.total - paid, agency: agencyLabel(p) ?? '（不明）' }
      })
      .filter(r => r.total > 0)
      .filter(r => !listAgency || r.agency === listAgency)
      .filter(r => listPay === 'all' || (listPay === 'paid' ? r.unpaid <= 0 : r.unpaid > 0))
      .sort((a, b) => (b.p.result_at ?? b.p.deadline ?? '').localeCompare(a.p.result_at ?? a.p.deadline ?? ''))
  }, [agencyProjects, payouts, listAgency, listPay])
  const agencyNames = useMemo(
    () => [...new Set(agencyProjects.map(p => agencyLabel(p) ?? '（不明）'))].sort(),
    [agencyProjects],
  )
  const listTotal = listRows.reduce((a, r) => a + r.total, 0)
  const listUnpaid = listRows.reduce((a, r) => a + r.unpaid, 0)

  // 基本料金分・成功報酬分それぞれの状態表示
  const portionStatus = (kind: Kind, p: DbProject) => {
    const r = payouts.find(x => x.project.id === p.id && x.kind === kind)
    if (!r) return <span className="text-slate-300">—</span>
    if (r.paidDate) return <span className="text-emerald-600">支払済 {r.paidDate.slice(5).replace('-', '/')}</span>
    if (r.dueMonth) return <span className={r.dueMonth < thisMonth ? 'font-semibold text-rose-600' : 'text-amber-600'}>{monthLabel(r.dueMonth)}払い</span>
    return <span className="text-slate-400">入金待ち</span>
  }

  const togglePaid = async (r: Payout) => {
    setError('')
    try {
      await updateReferralPaidDate(r.project.id, r.kind, r.paidDate ? null : todayStr())
      load()
    } catch {
      setError('更新に失敗しました（権限がない可能性があります）')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="代理店ご紹介料"
        description="基本料金・成功報酬それぞれの入金後、翌月に支払い。紹介料 = 基本料金分(1〜2万円) + 成功報酬額の2%（補助金の窓口は成功報酬額の50%）"
      />
      {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}
      <div className="flex gap-1 border-b border-slate-200">
        {([['list', '紹介料発生案件一覧'], ['payout', '支払管理'], ['stats', '代理店別実績']] as const).map(([k, label]) => (
          <button
            key={k} onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm ${tab === k ? 'border-brand-600 font-semibold text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >{label}</button>
        ))}
      </div>
      {loading ? <p className="text-sm text-slate-400">読み込み中…</p> : (
        <>
          {tab === 'list' && (
            <section className="card p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-slate-600">
                  {listRows.length}件　紹介料合計 <span className="font-semibold text-slate-800">{formatAmount(listTotal)}</span>
                  　未払い <span className="font-semibold text-rose-600">{formatAmount(listUnpaid)}</span>
                </div>
                <div className="flex gap-2">
                  <select className="input w-auto text-sm" value={listAgency} onChange={e => setListAgency(e.target.value)}>
                    <option value="">すべての紹介元</option>
                    {agencyNames.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <select className="input w-auto text-sm" value={listPay} onChange={e => setListPay(e.target.value as 'all' | 'unpaid' | 'paid')}>
                    <option value="all">支払状況：すべて</option>
                    <option value="unpaid">未払いあり</option>
                    <option value="paid">支払済のみ</option>
                  </select>
                </div>
              </div>
              {listRows.length === 0 ? (
                <p className="text-sm text-slate-400">紹介料が発生する案件がありません。案件に紹介元と紹介料を設定すると表示されます。</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full whitespace-nowrap text-left text-sm">
                    <thead className="text-xs text-slate-400">
                      <tr>
                        <th className="py-2 pr-3">紹介元</th><th className="pr-3">案件 / 顧客</th><th className="pr-3">補助金</th><th className="pr-3">案件状況</th>
                        <th className="pr-3 text-right">紹介料</th><th className="pr-3">基本料金分</th><th className="pr-3">成功報酬分</th><th className="text-right">未払い</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {listRows.map(r => (
                        <tr key={r.p.id}>
                          <td className="py-2 pr-3">{r.agency}</td>
                          <td className="pr-3">
                            <Link href={`/projects/${r.p.id}`} className="text-brand-600 hover:underline">{r.p.title}</Link>
                            <div className="text-xs text-slate-400">{r.p.customers?.company_name}</div>
                          </td>
                          <td className="pr-3">{r.p.subsidy_name ?? '—'}</td>
                          <td className="pr-3">{STATUS_LABEL[r.p.status]}</td>
                          <td className="pr-3 text-right">
                            {formatAmount(r.total)}
                            <div className="text-xs text-slate-400">
                              {r.basePart > 0 && `基本 ${formatAmount(r.basePart)} + `}成功報酬{r.ratePct}% {formatAmount(r.successPart)}
                            </div>
                          </td>
                          <td className="pr-3">{r.basePart > 0 ? portionStatus('base', r.p) : <span className="text-slate-300">—</span>}</td>
                          <td className="pr-3">{portionStatus('success', r.p)}</td>
                          <td className="text-right">{r.unpaid > 0 ? formatAmount(r.unpaid) : <span className="text-slate-300">—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-3 text-xs text-slate-400">採択前の案件の成功報酬分は、申請額ベースの見込み額です（採択額が入ると自動で更新されます）。</p>
            </section>
          )}

          {tab === 'payout' && <>
          <section className="card p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">支払予定（入金済み・未払い）</h2>
            {dueSummary.length === 0 ? (
              <p className="text-sm text-slate-400">支払い待ちのご紹介料はありません</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {dueSummary.map(d => (
                  <li key={d.month + d.agency} className="flex items-center justify-between py-2">
                    <span>
                      <span className={d.month < thisMonth ? 'font-semibold text-rose-600' : 'text-slate-700'}>
                        {monthLabel(d.month)}支払い{d.month < thisMonth && '（期限超過）'}
                      </span>
                      <span className="ml-3 text-slate-500">{d.agency}</span>
                    </span>
                    <span className="font-medium text-slate-800">{formatAmount(d.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">支払明細</h2>
              <select className="input w-auto text-sm" value={filter} onChange={e => setFilter(e.target.value as 'unpaid' | 'all')}>
                <option value="unpaid">未払いのみ</option>
                <option value="all">すべて</option>
              </select>
            </div>
            {visible.length === 0 ? (
              <p className="text-sm text-slate-400">対象がありません。案件に代理店・紹介料を設定すると表示されます。</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-slate-400">
                    <tr>
                      <th className="py-2 pr-3">代理店</th><th className="pr-3">案件</th><th className="pr-3">区分</th>
                      <th className="pr-3 text-right">金額</th><th className="pr-3">入金日</th><th className="pr-3">支払月</th><th>状態</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visible.map(r => (
                      <tr key={r.key}>
                        <td className="py-2 pr-3">{agencyLabel(r.project)}</td>
                        <td className="pr-3">
                          <Link href={`/projects/${r.project.id}`} className="text-brand-600 hover:underline">{r.project.title}</Link>
                        </td>
                        <td className="pr-3">{KIND_LABEL[r.kind]}</td>
                        <td className="pr-3 text-right">{formatAmount(r.amount)}</td>
                        <td className="pr-3">{r.receivedDate ?? <span className="text-slate-400">入金待ち</span>}</td>
                        <td className="pr-3">{r.dueMonth ? monthLabel(r.dueMonth) : '—'}</td>
                        <td>
                          {r.paidDate ? (
                            <button className="text-xs text-emerald-600 hover:underline" onClick={() => togglePaid(r)}>支払済 {r.paidDate}（取消）</button>
                          ) : r.receivedDate ? (
                            <button className="btn-secondary text-xs" onClick={() => togglePaid(r)}>支払済にする</button>
                          ) : <span className="text-xs text-slate-400">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          </>}

          {tab === 'stats' && (
          <section className="card p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">代理店ごとの実績</h2>
            {agencyStats.length === 0 ? <p className="text-sm text-slate-400">紹介案件がまだありません</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-slate-400">
                    <tr>
                      <th className="py-2 pr-3">代理店</th><th className="pr-3 text-right">紹介案件</th><th className="pr-3 text-right">採択</th>
                      <th className="pr-3 text-right">売上見込み</th><th className="pr-3 text-right">紹介料合計</th><th className="text-right">未払い</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {agencyStats.map(s => (
                      <tr key={s.name}>
                        <td className="py-2 pr-3">{s.name}</td>
                        <td className="pr-3 text-right">{s.count}件</td>
                        <td className="pr-3 text-right">{s.accepted}件</td>
                        <td className="pr-3 text-right">{formatAmount(Math.round(s.revenue))}</td>
                        <td className="pr-3 text-right">{formatAmount(s.fee)}</td>
                        <td className="text-right">{formatAmount(s.unpaid)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          )}
        </>
      )}
    </div>
  )
}
