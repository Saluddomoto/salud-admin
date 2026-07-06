'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Modal } from '@/components/Modal'
import { fetchCustomers, insertCustomer, type DbCustomer } from '@/lib/db'

const STATUS_LABELS = {
  active:   { label: '契約中', cls: 'bg-emerald-100 text-emerald-700' },
  prospect: { label: '見込み', cls: 'bg-amber-100 text-amber-700' },
  inactive: { label: '休眠',   cls: 'bg-slate-100 text-slate-500' },
} as const

export default function CustomersPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<DbCustomer[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [industry,  setIndustry]  = useState('')
  const [status,    setStatus]    = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  const load = () => {
    fetchCustomers()
      .then(setCustomers)
      .catch(() => setError('データの取得に失敗しました'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const industries = [...new Set(customers.map(c => c.industry).filter(Boolean))] as string[]

  const filtered = customers.filter(c => {
    const contact = c.customer_contacts.find(x => x.is_primary)?.name ?? ''
    if (search && !`${c.company_name}${contact}`.includes(search)) return false
    if (industry && c.industry !== industry) return false
    if (status && c.status !== status) return false
    return true
  })

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const f = new FormData(e.currentTarget)
    try {
      await insertCustomer({
        company_name:   f.get('company_name') as string,
        contact_name:   f.get('contact_name') as string,
        industry:       f.get('industry') as string,
        employee_count: f.get('employee_count') ? Number(f.get('employee_count')) : null,
        status:         f.get('status') as string,
        phone:          f.get('phone') as string,
      })
      setModalOpen(false)
      load()
    } catch {
      setError('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="顧客管理" description={`全 ${customers.length} 社`}>
        <button className="btn-primary text-sm" onClick={() => setModalOpen(true)}>+ 顧客を追加</button>
      </PageHeader>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      <div className="card flex flex-wrap items-center gap-3 p-4">
        <input className="input max-w-xs" placeholder="会社名・担当者名で検索"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input w-40" value={industry} onChange={e => setIndustry(e.target.value)}>
          <option value="">全業種</option>
          {industries.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
        <select className="input w-40" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">全ステータス</option>
          <option value="active">契約中</option>
          <option value="prospect">見込み</option>
          <option value="inactive">休眠</option>
        </select>
        <span className="ml-auto text-sm text-slate-500">{filtered.length} 件</span>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-3 font-medium">会社名</th>
              <th className="px-4 py-3 font-medium">担当者</th>
              <th className="px-4 py-3 font-medium">業種</th>
              <th className="px-4 py-3 font-medium">従業員数</th>
              <th className="px-4 py-3 font-medium">ステータス</th>
              <th className="px-4 py-3 font-medium">社内担当</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">読み込み中...</td></tr>
            )}
            {!loading && filtered.map(c => {
              const st = STATUS_LABELS[c.status]
              const contact = c.customer_contacts.find(x => x.is_primary)?.name ?? '—'
              return (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/customers/${c.id}`)}
                  className="cursor-pointer border-b border-slate-50 transition-colors hover:bg-slate-50/60"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{c.company_name}</p>
                    <p className="text-xs text-slate-400">{c.phone ?? ''}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{contact}</td>
                  <td className="px-4 py-3 text-slate-700">{c.industry ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-700">{c.employee_count ? `${c.employee_count}名` : '—'}</td>
                  <td className="px-4 py-3"><span className={`badge ${st.cls}`}>{st.label}</span></td>
                  <td className="px-4 py-3 text-slate-700">{c.profiles?.full_name ?? '—'}</td>
                </tr>
              )
            })}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                顧客がまだ登録されていません。「+ 顧客を追加」から登録してください。
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal title="顧客を追加" open={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">会社名 *</label>
            <input name="company_name" required className="input" placeholder="株式会社〇〇" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">担当者名</label>
              <input name="contact_name" className="input" placeholder="山田 太郎" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">電話番号</label>
              <input name="phone" className="input" placeholder="03-1234-5678" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">業種</label>
              <input name="industry" className="input" placeholder="製造業" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">従業員数</label>
              <input name="employee_count" type="number" className="input" placeholder="30" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">ステータス</label>
            <select name="status" className="input" defaultValue="prospect">
              <option value="prospect">見込み</option>
              <option value="active">契約中</option>
              <option value="inactive">休眠</option>
            </select>
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
