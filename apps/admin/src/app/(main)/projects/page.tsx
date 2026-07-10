'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Modal } from '@/components/Modal'
import {
  fetchProjects, fetchCustomers, insertProject, updateProjectStatus,
  formatAmount, formatDate, type DbProject, type DbCustomer,
} from '@/lib/db'

const COLUMNS = [
  { key: 'planning',    label: '準備中',     dot: 'bg-slate-400' },
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

const BASE_FEE_OPTIONS = [100_000, 120_000, 150_000]
const SUCCESS_FEE_OPTIONS = [8, 9, 10, 11, 12, 13, 14, 15]

export default function ProjectsPage() {
  const [projects,  setProjects]  = useState<DbProject[]>([])
  const [customers, setCustomers] = useState<DbCustomer[]>([])
  const [loading,   setLoading]   = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [subsidyChoice, setSubsidyChoice] = useState(SUBSIDY_NAMES[0]!)

  const load = () => {
    Promise.all([fetchProjects(), fetchCustomers()])
      .then(([p, c]) => { setProjects(p); setCustomers(c) })
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
        subsidy_name:      subsidyName,
        customer_id:       f.get('customer_id') as string,
        applied_amount:    f.get('amount') ? Number(f.get('amount')) * 10_000 : null,
        deadline:          (f.get('deadline') as string) || null,
        base_fee:          f.get('base_fee') ? Number(f.get('base_fee')) : null,
        success_fee_rate:  f.get('success_fee_rate') ? Number(f.get('success_fee_rate')) : null,
      })
      setModalOpen(false)
      setSubsidyChoice(SUBSIDY_NAMES[0]!)
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

  return (
    <div className="flex h-full flex-col gap-6 p-4 sm:p-6">
      <PageHeader title="案件管理" description={`進行中 ${projects.filter(p => p.status !== 'completed' && p.status !== 'rejected').length} 件`}>
        <button className="btn-primary text-sm" onClick={() => setModalOpen(true)}>+ 新規案件</button>
      </PageHeader>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map(col => {
          const items = projects.filter(p => p.status === col.key)
          return (
            <div key={col.key} className="flex flex-col rounded-2xl bg-slate-50/80 p-3">
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                <h3 className="text-sm font-semibold text-slate-700">{col.label}</h3>
                <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">{items.length}</span>
              </div>
              <div className="flex flex-col gap-2.5">
                {items.map(p => (
                  <div key={p.id} className="card p-3.5 transition-shadow hover:shadow-md">
                    <Link href={`/projects/${p.id}`} className="text-sm font-semibold leading-snug text-slate-900 hover:text-brand-600 hover:underline">
                      {p.title}
                    </Link>
                    <p className="mt-1 text-xs text-slate-500">{p.customers?.company_name ?? '—'}</p>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">{formatAmount(p.applied_amount)}</span>
                      <span className="text-slate-400">〆 {formatDate(p.deadline)}</span>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between border-t border-slate-50 pt-2.5">
                      <span className="text-xs text-slate-500">{p.profiles?.full_name ?? '—'}</span>
                      <select
                        className="rounded-lg border border-slate-200 px-1.5 py-1 text-xs text-slate-600"
                        value={p.status}
                        onChange={e => moveStatus(p.id, e.target.value)}
                      >
                        {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                        <option value="rejected">不採択</option>
                        <option value="completed">完了</option>
                      </select>
                    </div>
                  </div>
                ))}
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
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">顧客 *</label>
              <select name="customer_id" required className="input">
                <option value="">選択してください</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>
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
