'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Modal } from '@/components/Modal'
import { TaxAmountInput } from '@/components/TaxAmountInput'
import {
  fetchProjects, fetchCustomers, fetchProfiles, insertProject, updateProjectStatus,
  formatAmount, formatDate, type DbProject, type DbCustomer, type DbProfile,
} from '@/lib/db'

const COLUMNS = [
  { key: 'planning',    label: '見込み',     dot: 'bg-slate-400' },
  { key: 'in_progress', label: '申請準備中', dot: 'bg-amber-500' },
  { key: 'submitted',   label: '申請済み',   dot: 'bg-indigo-500' },
  { key: 'accepted',    label: '採択',       dot: 'bg-emerald-500' },
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
const WEB_COLOR   = { border: 'border-l-teal-400',  badge: 'bg-teal-100 text-teal-700',   dot: 'bg-teal-400' }
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
const SUCCESS_FEE_OPTIONS = [8, 9, 10, 11, 12, 13, 14, 15]

export default function ProjectsPage() {
  const [projects,  setProjects]  = useState<DbProject[]>([])
  const [customers, setCustomers] = useState<DbCustomer[]>([])
  const [members,   setMembers]   = useState<DbProfile[]>([])
  const [loading,   setLoading]   = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [subsidyChoice, setSubsidyChoice] = useState(SUBSIDY_NAMES[0]!)
  const [projectType, setProjectType] = useState<'subsidy' | 'web'>('subsidy')
  const [typeFilter, setTypeFilter] = useState<'all' | 'subsidy' | 'web'>('all')

  const load = () => {
    Promise.all([fetchProjects(), fetchCustomers(), fetchProfiles()])
      .then(([p, c, m]) => { setProjects(p); setCustomers(c); setMembers(m.filter(x => x.is_active)) })
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
    try {
      await insertProject({
        title:             f.get('title') as string,
        project_type:      projectType,
        subsidy_name:      projectType === 'web' ? null : subsidyName,
        customer_id:       (f.get('customer_id') as string) || null,
        applied_amount:    projectType === 'web' ? null : (f.get('amount') ? Number(f.get('amount')) * 10_000 : null),
        deadline:          projectType === 'web' ? null : (f.get('deadline') as string) || null,
        base_fee:          projectType === 'web' ? null : (f.get('base_fee') ? Number(f.get('base_fee')) : null),
        success_fee_rate:  projectType === 'web' ? null : (f.get('success_fee_rate') ? Number(f.get('success_fee_rate')) : null),
        web_fee_excl_tax:  projectType === 'web' ? (f.get('web_fee_excl_tax') ? Number(f.get('web_fee_excl_tax')) : null) : null,
        payment_due_date:  projectType === 'web' ? (f.get('payment_due_date') as string) || null : null,
        homepage_url:      (f.get('homepage_url') as string)?.trim() || null,
        notes:             (f.get('notes') as string)?.trim() || null,
        assigned_user_id:   (f.get('assigned_user_id') as string) || null,
        assigned_user_id_2: (f.get('assigned_user_id_2') as string) || null,
      })
      setModalOpen(false)
      setSubsidyChoice(SUBSIDY_NAMES[0]!)
      setProjectType('subsidy')
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

  const visibleProjects = projects.filter(p => typeFilter === 'all' || p.project_type === typeFilter)
  const legendItems = typeFilter === 'web'
    ? LEGEND_ITEMS.filter(item => item.name === 'WEB制作')
    : typeFilter === 'subsidy'
      ? LEGEND_ITEMS.filter(item => item.name !== 'WEB制作')
      : LEGEND_ITEMS

  return (
    <div className="flex h-full flex-col gap-6 p-4 sm:p-6">
      <PageHeader title="案件進捗管理" description={`進行中 ${visibleProjects.filter(p => p.status !== 'completed' && p.status !== 'rejected' && p.status !== 'lost').length} 件`}>
        <div className="inline-flex rounded-lg border border-slate-200 p-1">
          {([['all', '全案件'], ['subsidy', '補助金'], ['web', 'WEB']] as const).map(([key, label]) => (
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
        <button className="btn-primary text-sm" onClick={() => setModalOpen(true)}>+ 新規案件</button>
      </PageHeader>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
        {legendItems.map(item => (
          <span key={item.name} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`h-2 w-2 rounded-full ${item.dot}`} />
            {item.name}
          </span>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map(col => {
          const items = visibleProjects.filter(p => p.status === col.key)
          return (
            <div key={col.key} className="flex flex-col rounded-2xl bg-slate-50/80 p-3">
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                <h3 className="text-sm font-semibold text-slate-700">{col.label}</h3>
                <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">{items.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {items.map(p => {
                  const color = getProjectColor(p)
                  return (
                  <div key={p.id} className={`card border-l-4 ${color.border} p-2.5 transition-shadow hover:shadow-md`}>
                    <span className={`badge mb-1.5 text-[10px] ${color.badge}`}>
                      {p.project_type === 'web' ? 'WEB制作' : (p.subsidy_name ?? 'その他')}
                    </span>
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/projects/${p.id}`} className="min-w-0 truncate text-sm font-semibold leading-snug text-slate-900 hover:text-brand-600 hover:underline">
                        {p.title}
                      </Link>
                      <span className="flex-shrink-0 text-xs font-semibold text-slate-700">
                        {p.project_type === 'web'
                          ? formatAmount(p.web_fee_excl_tax)
                          : formatAmount(p.applied_amount)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span className="min-w-0 truncate">{p.customers?.company_name ?? '—'}</span>
                      <span className="flex-shrink-0 text-slate-400">
                        {p.project_type === 'web' ? `入金 ${formatDate(p.payment_due_date)}` : `〆 ${formatDate(p.deadline)}`}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-50 pt-2">
                      <span className="min-w-0 truncate text-xs text-slate-500">
                        {[p.profiles?.full_name, p.assignee2?.full_name].filter(Boolean).join('・') || '—'}
                      </span>
                      <select
                        className="flex-shrink-0 rounded-lg border border-slate-200 px-1 py-0.5 text-xs text-slate-600"
                        value={p.status}
                        onChange={e => moveStatus(p.id, e.target.value)}
                      >
                        {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                        <option value="rejected">不採択</option>
                        <option value="lost">失注</option>
                        <option value="completed">完了</option>
                      </select>
                    </div>
                  </div>
                  )
                })}
                {!loading && items.length === 0 && (
                  <p className="py-8 text-center text-xs text-slate-300">案件なし</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <Modal title="新規案件" open={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">案件名 *</label>
            <input name="title" required className="input" placeholder="ものづくり補助金 第18回" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            {projectType === 'subsidy' ? (
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">補助金名 *</label>
                <select
                  className="input"
                  value={subsidyChoice}
                  onChange={e => setSubsidyChoice(e.target.value)}
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
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">顧客</label>
              <select name="customer_id" className="input" defaultValue="">
                <option value="">未設定（あとで紐付け可）</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
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
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">基本料金</label>
                  <select name="base_fee" className="input" defaultValue="">
                    <option value="">未設定</option>
                    {BASE_FEE_OPTIONS.map(v => <option key={v} value={v}>{(v / 10_000).toFixed(0)}万円</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">成功報酬</label>
                  <select name="success_fee_rate" className="input" defaultValue="">
                    <option value="">未設定</option>
                    {SUCCESS_FEE_OPTIONS.map(v => <option key={v} value={v}>{v}%</option>)}
                  </select>
                </div>
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
