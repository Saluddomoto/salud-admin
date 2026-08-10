'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Modal } from '@/components/Modal'
import { TaxAmountInput } from '@/components/TaxAmountInput'
import { useAuth } from '@/hooks/useAuth'
import {
  fetchRevenueLedger, insertRevenueEntry, updateRevenueEntry, deleteRevenueEntry,
  fetchProjects, formatAmount, formatDate,
  type DbRevenueEntry, type DbProject, type RevenueEntryInput,
} from '@/lib/db'
import { REVENUE_CATEGORIES, REVENUE_CATEGORY_NAMES, matchRevenueCategoryFromSubsidyName } from '@/lib/revenueCategories'

type Row = {
  id: string
  entry_date: string
  payer_name: string
  category: string
  amount_excl_tax: number
  status: 'confirmed' | 'forecast'
  payment_due_date: string | null
  payment_received_date: string | null
  memo: string | null
  source: 'manual' | 'project'
  projectId?: string
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

type SortKey = 'entry_date' | 'category' | 'payer_name' | 'amount_excl_tax' | 'status'

function SortableTh({
  label, sortKey, current, dir, onClick, align,
}: {
  label: string; sortKey: SortKey; current: SortKey; dir: 'asc' | 'desc'
  onClick: (key: SortKey) => void; align?: 'right'
}) {
  const active = current === sortKey
  return (
    <th className={`px-3 py-2.5 ${align === 'right' ? 'text-right' : ''}`}>
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className={`inline-flex items-center gap-1 font-medium hover:text-slate-600 ${active ? 'text-slate-600' : ''}`}
      >
        {label}
        <span className="text-[10px]">{active ? (dir === 'asc' ? '▲' : '▼') : ''}</span>
      </button>
    </th>
  )
}

function deriveProjectRows(projects: DbProject[]): Row[] {
  const rows: Row[] = []
  for (const p of projects) {
    const payer = p.customers?.company_name ?? '—'
    if (p.project_type === 'web') {
      if (p.web_fee_excl_tax == null) continue
      const date = p.payment_received_date ?? p.payment_due_date
      if (!date) continue
      rows.push({
        id: `project-${p.id}`,
        entry_date: date,
        payer_name: payer,
        category: 'HP制作',
        amount_excl_tax: p.web_fee_excl_tax,
        status: p.payment_received_date ? 'confirmed' : 'forecast',
        payment_due_date: p.payment_due_date,
        payment_received_date: p.payment_received_date,
        memo: null,
        source: 'project',
        projectId: p.id,
      })
    } else if (p.status === 'accepted') {
      const amount = (p.base_fee ?? 0) + (p.subsidy_amount ?? 0) * ((p.success_fee_rate ?? 0) / 100)
      const date = p.result_at ?? p.deadline
      if (amount <= 0 || !date) continue
      rows.push({
        id: `project-${p.id}`,
        entry_date: date,
        payer_name: payer,
        category: matchRevenueCategoryFromSubsidyName(p.subsidy_name ?? '')?.name ?? 'その他',
        amount_excl_tax: amount,
        status: 'confirmed',
        payment_due_date: null,
        payment_received_date: null,
        memo: null,
        source: 'project',
        projectId: p.id,
      })
    }
  }
  return rows
}

// 補助金パイプライン(見込み〜申請済み、まだ採択されていない案件)を
// カテゴリの採択率で加重し、売上予測(見込み)にのみ計上する。
// 実際の入金が発生したわけではないため売上台帳の一覧には出さない。
function derivePipelineForecastRows(projects: DbProject[]): Row[] {
  const rows: Row[] = []
  for (const p of projects) {
    if (p.project_type !== 'subsidy') continue
    if (!['planning', 'in_progress', 'submitted'].includes(p.status)) continue
    const cat = matchRevenueCategoryFromSubsidyName(p.subsidy_name ?? '')
    if (!cat?.acceptanceRate) continue
    const base = p.applied_amount ?? p.subsidy_amount ?? cat.unitPrice
    const amount = Math.round(base * cat.acceptanceRate)
    const date = p.deadline
    if (amount <= 0 || !date) continue
    rows.push({
      id: `pipeline-${p.id}`,
      entry_date: date,
      payer_name: p.customers?.company_name ?? '—',
      category: cat.name,
      amount_excl_tax: amount,
      status: 'forecast',
      payment_due_date: null,
      payment_received_date: null,
      memo: `パイプライン見込み（採択率${Math.round(cat.acceptanceRate * 100)}%で加重）`,
      source: 'project',
      projectId: p.id,
    })
  }
  return rows
}

export default function RevenuePage() {
  const { role, isLoading: authLoading } = useAuth()
  const [manual,   setManual]   = useState<DbRevenueEntry[]>([])
  const [projects, setProjects] = useState<DbProject[]>([])
  const [loading,  setLoading]  = useState(true)
  const [tab,       setTab]     = useState<'ledger' | 'monthly'>('ledger')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing,   setEditing]   = useState<DbRevenueEntry | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [year,      setYear]      = useState(new Date().getFullYear())
  const [sortKey, setSortKey] = useState<'entry_date' | 'category' | 'payer_name' | 'amount_excl_tax' | 'status'>('entry_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const toggleSort = (key: typeof sortKey) => {
    if (key === sortKey) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const load = () => {
    Promise.all([fetchRevenueLedger(), fetchProjects()])
      .then(([m, p]) => { setManual(m); setProjects(p) })
      .catch(() => setError('データの取得に失敗しました'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const rows: Row[] = useMemo(() => {
    const manualRows: Row[] = manual.map(r => ({ ...r, source: 'manual' as const }))
    const merged = [...manualRows, ...deriveProjectRows(projects)]
    const dir = sortDir === 'asc' ? 1 : -1
    return merged.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (av === bv) return 0
      return av < bv ? -1 * dir : 1 * dir
    })
  }, [manual, projects, sortKey, sortDir])

  const canAccess = role === 'admin'

  const openCreate = () => { setEditing(null); setModalOpen(true) }
  const openEdit = (r: DbRevenueEntry) => { setEditing(r); setModalOpen(true) }

  const handleToggleStatus = async (entry: DbRevenueEntry) => {
    const next: 'confirmed' | 'forecast' = entry.status === 'confirmed' ? 'forecast' : 'confirmed'
    setManual(prev => prev.map(m => m.id === entry.id ? { ...m, status: next } : m))
    try {
      await updateRevenueEntry(entry.id, {
        entry_date: entry.entry_date,
        payer_name: entry.payer_name,
        category: entry.category,
        amount_excl_tax: entry.amount_excl_tax,
        status: next,
        payment_due_date: entry.payment_due_date,
        payment_received_date: entry.payment_received_date,
        memo: entry.memo,
      })
    } catch {
      setError('区分の更新に失敗しました')
      load()
    }
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const f = new FormData(e.currentTarget)
    const input: RevenueEntryInput = {
      entry_date:             f.get('entry_date') as string,
      payer_name:             f.get('payer_name') as string,
      category:                f.get('category') as string,
      amount_excl_tax:         Number(f.get('amount_excl_tax')),
      status:                  f.get('status') as 'confirmed' | 'forecast',
      payment_due_date:        (f.get('payment_due_date') as string) || null,
      payment_received_date:   (f.get('payment_received_date') as string) || null,
      memo:                     (f.get('memo') as string)?.trim() || null,
    }
    try {
      if (editing) await updateRevenueEntry(editing.id, input)
      else await insertRevenueEntry(input)
      setModalOpen(false)
      load()
    } catch {
      setError('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('この売上明細を削除しますか？')) return
    try {
      await deleteRevenueEntry(id)
      load()
    } catch {
      setError('削除に失敗しました')
    }
  }

  // カテゴリ×月の集計（確定のみ／確定+見込み）
  const monthlyTotals = useMemo(() => {
    const table = new Map<string, { confirmed: number[]; withForecast: number[] }>()
    for (const cat of REVENUE_CATEGORIES) {
      table.set(cat.name, { confirmed: Array(12).fill(0), withForecast: Array(12).fill(0) })
    }
    for (const r of [...rows, ...derivePipelineForecastRows(projects)]) {
      const d = r.entry_date ? new Date(r.entry_date) : null
      if (!d || d.getFullYear() !== year) continue
      const mi = d.getMonth()
      const bucket = table.get(r.category) ?? table.get('その他')!
      if (r.status === 'confirmed') bucket.confirmed[mi] = (bucket.confirmed[mi] ?? 0) + r.amount_excl_tax
      bucket.withForecast[mi] = (bucket.withForecast[mi] ?? 0) + r.amount_excl_tax
    }
    return table
  }, [rows, projects, year])

  const yearTotalConfirmed = REVENUE_CATEGORIES.reduce(
    (s, c) => s + (monthlyTotals.get(c.name)?.confirmed.reduce((a, b) => a + b, 0) ?? 0), 0
  )
  const yearTotalWithForecast = REVENUE_CATEGORIES.reduce(
    (s, c) => s + (monthlyTotals.get(c.name)?.withForecast.reduce((a, b) => a + b, 0) ?? 0), 0
  )
  const yearTargetTotal = REVENUE_CATEGORIES.reduce((s, c) => s + c.annualTargetCount * c.unitPrice, 0)

  if (!authLoading && !canAccess) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
        <h2 className="text-lg font-bold text-slate-900">売上管理は管理者のみ利用できます</h2>
        <p className="text-sm text-slate-500">このページを表示する権限がありません。</p>
        <a href="/" className="mt-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          ダッシュボードに戻る
        </a>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader title="売上管理" description="売上台帳・月次実績・売上予測（補助金案件・WEB制作案件から自動反映）">
        {tab === 'ledger' && (
          <button className="btn-primary text-sm" onClick={openCreate}>+ 売上を追加</button>
        )}
      </PageHeader>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      <div className="flex gap-1 border-b border-slate-200">
        {[{ key: 'ledger', label: '売上台帳' }, { key: 'monthly', label: '月次実績・売上予測' }].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'ledger' && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                <SortableTh label="日付" sortKey="entry_date" current={sortKey} dir={sortDir} onClick={toggleSort} />
                <SortableTh label="顧客" sortKey="payer_name" current={sortKey} dir={sortDir} onClick={toggleSort} />
                <SortableTh label="カテゴリ" sortKey="category" current={sortKey} dir={sortDir} onClick={toggleSort} />
                <SortableTh label="金額（税抜）" sortKey="amount_excl_tax" current={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
                <SortableTh label="区分" sortKey="status" current={sortKey} dir={sortDir} onClick={toggleSort} />
                <th className="px-3 py-2.5">入金予定日</th>
                <th className="px-3 py-2.5">入金日</th>
                <th className="px-3 py-2.5">メモ</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="px-3 py-2.5 whitespace-nowrap">{r.entry_date || '—'}</td>
                  <td className="px-3 py-2.5">{r.payer_name}</td>
                  <td className="px-3 py-2.5">{r.category}</td>
                  <td className="px-3 py-2.5 text-right font-medium">{formatAmount(r.amount_excl_tax)}</td>
                  <td className="px-3 py-2.5">
                    {r.source === 'manual' ? (
                      <button
                        type="button"
                        title="クリックで確定⇔見込みを切替"
                        onClick={() => handleToggleStatus(manual.find(m => m.id === r.id)!)}
                        className={`badge text-xs transition-colors hover:opacity-75 ${r.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}
                      >
                        {r.status === 'confirmed' ? '確定' : '見込み'}
                      </button>
                    ) : (
                      <span className={`badge text-xs ${r.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {r.status === 'confirmed' ? '確定' : '見込み'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{r.payment_due_date ?? '—'}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{r.payment_received_date ?? '—'}</td>
                  <td className="px-3 py-2.5 max-w-[160px] truncate text-slate-500">{r.memo ?? '—'}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-right">
                    {r.source === 'manual' ? (
                      <>
                        <button className="text-xs font-medium text-brand-600 hover:underline"
                          onClick={() => openEdit(manual.find(m => m.id === r.id)!)}>編集</button>
                        <button className="ml-2 text-xs font-medium text-rose-600 hover:underline"
                          onClick={() => handleDelete(r.id)}>削除</button>
                      </>
                    ) : (
                      <a href={`/projects/${r.projectId}`} className="text-xs font-medium text-slate-400 hover:text-brand-600 hover:underline">
                        案件由来
                      </a>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={9} className="py-10 text-center text-sm text-slate-300">売上明細はまだありません</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'monthly' && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2">
            <button className="btn-secondary text-sm" onClick={() => setYear(y => y - 1)}>← {year - 1}年</button>
            <span className="text-sm font-semibold text-slate-700">{year}年</span>
            <button className="btn-secondary text-sm" onClick={() => setYear(y => y + 1)}>{year + 1}年 →</button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="card p-4">
              <p className="text-xs text-slate-400">年間目標売上</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{formatAmount(yearTargetTotal)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-slate-400">確定実績（{year}年）</p>
              <p className="mt-1 text-xl font-bold text-emerald-600">{formatAmount(yearTotalConfirmed)}</p>
              <p className="text-xs text-slate-400">達成率 {yearTargetTotal ? Math.round((yearTotalConfirmed / yearTargetTotal) * 100) : 0}%</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-slate-400">売上予測（確定＋見込み）</p>
              <p className="mt-1 text-xl font-bold text-amber-600">{formatAmount(yearTotalWithForecast)}</p>
              <p className="text-xs text-slate-400">達成率 {yearTargetTotal ? Math.round((yearTotalWithForecast / yearTargetTotal) * 100) : 0}%</p>
            </div>
          </div>

          {[
            { key: 'confirmed' as const,    title: '月次実績（確定分のみ）', note: null },
            {
              key: 'withForecast' as const, title: '売上予測（確定＋見込み）',
              note: '補助金の見込み〜申請済み案件は、カテゴリの採択率で加重して含めています（案件詳細ページの申請額×採択率）',
            },
          ].map(block => (
            <div key={block.key} className="card overflow-x-auto p-0">
              <div className="border-b border-slate-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-900">{block.title}</h3>
                {block.note && <p className="mt-0.5 text-xs text-slate-400">{block.note}</p>}
              </div>
              <table className="w-full min-w-[1000px] text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-slate-400">
                    <th className="px-3 py-2">カテゴリ</th>
                    {MONTHS.map(m => <th key={m} className="px-2 py-2 text-right">{m}月</th>)}
                    <th className="px-3 py-2 text-right">年間計</th>
                    <th className="px-3 py-2 text-right">目標</th>
                  </tr>
                </thead>
                <tbody>
                  {REVENUE_CATEGORIES.map(cat => {
                    const bucket = monthlyTotals.get(cat.name)!
                    const arr = bucket[block.key]
                    const total = arr.reduce((a, b) => a + b, 0)
                    const target = cat.annualTargetCount * cat.unitPrice
                    return (
                      <tr key={cat.name} className="border-b border-slate-50">
                        <td className="px-3 py-2 font-medium text-slate-700">{cat.name}</td>
                        {arr.map((v, i) => (
                          <td key={i} className="px-2 py-2 text-right text-slate-500">{v ? formatAmount(v) : '—'}</td>
                        ))}
                        <td className="px-3 py-2 text-right font-semibold text-slate-900">{formatAmount(total)}</td>
                        <td className="px-3 py-2 text-right text-slate-400">{target ? formatAmount(target) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      <Modal title={editing ? '売上を編集' : '売上を追加'} open={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">日付 *</label>
              <input name="entry_date" type="date" required className="input" defaultValue={editing?.entry_date ?? ''} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">顧客 *</label>
              <input name="payer_name" required className="input" defaultValue={editing?.payer_name ?? ''} placeholder="カ）〇〇" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">カテゴリ *</label>
              <select name="category" required className="input" defaultValue={editing?.category ?? REVENUE_CATEGORY_NAMES[0]}>
                {REVENUE_CATEGORY_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">区分 *</label>
              <select name="status" required className="input" defaultValue={editing?.status ?? 'confirmed'}>
                <option value="confirmed">確定</option>
                <option value="forecast">見込み</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <TaxAmountInput name="amount_excl_tax" label="金額 *" defaultValueExclTax={editing?.amount_excl_tax} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">入金予定日</label>
              <input name="payment_due_date" type="date" className="input" defaultValue={editing?.payment_due_date ?? ''} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">入金日（実績）</label>
              <input name="payment_received_date" type="date" className="input" defaultValue={editing?.payment_received_date ?? ''} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">メモ</label>
              <input name="memo" className="input" defaultValue={editing?.memo ?? ''} />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" className="btn-secondary text-sm" onClick={() => setModalOpen(false)}>キャンセル</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm">
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
