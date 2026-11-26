'use client'

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import Link from 'next/link'
import {
  DndContext, MouseSensor, TouchSensor, useSensor, useSensors, closestCenter, type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { PageHeader } from '@/components/layout/PageHeader'
import { Modal } from '@/components/Modal'
import { TaxAmountInput } from '@/components/TaxAmountInput'
import { buildZestasBillingItems, monthLabel, type ZestasBillingItem } from '@/lib/zestasBilling'
import {
  fetchProjects, fetchCustomers, fetchPartnerAgencies, fetchProfiles, fetchMyProfile, fetchMyProjectOrders, saveMyProjectOrders, insertProject, insertCustomer, updateProjectStatus, updateResultReportStatus, updateZestasBilledDate, updateZestasPaidDate, updateZestasAmount, SUPPORT_ITEMS,
  formatAmount, formatDate, defaultReferralBase, type DbProject, type DbCustomer, type DbProfile, type DbPartnerAgency,
} from '@/lib/db'

const COLUMNS = [
  { key: 'planning',    label: '見込み',     dot: 'bg-slate-400' },
  { key: 'in_progress', label: '申請準備中', dot: 'bg-amber-500' },
  { key: 'submitted',   label: '申請済み',   dot: 'bg-indigo-500' },
  { key: 'accepted',    label: '採択',       dot: 'bg-emerald-500' },
  { key: 'rejected',    label: '不採択',     dot: 'bg-rose-400' },
] as const

const RESULT_REPORT_COLUMNS = [
  { key: 'estimate_prep',      label: '見積書準備',   dot: 'bg-slate-400' },
  { key: 'grant_application',  label: '交付申請',     dot: 'bg-amber-500' },
  { key: 'in_execution',       label: '補助事業実行中', dot: 'bg-indigo-500' },
  { key: 'result_report',      label: '実績報告申請', dot: 'bg-emerald-500' },
] as const

const SUBSIDY_NAMES = [
  '省力化投資補助金',
  '小規模事業者持続化補助金',
  '新事業進出・ものづくり補助金',
  'デジタル化・AI導入補助金',
  '成長加速化補助金',
  '事業承継・M&A補助金',
]

// 補助金名ごとにカードを色分けするためのマップ。一目で案件の種類が
// わかるよう、左ボーダー・小さなバッジ・凡例の3箇所で同じ色を使う。
const SUBSIDY_COLORS: Record<string, { border: string; badge: string; dot: string }> = {
  '省力化投資補助金':             { border: 'border-l-indigo-400', badge: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-400' },
  '小規模事業者持続化補助金':      { border: 'border-l-emerald-400', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-400' },
  '新事業進出・ものづくり補助金':  { border: 'border-l-amber-400', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
  'デジタル化・AI導入補助金':      { border: 'border-l-sky-400', badge: 'bg-sky-100 text-sky-700', dot: 'bg-sky-400' },
  '成長加速化補助金':             { border: 'border-l-rose-400', badge: 'bg-rose-100 text-rose-700', dot: 'bg-rose-400' },
  '事業承継・M&A補助金':          { border: 'border-l-purple-400', badge: 'bg-purple-100 text-purple-700', dot: 'bg-purple-400' },
}
const WEB_COLOR   = { border: 'border-l-lime-400',  badge: 'bg-lime-100 text-lime-700',   dot: 'bg-lime-400' }
const OTHER_COLOR = { border: 'border-l-slate-300', badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' }

function getProjectColor(p: DbProject) {
  if (p.project_type === 'web') return WEB_COLOR
  const known = p.subsidy_name ? SUBSIDY_COLORS[p.subsidy_name] : undefined
  return known ?? OTHER_COLOR
}

const LEGEND_ITEMS = [
  ...SUBSIDY_NAMES.map(name => ({ name, ...SUBSIDY_COLORS[name]! })),
  { name: 'WEB制作', ...WEB_COLOR },
  { name: 'その他', ...OTHER_COLOR },
]

const BASE_FEE_OPTIONS = [100_000, 120_000, 150_000]
const SUCCESS_FEE_OPTIONS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]

// 長押し（約0.35秒）でつかんで、同じ列の中で並べ替えできるカード。
// 長押し前に指やマウスが動いたとき（スクロールなど）はつかまない。
function SortableCard({ id, className, title, children }: {
  id: string
  className: string
  title?: string
  children: ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      role={undefined}
      title={title}
      className={`${className} ${isDragging ? 'relative z-10 cursor-grabbing shadow-xl ring-2 ring-brand-300' : ''}`}
    >
      {children}
    </div>
  )
}

export default function ProjectsPage() {
  const [projects,  setProjects]  = useState<DbProject[]>([])
  const [customers, setCustomers] = useState<DbCustomer[]>([])
  const [agencies, setAgencies] = useState<DbPartnerAgency[]>([])
  const [members,   setMembers]   = useState<DbProfile[]>([])
  const [loading,   setLoading]   = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [subsidyChoice, setSubsidyChoice] = useState(SUBSIDY_NAMES[0]!)
  const [agencyChoice, setAgencyChoice] = useState('')
  const [referralChoice, setReferralChoice] = useState(defaultReferralBase(SUBSIDY_NAMES[0]!))
  const [customerChoice, setCustomerChoice] = useState('')
  const [projectType, setProjectType] = useState<'subsidy' | 'web'>('subsidy')
  const [typeFilter, setTypeFilter] = useState<'all' | 'subsidy' | 'web'>('all')
  const [view, setView] = useState<'progress' | 'result_report' | 'zestas_billing'>('progress')
  const [contractEntity, setContractEntity] = useState<'salud' | 'zestas'>('salud')
  const [entityFilter, setEntityFilter] = useState<'all' | 'salud' | 'zestas'>('all')
  const [billStatus, setBillStatus] = useState<'unbilled' | 'billed' | 'all'>('unbilled')
  const [billMonth, setBillMonth] = useState<string>('all')
  const [baseFeeChoice, setBaseFeeChoice] = useState<string>('')
  // 新規登録フォームで「実績報告サポート」にチェックが入っているか（基本料金・成功報酬の代わりに報酬を自由入力する）
  const [supportChecked, setSupportChecked] = useState(false)
  const [meId, setMeId] = useState<string | null>(null)
  // 自分用のカード並び順（project_id → 順番）。未設定のカードは元の並びで、並べ替え済みのカードの後ろに並ぶ
  const [orders, setOrders] = useState<Record<string, number>>({})
  // ブラウザごとの個人設定 — WEB事業に関係のないメンバー（例: 栗原さん）が
  // 自分の進捗管理からWEB案件のカードを常時非表示にできるようにする。
  const [hideWebCards, setHideWebCards] = useState(false)

  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('view')
    if (v === 'result_report') setView('result_report')
    if (v === 'zestas_billing') { setView('zestas_billing'); setContractEntity('zestas') }
    setHideWebCards(localStorage.getItem('projects_hideWebCards') === 'true')
  }, [])

  const toggleHideWebCards = (checked: boolean) => {
    setHideWebCards(checked)
    localStorage.setItem('projects_hideWebCards', String(checked))
    if (checked && typeFilter === 'web') setTypeFilter('all')
  }

  const load = () => {
    Promise.all([
      fetchProjects(), fetchCustomers(), fetchPartnerAgencies().catch(() => []), fetchProfiles(), fetchMyProfile().catch(() => null),
      fetchMyProjectOrders().catch(() => ({} as Record<string, number>)),
    ])
      .then(([p, c, ag, m, mine, o]) => { setProjects(p); setCustomers(c); setAgencies(ag); setMembers(m.filter(x => x.is_active)); setMeId(mine?.id ?? null); setOrders(o) })
      .catch(() => setError('データの取得に失敗しました'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const f = new FormData(e.currentTarget)
    const subsidyName = subsidyChoice === '__other__' ? (f.get('subsidy_name_other') as string) : subsidyChoice
    const baseFee = baseFeeChoice === '__other__'
      ? (f.get('base_fee_other') ? Number(f.get('base_fee_other')) * 10_000 : null)
      : (f.get('base_fee') ? Number(f.get('base_fee')) : null)
    try {
      let customerId = (f.get('customer_id') as string) || null
      if (customerChoice === '__other__') {
        const freeName = (f.get('customer_name_other') as string)?.trim()
        if (freeName) {
          customerId = await insertCustomer({
            company_name: freeName,
            industry: '',
            employee_count: null,
            status: 'prospect',
            phone: '',
            address: '',
            contact_name: '',
          })
        }
      }
      await insertProject({
        title:             f.get('title') as string,
        project_type:      projectType,
        // 実績報告サポートから追加した場合は採択済み扱いで登録（案件進捗の見込み〜申請フェーズを経由せず、この一覧に直接表示するため）
        status:            view === 'result_report' ? 'accepted' : 'planning',
        // 案件進捗ボードには出さず、実績報告サポート画面だけに表示する
        pipeline_hidden:   view === 'result_report',
        subsidy_name:      projectType === 'web' ? null : subsidyName,
        customer_id:       customerId,
        applied_amount:    projectType === 'web' ? null : (f.get('amount') ? Number(f.get('amount')) * 10_000 : null),
        deadline:          projectType === 'web' ? null : (f.get('deadline') as string) || null,
        base_fee:          projectType === 'web' ? null : baseFee,
        success_fee_rate:  projectType === 'web' ? null : (f.get('success_fee_rate') ? Number(f.get('success_fee_rate')) : null),
        web_fee_excl_tax:  projectType === 'web' ? (f.get('web_fee_excl_tax') ? Number(f.get('web_fee_excl_tax')) : null) : null,
        payment_due_date:  projectType === 'web' ? (f.get('payment_due_date') as string) || null : null,
        homepage_url:      (f.get('homepage_url') as string)?.trim() || null,
        notes:             (f.get('notes') as string)?.trim() || null,
        referral_none:     f.get('referral_none') === 'on',
        agency_id:         agencyChoice && agencyChoice !== '__manual__' ? agencyChoice : null,
        agency_name_manual: agencyChoice === '__manual__' ? ((f.get('agency_name_manual') as string)?.trim() || null) : null,
        referral_fee:      f.get('referral_fee') ? Number(f.get('referral_fee')) : null,
        assigned_user_id:   (f.get('assigned_user_id') as string) || null,
        assigned_user_id_2: (f.get('assigned_user_id_2') as string) || null,
        contract_entity:   contractEntity,
        support_items:     f.getAll('support_items') as string[],
        support_fee:       f.get('support_fee') ? Number(f.get('support_fee')) : null,
        support_fee_note:  (f.get('support_fee_note') as string | null)?.trim() || null,
        support_fee_due_date: (f.get('support_fee_due_date') as string) || null,
      })
      setModalOpen(false)
      setContractEntity(view === 'zestas_billing' ? 'zestas' : 'salud')
      setSubsidyChoice(SUBSIDY_NAMES[0]!)
      setReferralChoice(defaultReferralBase(SUBSIDY_NAMES[0]!))
      setAgencyChoice('')
      setProjectType('subsidy')
      setBaseFeeChoice('')
      setCustomerChoice('')
      load()
    } catch {
      setError('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const moveStatus = async (id: string, status: string) => {
    // 楽観的更新 — 失敗時は再取得で巻き戻す
    setProjects(prev => prev.map(p => p.id === id ? { ...p, status: status as DbProject['status'] } : p))
    try {
      await updateProjectStatus(id, status)
    } catch {
      setError('ステータスの更新に失敗しました')
      load()
    }
  }

  const moveResultReportStatus = async (id: string, resultReportStatus: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, result_report_status: resultReportStatus as DbProject['result_report_status'] } : p))
    try {
      await updateResultReportStatus(id, resultReportStatus)
    } catch {
      setError('ステータスの更新に失敗しました')
      load()
    }
  }

  // 長押しでつかむ設定（マウス・タッチ共通）。短いクリックは従来どおりリンク等が動く
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { delay: 350, tolerance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 350, tolerance: 8 } }),
  )
  const justDragged = useRef(false)

  const sortByOrder = (list: DbProject[]) =>
    [...list].sort((a, b) =>
      (orders[a.id] ?? Number.MAX_SAFE_INTEGER) - (orders[b.id] ?? Number.MAX_SAFE_INTEGER))

  // 並べ替え後の並びを保存する（0,1,2…。自分用）
  const applyOrder = async (next: DbProject[]) => {
    if (!meId) return
    const updates = next.map((p, i) => ({ project_id: p.id, sort_order: i }))
    const prev = orders
    setOrders(o => ({ ...o, ...Object.fromEntries(updates.map(u => [u.project_id, u.sort_order])) }))
    try {
      await saveMyProjectOrders(meId, updates)
    } catch {
      setOrders(prev)
      setError('並び順の保存に失敗しました')
    }
  }

  // columnOf: 今の画面で「同じ列」とみなすキー。列をまたぐ移動はステータスのセレクトで行う
  const handleDragEnd = (columnOf: (p: DbProject) => string, pool: DbProject[]) => (e: DragEndEvent) => {
    justDragged.current = true
    setTimeout(() => { justDragged.current = false }, 150)
    const { active, over } = e
    if (!over || active.id === over.id) return
    const a = pool.find(p => p.id === active.id)
    const b = pool.find(p => p.id === over.id)
    if (!a || !b || columnOf(a) !== columnOf(b)) return
    const items = sortByOrder(pool.filter(p => columnOf(p) === columnOf(a)))
    const from = items.findIndex(p => p.id === a.id)
    const to = items.findIndex(p => p.id === b.id)
    if (from < 0 || to < 0) return
    applyOrder(arrayMove(items, from, to))
  }

  // ドラッグ直後に指/マウスを離した位置のリンクが開いてしまうのを防ぐ
  const swallowClickAfterDrag = (e: { preventDefault: () => void; stopPropagation: () => void }) => {
    if (justDragged.current) { e.preventDefault(); e.stopPropagation() }
  }

  const visibleProjects = projects.filter(p =>
    !p.pipeline_hidden &&
    (typeFilter === 'all' || p.project_type === typeFilter) &&
    (entityFilter === 'all' || p.contract_entity === entityFilter) &&
    !(hideWebCards && p.project_type === 'web'),
  )
  const legendItems = typeFilter === 'web'
    ? LEGEND_ITEMS.filter(item => item.name === 'WEB制作')
    : (typeFilter === 'subsidy' || hideWebCards)
      ? LEGEND_ITEMS.filter(item => item.name !== 'WEB制作')
      : LEGEND_ITEMS

  // 実績報告サポートの対象は「採択済みの補助金案件」のみ
  // ゼスタス請求リスト: 契約主体がゼスタスの案件を、基本料金・成功報酬の「請求項目」1行ずつに分解して扱う
  const zestasProjectCount = projects.filter(p => p.contract_entity === 'zestas' && p.status !== 'lost' && p.status !== 'rejected').length
  const allBillingItems = buildZestasBillingItems(projects)
  const statusItems = allBillingItems.filter(it => billStatus === 'all' || (billStatus === 'billed' ? !!it.billedDate : !it.billedDate))
  const monthTotals = Array.from(statusItems.reduce((m, it) => m.set(it.month, (m.get(it.month) ?? 0) + it.amount), new Map<string, number>()))
  const billingRows = statusItems.filter(it => billMonth === 'all' || it.month === billMonth)
  const billingRowsTotal = billingRows.reduce((sum, it) => sum + it.amount, 0)
  const unbilledTotal = allBillingItems.filter(it => !it.billedDate).reduce((sum, it) => sum + it.amount, 0)
  const toggleZestasBilled = async (it: ZestasBillingItem) => {
    const key = it.kind === 'base' ? 'zestas_base_billed_date' : 'zestas_success_billed_date'
    const next = it.billedDate ? null : new Date().toISOString().slice(0, 10)
    setProjects(prev => prev.map(x => x.id === it.projectId ? { ...x, [key]: next } : x))
    try {
      await updateZestasBilledDate(it.projectId, it.kind, next)
    } catch {
      setError('請求状況の更新に失敗しました')
      load()
    }
  }

  // ゼスタス請求額の調整（自由入力・税抜・円）。空にして保存すると自動計算の金額に戻る
  const [amountEditKey, setAmountEditKey] = useState<string | null>(null)
  const [amountEditValue, setAmountEditValue] = useState('')
  const saveZestasAmount = async (it: ZestasBillingItem) => {
    const trimmed = amountEditValue.trim()
    const next = trimmed === '' ? null : Number(trimmed)
    if (next != null && (!Number.isFinite(next) || next < 0)) { setError('金額は0以上の数字で入力してください'); return }
    const col = it.kind === 'base' ? 'zestas_base_amount' : 'zestas_success_amount'
    setProjects(prev => prev.map(x => x.id === it.projectId ? { ...x, [col]: next } : x))
    setAmountEditKey(null)
    try {
      await updateZestasAmount(it.projectId, it.kind, next)
    } catch {
      setError('金額の更新に失敗しました')
      load()
    }
  }

  // ゼスタスからの入金チェック（押した日が入金日。もう一度押すと取り消し）
  const toggleZestasPaid = async (it: ZestasBillingItem) => {
    const key = it.kind === 'base' ? 'zestas_base_paid_date' : 'zestas_success_paid_date'
    const next = it.paidDate ? null : new Date().toISOString().slice(0, 10)
    setProjects(prev => prev.map(x => x.id === it.projectId ? { ...x, [key]: next } : x))
    try {
      await updateZestasPaidDate(it.projectId, it.kind, next)
    } catch {
      setError('入金状況の更新に失敗しました')
      load()
    }
  }
  // 請求済みだが、ゼスタスからまだ入金されていない合計
  const unpaidBilledTotal = allBillingItems.filter(it => it.billedDate && !it.paidDate).reduce((sum, it) => sum + it.amount, 0)

  // 実績報告サポートを受注した（支援項目にチェックのある）採択済みの補助金案件のみ
  const resultReportProjects = projects.filter(p =>
    p.status === 'accepted' && p.project_type === 'subsidy' && (p.support_items ?? []).includes('実績報告サポート'))

  return (
    <div className="flex h-full flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        title="案件進捗管理"
        description={view === 'progress'
          ? `進行中 ${visibleProjects.filter(p => p.status !== 'completed' && p.status !== 'rejected' && p.status !== 'lost').length} 件`
          : view === 'zestas_billing'
            ? `ゼスタス契約案件 ${zestasProjectCount} 件`
            : `実績報告サポート対象 ${resultReportProjects.length} 件`}
      >
        <div className="inline-flex rounded-lg border border-slate-200 p-1">
          {([['progress', '案件進捗'], ['result_report', '実績報告サポート'], ['zestas_billing', 'ゼスタス請求リスト']] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                view === key ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {view === 'progress' && (
          <div className="inline-flex rounded-lg border border-slate-200 p-1">
            {([['all', '全案件'], ['subsidy', '補助金'], ['web', 'WEB']] as const)
              .filter(([key]) => !(hideWebCards && key === 'web'))
              .map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTypeFilter(key)}
                  className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                    typeFilter === key ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
          </div>
        )}
        {view === 'progress' && (
          <div className="inline-flex rounded-lg border border-slate-200 p-1">
            {([['all', '契約主体: すべて'], ['salud', 'Salud'], ['zestas', 'ゼスタス']] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setEntityFilter(key)}
                className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                  entityFilter === key ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {view === 'progress' && (
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            <input
              type="checkbox"
              checked={hideWebCards}
              onChange={e => toggleHideWebCards(e.target.checked)}
              className="rounded border-slate-300"
            />
            WEB案件を表示しない
          </label>
        )}
        <button
          className="btn-primary text-sm"
          onClick={() => {
            if (view === 'result_report' || view === 'zestas_billing') setProjectType('subsidy')
            setContractEntity(view === 'zestas_billing' ? 'zestas' : 'salud')
            setSupportChecked(view === 'result_report')
            setModalOpen(true)
          }}
        >
          + 新規案件
        </button>
      </PageHeader>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {view === 'result_report' && (
        <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2 text-xs text-amber-700">
          実績報告サポートを受注した採択済みの補助金案件（案件の「支援項目」にチェックしたもの）を対象に、見積書準備 → 交付申請 → 補助事業実行中 → 実績報告申請 の進捗を管理します。
        </div>
      )}

      {view === 'progress' && (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
        {legendItems.map(item => (
          <span key={item.name} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`h-2 w-2 rounded-full ${item.dot}`} />
            {item.name}
          </span>
        ))}
      </div>
      )}

      {view === 'progress' && (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd(p => p.status, visibleProjects)}>
      <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {COLUMNS.map(col => {
          const items = sortByOrder(visibleProjects.filter(p => p.status === col.key))
          return (
            <div key={col.key} className="flex flex-col rounded-2xl bg-slate-50/80 p-3">
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                <h3 className="text-sm font-semibold text-slate-700">{col.label}</h3>
                <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">{items.length}</span>
              </div>
              <SortableContext items={items.map(p => p.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-1.5">
                {items.map(p => {
                  const color = getProjectColor(p)
                  return (
                  <SortableCard key={p.id} id={p.id} title="長押しで並べ替え" className={`card select-none border-l-4 ${color.border} p-1.5 transition-shadow hover:shadow-md`}>
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex min-w-0 items-center gap-1">
                        <span className={`badge max-w-[92px] truncate whitespace-nowrap px-1.5 py-0 text-[9px] leading-4 ${color.badge}`}>
                          {p.project_type === 'web' ? 'WEB制作' : (p.subsidy_name ?? 'その他')}
                        </span>
                        {p.contract_entity === 'zestas' && (
                          <span className="badge flex-shrink-0 whitespace-nowrap bg-orange-100 px-1.5 py-0 text-[9px] leading-4 text-orange-700">ゼスタス</span>
                        )}
                        <span
                          className={`badge flex-shrink-0 whitespace-nowrap px-1.5 py-0 text-[9px] leading-4 ${
                            p.payment_received_date
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {p.payment_received_date ? '入金済み' : '未入金'}
                        </span>
                      </div>
                      <span className="flex-shrink-0 text-xs font-semibold text-slate-700">
                        {p.project_type === 'web'
                          ? formatAmount(p.web_fee_excl_tax)
                          : formatAmount(p.applied_amount)}
                      </span>
                    </div>
                    <Link href={`/projects/${p.id}`} onClickCapture={swallowClickAfterDrag} className="mt-0.5 block truncate text-sm font-semibold leading-tight text-slate-900 hover:text-brand-600 hover:underline">
                      {p.customers?.company_name ?? '—'}
                    </Link>
                    <div className="mt-0.5 flex items-center justify-between gap-1.5 text-[10px] text-slate-400">
                      <span className="min-w-0 truncate">
                        {[p.profiles?.full_name, p.assignee2?.full_name].filter(Boolean).join('・') || '—'}
                        {' ・ '}
                        {p.project_type === 'web' ? `入金 ${formatDate(p.payment_due_date)}` : `〆 ${formatDate(p.deadline)}`}
                      </span>
                      <select
                        className="w-20 flex-shrink-0 rounded-lg border border-slate-200 px-1 py-0 text-[10px] leading-4 text-slate-600"
                        value={p.status}
                        onChange={e => moveStatus(p.id, e.target.value)}
                      >
                        {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                        <option value="lost">失注</option>
                        <option value="completed">完了</option>
                      </select>
                    </div>
                  </SortableCard>
                  )
                })}
                {!loading && items.length === 0 && (
                  <p className="py-8 text-center text-xs text-slate-300">案件なし</p>
                )}
              </div>
              </SortableContext>
            </div>
          )
        })}
      </div>
      </DndContext>
      )}

      {view === 'zestas_billing' && (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="card p-4"><p className="text-xs text-slate-400">未請求 合計（全期間）</p><p className="mt-1 text-xl font-bold text-orange-600">{formatAmount(unbilledTotal)}</p></div>
          <div className="card p-4"><p className="text-xs text-slate-400">請求済・未入金 合計</p><p className="mt-1 text-xl font-bold text-red-600">{formatAmount(unpaidBilledTotal)}</p></div>
          <div className="card p-4"><p className="text-xs text-slate-400">表示中の項目</p><p className="mt-1 text-xl font-bold text-slate-900">{billingRows.length} 件</p></div>
          <div className="card p-4"><p className="text-xs text-slate-400">表示中の合計（税抜）</p><p className="mt-1 text-xl font-bold text-slate-900">{formatAmount(billingRowsTotal)}</p></div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 p-1">
            {([['unbilled', '未請求'], ['billed', '請求済'], ['all', 'すべて']] as const).map(([key, label]) => (
              <button key={key} type="button" onClick={() => { setBillStatus(key); setBillMonth('all') }}
                className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${billStatus === key ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}>
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400">請求対象月: 基本料金＝入金予定日の月／成功報酬＝採択発表日の月／請求済＝請求した月</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setBillMonth('all')}
            className={`rounded-xl border px-3 py-2 text-left text-xs ${billMonth === 'all' ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
            <span className="block text-slate-500">すべての月</span>
            <span className="block text-sm font-semibold text-slate-900">{formatAmount(monthTotals.reduce((sum, [, v]) => sum + v, 0))}</span>
          </button>
          {monthTotals.map(([month, total]) => (
            <button key={month} type="button" onClick={() => setBillMonth(month)}
              className={`rounded-xl border px-3 py-2 text-left text-xs ${billMonth === month ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
              <span className="block text-slate-500">{monthLabel(month)}</span>
              <span className="block text-sm font-semibold text-slate-900">{formatAmount(total)}</span>
            </button>
          ))}
        </div>

        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                <th className="px-4 py-3 font-medium">請求対象月</th>
                <th className="px-3 py-3 font-medium">顧客・案件</th>
                <th className="px-3 py-3 font-medium">区分</th>
                <th className="px-3 py-3 text-right font-medium">金額（税抜）</th>
                <th className="px-3 py-3 font-medium">請求状況</th>
                <th className="px-3 py-3 font-medium">入金状況（ゼスタス）</th>
              </tr>
            </thead>
            <tbody>
              {billingRows.map(it => (
                <tr key={it.key} className="border-b border-slate-50 last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{monthLabel(it.month)}</td>
                  <td className="px-3 py-3">
                    <Link href={`/projects/${it.projectId}`} className="font-semibold text-slate-900 hover:text-brand-600 hover:underline">{it.customerName}</Link>
                    <p className="text-xs text-slate-400">{it.subsidyName}</p>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{it.kind === 'base' ? '基本料金' : '成功報酬'}</td>
                  <td className="px-3 py-3 text-right font-medium text-slate-800">
                    {amountEditKey === it.key ? (
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1">
                          <input
                            type="number" min="0" autoFocus
                            className="input h-8 w-28 py-0 text-right text-sm"
                            value={amountEditValue}
                            onChange={e => setAmountEditValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveZestasAmount(it); if (e.key === 'Escape') setAmountEditKey(null) }}
                            placeholder={String(it.autoAmount)}
                          />
                          <span className="text-xs text-slate-500">円</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <button type="button" className="rounded bg-brand-600 px-2 py-0.5 text-white" onClick={() => saveZestasAmount(it)}>保存</button>
                          <button type="button" className="text-slate-500 hover:underline" onClick={() => setAmountEditKey(null)}>キャンセル</button>
                        </div>
                        <p className="text-[10px] font-normal text-slate-400">空欄で保存すると自動の金額（{formatAmount(it.autoAmount)}）に戻ります<br />目安: 持続化補助金 5万円／その他 2〜5万円</p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        title="クリックで金額を調整"
                        className="rounded px-1 text-right hover:bg-slate-100"
                        onClick={() => { setAmountEditKey(it.key); setAmountEditValue(it.adjusted ? String(it.amount) : '') }}
                      >
                        {formatAmount(it.amount)}
                        <span className="ml-1 text-[10px] text-slate-400">✎</span>
                        {it.adjusted && <span className="block text-[10px] font-normal text-amber-600">調整済（元 {formatAmount(it.autoAmount)}）</span>}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <button type="button" onClick={() => toggleZestasBilled(it)}
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${it.billedDate ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                      {it.billedDate ? `請求済 ${formatDate(it.billedDate)}（取消）` : '未請求（クリックで請求済に）'}
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
                      <input type="checkbox" checked={!!it.paidDate} onChange={() => toggleZestasPaid(it)} className="h-4 w-4 rounded border-slate-300" />
                      {it.paidDate ? <span className="font-medium text-emerald-700">入金済 {formatDate(it.paidDate)}</span> : '入金済にする'}
                    </label>
                  </td>
                </tr>
              ))}
              {!loading && billingRows.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-xs text-slate-300">該当する請求項目がありません</td></tr>
              )}
            </tbody>
            {billingRows.length > 0 && (
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50/60">
                  <td colSpan={3} className="px-4 py-3 text-right text-xs text-slate-500">{billMonth === 'all' ? '合計' : `${monthLabel(billMonth)} 合計`}</td>
                  <td className="px-3 py-3 text-right font-bold text-slate-900">{formatAmount(billingRowsTotal)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <p className="text-xs text-slate-400">請求書は「請求書発行」で作成します。作成画面の「ゼスタス請求リストから項目を選ぶ」で、ここの項目を選んで取り込めます。</p>
      </div>
      )}

      {view === 'result_report' && (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd(p => p.result_report_status ?? RESULT_REPORT_COLUMNS[0].key, resultReportProjects)}>
      <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {RESULT_REPORT_COLUMNS.map(col => {
          const items = sortByOrder(resultReportProjects.filter(p => (p.result_report_status ?? RESULT_REPORT_COLUMNS[0].key) === col.key))
          return (
            <div key={col.key} className="flex flex-col rounded-2xl bg-slate-50/80 p-3">
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                <h3 className="text-sm font-semibold text-slate-700">{col.label}</h3>
                <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">{items.length}</span>
              </div>
              <SortableContext items={items.map(p => p.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-1.5">
                {items.map(p => {
                  const color = getProjectColor(p)
                  return (
                  <SortableCard key={p.id} id={p.id} title="長押しで並べ替え" className={`card select-none border-l-4 ${color.border} p-1.5 transition-shadow hover:shadow-md`}>
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex min-w-0 items-center gap-1">
                        <span className={`badge max-w-[92px] truncate whitespace-nowrap px-1.5 py-0 text-[9px] leading-4 ${color.badge}`}>
                          {p.subsidy_name ?? 'その他'}
                        </span>
                        <span
                          className={`badge flex-shrink-0 whitespace-nowrap px-1.5 py-0 text-[9px] leading-4 ${
                            p.payment_received_date
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {p.payment_received_date ? '入金済み' : '未入金'}
                        </span>
                      </div>
                      <span className="flex-shrink-0 text-xs font-semibold text-slate-700">
                        {formatAmount(p.applied_amount)}
                      </span>
                    </div>
                    <Link href={`/projects/${p.id}`} onClickCapture={swallowClickAfterDrag} className="mt-0.5 block truncate text-sm font-semibold leading-tight text-slate-900 hover:text-brand-600 hover:underline">
                      {p.customers?.company_name ?? '—'}
                    </Link>
                    <div className="mt-0.5 flex items-center justify-between gap-1.5 text-[10px] text-slate-400">
                      <span className="min-w-0 truncate">
                        {[p.profiles?.full_name, p.assignee2?.full_name].filter(Boolean).join('・') || '—'}
                        {' ・ 採択 '}{formatDate(p.result_at)}
                      </span>
                      <select
                        className="w-20 flex-shrink-0 rounded-lg border border-slate-200 px-1 py-0 text-[10px] leading-4 text-slate-600"
                        value={p.result_report_status ?? RESULT_REPORT_COLUMNS[0].key}
                        onChange={e => moveResultReportStatus(p.id, e.target.value)}
                      >
                        {RESULT_REPORT_COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                      </select>
                    </div>
                  </SortableCard>
                  )
                })}
                {!loading && items.length === 0 && (
                  <p className="py-8 text-center text-xs text-slate-300">案件なし</p>
                )}
              </div>
              </SortableContext>
            </div>
          )
        })}
      </div>
      </DndContext>
      )}

      <Modal title={view === 'result_report' ? '実績報告サポート対象の新規登録' : '新規案件'} open={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {view === 'result_report' && (
            <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2 text-xs text-amber-700">
              採択済みとして登録し、この一覧（見積書準備）に直接追加します。
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">案件名 *</label>
            <input name="title" required className="input" placeholder="ものづくり補助金 第18回" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {view !== 'result_report' && (
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">案件区分 *</label>
              <div className="flex gap-2">
                {(['subsidy', 'web'] as const).map(t => (
                  <button
                    key={t} type="button"
                    onClick={() => setProjectType(t)}
                    className={`flex-1 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors ${
                      projectType === t
                        ? 'border-brand-600 bg-brand-50 text-brand-700'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {t === 'subsidy' ? '補助金' : 'WEB制作'}
                  </button>
                ))}
              </div>
            </div>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">紹介元の代理店</label>
              <select name="agency_id" className="input" value={agencyChoice} onChange={e => { setAgencyChoice(e.target.value); const ag = agencies.find(a => a.id === e.target.value); setReferralChoice(ag && !ag.referral_base_enabled ? '' : defaultReferralBase(subsidyChoice === '__other__' ? null : subsidyChoice)) }}>
                <option value="">なし（直接案件）</option>
                {agencies.map(a => <option key={a.id} value={a.id}>{a.company_name}</option>)}
                <option value="__manual__">その他（手入力）</option>
              </select>
              {agencyChoice === '__manual__' && (
                <input
                  name="agency_name_manual" required className="input mt-2" placeholder="紹介元の名称（会社名・個人名など）"
                  defaultValue={""}
                />
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox" name="referral_none" className="h-4 w-4 rounded border-slate-300"
                  defaultChecked={false}
                />
                紹介料なし（紹介元は記録するが、紹介料は発生しない）
              </label>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">紹介料（基本料金分）</label>
              <select name="referral_fee" className="input" value={referralChoice} onChange={e => setReferralChoice(e.target.value)}>
                <option value="">未設定</option>
                <option value="10000">1万円</option>
                <option value="20000">2万円</option>
              </select>
              <p className="mt-1 text-xs text-slate-400">成功報酬分は成功報酬額の2％（補助金の窓口は50％・基本料金分なし）で自動計算します</p>
            </div>
            {projectType === 'subsidy' ? (
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">補助金名 *</label>
                <select
                  className="input"
                  value={subsidyChoice}
                  onChange={e => { setSubsidyChoice(e.target.value); setReferralChoice(defaultReferralBase(e.target.value)) }}
                >
                  {SUBSIDY_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
                  <option value="__other__">その他（自由入力）</option>
                </select>
                {subsidyChoice === '__other__' && (
                  <input
                    name="subsidy_name_other" required className="input mt-2"
                    placeholder="補助金名を入力"
                  />
                )}
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">契約主体</label>
              <select className="input" value={contractEntity} onChange={e => setContractEntity(e.target.value as 'salud' | 'zestas')}>
                <option value="salud">株式会社Salud</option>
                <option value="zestas">株式会社ゼスタス（ゼスタス請求リストに載ります）</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">顧客</label>
              <select
                name={customerChoice === '__other__' ? undefined : 'customer_id'}
                className="input"
                value={customerChoice}
                onChange={e => setCustomerChoice(e.target.value)}
              >
                <option value="">未設定（あとで紐付け可）</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                <option value="__other__">その他（自由入力・新規顧客として登録）</option>
              </select>
              {customerChoice === '__other__' && (
                <input
                  name="customer_name_other" required className="input mt-2"
                  placeholder="顧客名（会社名）を入力"
                />
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">社内担当1</label>
              <select name="assigned_user_id" className="input" defaultValue="">
                <option value="">未設定</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">社内担当2</label>
              <select name="assigned_user_id_2" className="input" defaultValue="">
                <option value="">未設定</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            </div>
            {projectType === 'subsidy' ? (
              <>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">申請額（万円）</label>
                  <input name="amount" type="number" className="input" placeholder="1000" />
                </div>
                {supportChecked ? (
                  <>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">実績報告サポート報酬（円・自由入力）</label>
                      <input name="support_fee" type="number" min="0" className="input" placeholder="150000" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">報酬 入金予定日</label>
                      <input name="support_fee_due_date" type="date" className="input" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">報酬の内容・備考（自由入力）</label>
                      <input name="support_fee_note" className="input" placeholder="例: 実績報告書作成代行 一式、入金は報告完了後" />
                    </div>
                  </>
                ) : (
                <>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">基本料金</label>
                  <select
                    name="base_fee"
                    className="input"
                    value={baseFeeChoice}
                    onChange={e => setBaseFeeChoice(e.target.value)}
                  >
                    <option value="">未設定</option>
                    {BASE_FEE_OPTIONS.map(v => <option key={v} value={v}>{(v / 10_000).toFixed(0)}万円</option>)}
                    <option value="__other__">その他（自由入力）</option>
                  </select>
                  {baseFeeChoice === '__other__' && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <input
                        name="base_fee_other" type="number" required className="input"
                        placeholder="130"
                      />
                      <span className="flex-shrink-0 text-sm text-slate-500">万円</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">成功報酬</label>
                  <select name="success_fee_rate" className="input" defaultValue="">
                    <option value="">未設定</option>
                    {SUCCESS_FEE_OPTIONS.map(v => <option key={v} value={v}>{v}%</option>)}
                  </select>
                </div>
                </>
                )}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">申請期限</label>
                  <input name="deadline" type="date" className="input" />
                </div>
              </>
            ) : (
              <>
                <TaxAmountInput name="web_fee_excl_tax" label="制作費" />
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">入金予定日</label>
                  <input name="payment_due_date" type="date" className="input" />
                </div>
              </>
            )}
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">HP URL</label>
              <input name="homepage_url" type="url" className="input" placeholder="https://example.co.jp" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">支援項目</label>
              <div className="flex flex-wrap gap-3">
                {SUPPORT_ITEMS.map(item => (
                  <label key={item} className="flex items-center gap-1.5 text-sm text-slate-700">
                    <input type="checkbox" name="support_items" value={item} checked={supportChecked} onChange={e => setSupportChecked(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                    {item}
                  </label>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">その他メモ</label>
              <textarea name="notes" rows={3} className="input" placeholder="補足・特記事項など" />
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
