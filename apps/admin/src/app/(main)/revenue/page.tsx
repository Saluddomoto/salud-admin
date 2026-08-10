'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Modal } from '@/components/Modal'
import { TaxAmountInput } from '@/components/TaxAmountInput'
import { useAuth } from '@/hooks/useAuth'
import {
  fetchRevenueLedger, insertRevenueEntry, updateRevenueEntry, deleteRevenueEntry,
  fetchProjects, formatAmount, formatDate,
  fetchRecurringContracts, insertRecurringContract, updateRecurringContract,
  deleteRecurringContract, syncRecurringContracts, addMonths,
  type DbRevenueEntry, type DbProject, type RevenueEntryInput,
  type DbRecurringContract, type RecurringContractInput,
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
//
// 申請額(applied_amount)はクライアントが国に申請する補助金額であり
// Saludの売上ではない。Saludの売上は「基本料金＋採択額×成功報酬率」
// (採択済み案件と同じ式)。採択前は採択額が未確定なので申請額を代用し、
// 成功報酬部分だけを採択率で加重する(基本料金は契約時に確定済みとみなし加重しない)。
function derivePipelineForecastRows(projects: DbProject[]): Row[] {
  const rows: Row[] = []
  for (const p of projects) {
    if (p.project_type !== 'subsidy') continue
    if (!['planning', 'in_progress', 'submitted'].includes(p.status)) continue
    const cat = matchRevenueCategoryFromSubsidyName(p.subsidy_name ?? '')
    if (!cat?.acceptanceRate) continue
    const expectedSubsidyAmount = p.subsidy_amount ?? p.applied_amount ?? 0
    const successFeePortion = expectedSubsidyAmount * ((p.success_fee_rate ?? 0) / 100)
    const amount = Math.round((p.base_fee ?? 0) + successFeePortion * cat.acceptanceRate)
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

// 月額契約は当月分までしか売上台帳(revenue_ledger)に反映しない(syncRecurringContracts)。
// 今後も継続する前提のものなので、来月〜表示中の年の12月までは
// 「見込み」として売上予測にのみ投影する(台帳には書き込まない)。
function deriveFutureContractForecastRows(contracts: DbRecurringContract[], year: number): Row[] {
  const rows: Row[] = []
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const yearEnd = `${year}-12-01`

  for (const c of contracts) {
    let cursor = c.last_generated_month ? addMonths(c.last_generated_month, 1) : c.start_month
    if (cursor <= thisMonth) cursor = addMonths(thisMonth, 1)
    const stop = c.end_month && c.end_month < yearEnd ? c.end_month : yearEnd

    while (cursor <= stop) {
      rows.push({
        id: `contract-forecast-${c.id}-${cursor}`,
        entry_date: cursor,
        payer_name: c.payer_name,
        category: c.category,
        amount_excl_tax: c.monthly_amount_excl_tax,
        status: 'forecast',
        payment_due_date: null,
        payment_received_date: null,
        memo: '月額契約の今後の見込み',
        source: 'project',
      })
      cursor = addMonths(cursor, 1)
    }
  }
  return rows
}

export default function RevenuePage() {
  const { role, isLoading: authLoading } = useAuth()
  const [manual,   setManual]   = useState<DbRevenueEntry[]>([])
  const [projects, setProjects] = useState<DbProject[]>([])
  const [contracts, setContracts] = useState<DbRecurringContract[]>([])
  const [loading,  setLoading]  = useState(true)
  const [tab,       setTab]     = useState<'ledger' | 'monthly' | 'contracts'>('ledger')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing,   setEditing]   = useState<DbRevenueEntry | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [syncMsg,   setSyncMsg]   = useState('')
  const [year,      setYear]      = useState(new Date().getFullYear())
  const [sortKey, setSortKey] = useState<'entry_date' | 'category' | 'payer_name' | 'amount_excl_tax' | 'status'>('entry_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [contractModalOpen, setContractModalOpen] = useState(false)
  const [editingContract, setEditingContract] = useState<DbRecurringContract | null>(null)

  const toggleSort = (key: typeof sortKey) => {
    if (key === sortKey) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const load = () => {
    Promise.all([fetchRevenueLedger(), fetchProjects(), fetchRecurringContracts()])
      .then(([m, p, c]) => { setManual(m); setProjects(p); setContracts(c) })
      .catch(() => setError('データの取得に失敗しました'))
      .finally(() => setLoading(false))
  }

  // ページを開くたびに月額契約の未反映分を売上台帳に自動追加してから読み込む
  useEffect(() => {
    syncRecurringContracts()
      .then(n => { if (n > 0) setSyncMsg(`月額契約から${n}件を売上台帳に自動反映しました`) })
      .catch(() => {})
      .finally(load)
  }, [])

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

  const openCreateContract = () => { setEditingContract(null); setContractModalOpen(true) }
  const openEditContract = (c: DbRecurringContract) => { setEditingContract(c); setContractModalOpen(true) }

  const handleSubmitContract = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const f = new FormData(e.currentTarget)
    const input: RecurringContractInput = {
      payer_name:               f.get('payer_name') as string,
      category:                 f.get('category') as string,
      monthly_amount_excl_tax:  Number(f.get('monthly_amount_excl_tax')),
      start_month:              `${f.get('start_month')}-01`,
      end_month:                f.get('end_month') ? `${f.get('end_month')}-01` : null,
      memo:                     (f.get('memo') as string)?.trim() || null,
    }
    try {
      if (editingContract) await updateRecurringContract(editingContract.id, input)
      else await insertRecurringContract(input)
      setContractModalOpen(false)
      const n = await syncRecurringContracts()
      if (n > 0) setSyncMsg(`月額契約から${n}件を売上台帳に自動反映しました`)
      load()
    } catch {
      setError('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteContract = async (id: string) => {
    if (!confirm('この月額契約を削除しますか？（すでに売上台帳に反映済みの明細は残ります）')) return
    try {
      await deleteRecurringContract(id)
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
    for (const r of [...rows, ...derivePipelineForecastRows(projects), ...deriveFutureContractForecastRows(contracts, year)]) {
      const d = r.entry_date ? new Date(r.entry_date) : null
      if (!d || d.getFullYear() !== year) continue
      const mi = d.getMonth()
      const bucket = table.get(r.category) ?? table.get('その他')!
      if (r.status === 'confirmed') bucket.confirmed[mi] = (bucket.confirmed[mi] ?? 0) + r.amount_excl_tax
      bucket.withForecast[mi] = (bucket.withForecast[mi] ?? 0) + r.amount_excl_tax
    }
    return table
  }, [rows, projects, contracts, year])

  const yearTotalConfirmed = REVENUE_CATEGORIES.reduce(
    (s, c) => s + (monthlyTotals.get(c.name)?.confirmed.reduce((a, b) => a + b, 0) ?? 0), 0
  )
  const yearTotalWithForecast = REVENUE_CATEGORIES.reduce(
    (s, c) => s + (monthlyTotals.get(c.name)?.withForecast.reduce((a, b) => a + b, 0) ?? 0), 0
  )
  const yearTargetTotal = REVENUE_CATEGORIES.reduce((s, c) => s + c.annualTargetCount * c.unitPrice, 0)

  const [breakdownFilter, setBreakdownFilter] = useState<'confirmed' | 'all' | null>(null)
  const yearRows = useMemo(() => {
    return [...rows, ...derivePipelineForecastRows(projects), ...deriveFutureContractForecastRows(contracts, year)]
      .filter(r => r.entry_date && new Date(r.entry_date).getFullYear() === year)
      .sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1))
  }, [rows, projects, contracts, year])
  const breakdownRows = breakdownFilter === 'confirmed'
    ? yearRows.filter(r => r.status === 'confirmed')
    : yearRows

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
        {tab === 'contracts' && (
          <button className="btn-primary text-sm" onClick={openCreateContract}>+ 月額契約を追加</button>
        )}
      </PageHeader>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}
      {syncMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{syncMsg}</div>
      )}

      <div className="flex gap-1 border-b border-slate-200">
        {[
          { key: 'ledger', label: '売上台帳' },
          { key: 'monthly', label: '月次実績・売上予測' },
          { key: 'contracts', label: '月額契約' },
        ].map(t => (
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
            <button type="button" className="card p-4 text-left transition-shadow hover:shadow-md" onClick={() => setBreakdownFilter('confirmed')}>
              <p className="text-xs text-slate-400">確定実績（{year}年）</p>
              <p className="mt-1 text-xl font-bold text-emerald-600">{formatAmount(yearTotalConfirmed)}</p>
              <p className="text-xs text-slate-400">達成率 {yearTargetTotal ? Math.round((yearTotalConfirmed / yearTargetTotal) * 100) : 0}%（クリックで内訳）</p>
            </button>
            <button type="button" className="card p-4 text-left transition-shadow hover:shadow-md" onClick={() => setBreakdownFilter('all')}>
              <p className="text-xs text-slate-400">売上予測（確定＋見込み）</p>
              <p className="mt-1 text-xl font-bold text-amber-600">{formatAmount(yearTotalWithForecast)}</p>
              <p className="text-xs text-slate-400">達成率 {yearTargetTotal ? Math.round((yearTotalWithForecast / yearTargetTotal) * 100) : 0}%（クリックで内訳）</p>
            </button>
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
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50/70">
                    <td className="px-3 py-2 font-semibold text-slate-900">合計</td>
                    {MONTHS.map((m, i) => {
                      const monthTotal = REVENUE_CATEGORIES.reduce(
                        (s, cat) => s + (monthlyTotals.get(cat.name)?.[block.key][i] ?? 0), 0
                      )
                      return (
                        <td key={m} className="px-2 py-2 text-right font-semibold text-slate-900">
                          {monthTotal ? formatAmount(monthTotal) : '—'}
                        </td>
                      )
                    })}
                    <td className="px-3 py-2 text-right font-semibold text-slate-900">
                      {formatAmount(REVENUE_CATEGORIES.reduce(
                        (s, cat) => s + (monthlyTotals.get(cat.name)?.[block.key].reduce((a, b) => a + b, 0) ?? 0), 0
                      ))}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-500">
                      {formatAmount(REVENUE_CATEGORIES.reduce((s, c) => s + c.annualTargetCount * c.unitPrice, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ))}
        </div>
      )}

      {tab === 'contracts' && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                <th className="px-3 py-2.5">顧客</th>
                <th className="px-3 py-2.5">カテゴリ</th>
                <th className="px-3 py-2.5 text-right">月額（税抜）</th>
                <th className="px-3 py-2.5">開始月</th>
                <th className="px-3 py-2.5">終了月</th>
                <th className="px-3 py-2.5">売上台帳への反映</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {contracts.map(c => (
                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="px-3 py-2.5">{c.payer_name}</td>
                  <td className="px-3 py-2.5">{c.category}</td>
                  <td className="px-3 py-2.5 text-right font-medium">{formatAmount(c.monthly_amount_excl_tax)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{c.start_month.slice(0, 7)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{c.end_month ? c.end_month.slice(0, 7) : '継続中'}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-slate-500">
                    {c.last_generated_month ? `${c.last_generated_month.slice(0, 7)}分まで反映済み` : '未反映'}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-right">
                    <button className="text-xs font-medium text-brand-600 hover:underline" onClick={() => openEditContract(c)}>編集</button>
                    <button className="ml-2 text-xs font-medium text-rose-600 hover:underline" onClick={() => handleDeleteContract(c.id)}>削除</button>
                  </td>
                </tr>
              ))}
              {!loading && contracts.length === 0 && (
                <tr><td colSpan={7} className="py-10 text-center text-sm text-slate-300">月額契約はまだありません</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        title={editingContract ? '月額契約を編集' : '月額契約を追加'}
        open={contractModalOpen}
        onClose={() => setContractModalOpen(false)}
      >
        <form onSubmit={handleSubmitContract} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">顧客 *</label>
              <input name="payer_name" required className="input" defaultValue={editingContract?.payer_name ?? ''} placeholder="イチヤ" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">カテゴリ *</label>
              <select name="category" required className="input" defaultValue={editingContract?.category ?? 'SEO支援'}>
                {REVENUE_CATEGORY_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <TaxAmountInput name="monthly_amount_excl_tax" label="月額 *" defaultValueExclTax={editingContract?.monthly_amount_excl_tax} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">開始月 *</label>
              <input
                name="start_month" type="month" required className="input"
                defaultValue={editingContract?.start_month?.slice(0, 7) ?? ''}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">終了月（空欄なら継続中）</label>
              <input
                name="end_month" type="month" className="input"
                defaultValue={editingContract?.end_month?.slice(0, 7) ?? ''}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">メモ</label>
              <input name="memo" className="input" defaultValue={editingContract?.memo ?? ''} />
            </div>
          </div>
          <p className="text-xs text-slate-400">
            保存すると、開始月〜当月（終了月があればそこまで）の未反映分が売上台帳に自動追加されます。
          </p>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" className="btn-secondary text-sm" onClick={() => setContractModalOpen(false)}>キャンセル</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm">
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        title={breakdownFilter === 'confirmed' ? `確定実績の内訳（${year}年）` : `売上予測の内訳（${year}年）`}
        open={breakdownFilter !== null}
        onClose={() => setBreakdownFilter(null)}
      >
        <div className="max-h-[60vh] overflow-y-auto overflow-x-auto">
          <table className="w-full min-w-[520px] text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-400">
                <th className="px-2 py-2">日付</th>
                <th className="px-2 py-2">顧客</th>
                <th className="px-2 py-2">カテゴリ</th>
                <th className="px-2 py-2 text-right">金額</th>
                <th className="px-2 py-2">区分</th>
                <th className="px-2 py-2">根拠</th>
              </tr>
            </thead>
            <tbody>
              {breakdownRows.map(r => (
                <tr key={r.id} className="border-b border-slate-50">
                  <td className="px-2 py-2 whitespace-nowrap">{r.entry_date}</td>
                  <td className="px-2 py-2">{r.payer_name}</td>
                  <td className="px-2 py-2">{r.category}</td>
                  <td className="px-2 py-2 text-right font-medium">{formatAmount(r.amount_excl_tax)}</td>
                  <td className="px-2 py-2">
                    <span className={`badge text-xs ${r.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {r.status === 'confirmed' ? '確定' : '見込み'}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-slate-500">
                    {r.id.startsWith('pipeline-') ? 'パイプライン見込み'
                      : r.id.startsWith('contract-forecast-') ? '月額契約の見込み'
                      : r.source === 'project' ? '案件由来'
                      : '手入力'}
                  </td>
                </tr>
              ))}
              {breakdownRows.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-slate-300">該当する明細はありません</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50/70">
                <td colSpan={3} className="px-2 py-2 font-semibold text-slate-900">合計</td>
                <td className="px-2 py-2 text-right font-semibold text-slate-900">
                  {formatAmount(breakdownRows.reduce((s, r) => s + r.amount_excl_tax, 0))}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </Modal>

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
