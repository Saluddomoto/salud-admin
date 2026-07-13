'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Modal } from '@/components/Modal'
import { DocumentsCard } from '@/components/DocumentsCard'
import {
  deleteContact, deleteCustomer, fetchCustomer, fetchProjectsByCustomer,
  insertContact, updateCustomer, formatAmount,
  type DbCustomer, type DbProject,
} from '@/lib/db'

const STATUS_LABELS = {
  active:   { label: '契約中', cls: 'bg-emerald-100 text-emerald-700' },
  prospect: { label: '見込み', cls: 'bg-amber-100 text-amber-700' },
  inactive: { label: '休眠',   cls: 'bg-slate-100 text-slate-500' },
} as const

const PROJECT_STATUS: Record<DbProject['status'], { label: string; cls: string }> = {
  planning:    { label: '準備中',     cls: 'bg-slate-100 text-slate-600' },
  in_progress: { label: '申請準備中', cls: 'bg-amber-100 text-amber-700' },
  submitted:   { label: '申請済み',   cls: 'bg-indigo-100 text-indigo-700' },
  accepted:    { label: '採択',       cls: 'bg-emerald-100 text-emerald-700' },
  rejected:    { label: '不採択',     cls: 'bg-rose-100 text-rose-700' },
  completed:   { label: '完了',       cls: 'bg-slate-100 text-slate-500' },
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [customer, setCustomer] = useState<DbCustomer | null>(null)
  const [projects, setProjects] = useState<DbProject[]>([])
  const [loading,  setLoading]  = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error,    setError]    = useState('')
  const [editOpen,    setEditOpen]    = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const [saving,      setSaving]      = useState(false)

  const load = useCallback(() => {
    Promise.all([fetchCustomer(id), fetchProjectsByCustomer(id)])
      .then(([c, p]) => {
        if (!c) setNotFound(true)
        setCustomer(c)
        setProjects(p)
      })
      .catch(() => setError('データの取得に失敗しました'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(load, [load])

  const handleUpdate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const f = new FormData(e.currentTarget)
    try {
      await updateCustomer(id, {
        company_name:   f.get('company_name') as string,
        industry:       (f.get('industry') as string) || null,
        employee_count: f.get('employee_count') ? Number(f.get('employee_count')) : null,
        status:         f.get('status') as string,
        phone:          (f.get('phone') as string) || null,
        address:        (f.get('address') as string) || null,
        website:        (f.get('website') as string) || null,
        notes:          (f.get('notes') as string) || null,
      })
      setEditOpen(false)
      load()
    } catch {
      setError('保存に失敗しました（権限がない可能性があります）')
    } finally {
      setSaving(false)
    }
  }

  const handleAddContact = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const f = new FormData(e.currentTarget)
    try {
      await insertContact(id, {
        name:       f.get('name') as string,
        title:      (f.get('title') as string) || null,
        email:      (f.get('email') as string) || null,
        phone:      (f.get('phone') as string) || null,
        is_primary: f.get('is_primary') === 'on',
      })
      setContactOpen(false)
      load()
    } catch {
      setError('担当者の追加に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm('この担当者を削除しますか？')) return
    try {
      await deleteContact(contactId)
      load()
    } catch {
      setError('担当者の削除に失敗しました')
    }
  }

  const handleDelete = async () => {
    if (!confirm(`「${customer?.company_name}」を削除しますか？\n紐づく案件 ${projects.length} 件もすべて削除されます。この操作は取り消せません。`)) return
    try {
      await deleteCustomer(id)
      router.push('/customers')
    } catch {
      setError('削除に失敗しました（権限がない可能性があります）')
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-400">読み込み中...</div>
  }

  if (notFound || !customer) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <p className="text-sm text-slate-500">顧客が見つかりませんでした（削除されたか、閲覧権限がありません）。</p>
        <Link href="/customers" className="text-sm font-medium text-brand-600 hover:underline">← 顧客一覧へ戻る</Link>
      </div>
    )
  }

  const st = STATUS_LABELS[customer.status]

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div>
        <Link href="/customers" className="text-xs font-medium text-slate-400 hover:text-brand-600">← 顧客一覧</Link>
        <div className="mt-1">
          <PageHeader
            title={customer.company_name}
            description={customer.company_name_kana || ' '}
          >
            <span className={`badge ${st.cls}`}>{st.label}</span>
            <button className="btn-secondary text-sm" onClick={() => setEditOpen(true)}>編集</button>
            <button
              className="rounded-xl border border-rose-200 px-3.5 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50"
              onClick={handleDelete}
            >
              削除
            </button>
          </PageHeader>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 基本情報 */}
        <div className="card p-5">
          <h3 className="mb-4 font-semibold text-slate-900">基本情報</h3>
          <dl className="space-y-3 text-sm">
            {[
              { label: '業種',     value: customer.industry ?? '—' },
              { label: '従業員数', value: customer.employee_count ? `${customer.employee_count}名` : '—' },
              { label: '電話番号', value: customer.phone ?? '—' },
              { label: '住所',     value: customer.address ?? '—' },
              { label: 'Web',      value: customer.website ?? '—' },
              { label: '社内担当', value: customer.profiles?.full_name ?? '—' },
              { label: '登録日',   value: customer.created_at.slice(0, 10) },
            ].map(row => (
              <div key={row.label} className="flex gap-3">
                <dt className="w-20 flex-shrink-0 text-slate-400">{row.label}</dt>
                <dd className="min-w-0 break-words text-slate-700">{row.value}</dd>
              </div>
            ))}
          </dl>
          {customer.notes && (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="mb-1 text-xs text-slate-400">メモ</p>
              <p className="whitespace-pre-wrap text-sm text-slate-600">{customer.notes}</p>
            </div>
          )}
        </div>

        {/* 担当者 */}
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">先方担当者</h3>
            <button className="text-xs font-medium text-brand-600 hover:underline" onClick={() => setContactOpen(true)}>
              + 追加
            </button>
          </div>
          <div className="space-y-3">
            {customer.customer_contacts.map(c => (
              <div key={c.id} className="group flex items-start gap-3">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                  {c.name[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">
                    {c.name}
                    {c.is_primary && <span className="badge ml-2 bg-brand-100 text-[10px] text-brand-700">主担当</span>}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {[c.title, c.email, c.phone].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                <button
                  className="invisible text-xs text-slate-400 hover:text-rose-600 group-hover:visible"
                  onClick={() => handleDeleteContact(c.id)}
                >
                  削除
                </button>
              </div>
            ))}
            {customer.customer_contacts.length === 0 && (
              <p className="py-6 text-center text-xs text-slate-400">担当者が登録されていません</p>
            )}
          </div>
        </div>

        {/* 案件 */}
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">案件（{projects.length}件）</h3>
            <Link href="/projects" className="text-xs font-medium text-brand-600 hover:underline">案件管理へ</Link>
          </div>
          <div className="space-y-2">
            {projects.map(p => {
              const ps = PROJECT_STATUS[p.status]
              return (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="block rounded-xl border border-slate-100 p-3 transition-colors hover:bg-slate-50"
                >
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{p.title}</p>
                    <span className={`badge flex-shrink-0 text-xs ${ps.cls}`}>{ps.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {formatAmount(p.applied_amount)} · 期限 {p.deadline ?? '—'}
                  </p>
                </Link>
              )
            })}
            {projects.length === 0 && (
              <p className="py-6 text-center text-xs text-slate-400">案件はまだありません</p>
            )}
          </div>
        </div>

        {/* 資料 */}
        <DocumentsCard parent={{ customerId: id }} />
      </div>

      {/* 編集モーダル */}
      <Modal title="顧客情報を編集" open={editOpen} onClose={() => setEditOpen(false)}>
        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">会社名 *</label>
            <input name="company_name" required className="input" defaultValue={customer.company_name} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">業種</label>
              <input name="industry" className="input" defaultValue={customer.industry ?? ''} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">従業員数</label>
              <input name="employee_count" type="number" className="input" defaultValue={customer.employee_count ?? ''} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">電話番号</label>
              <input name="phone" className="input" defaultValue={customer.phone ?? ''} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">ステータス</label>
              <select name="status" className="input" defaultValue={customer.status}>
                <option value="prospect">見込み</option>
                <option value="active">契約中</option>
                <option value="inactive">休眠</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">住所</label>
            <input name="address" className="input" defaultValue={customer.address ?? ''} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Webサイト</label>
            <input name="website" className="input" defaultValue={customer.website ?? ''} placeholder="https://" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">メモ</label>
            <textarea name="notes" rows={3} className="input" defaultValue={customer.notes ?? ''} />
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" className="btn-secondary text-sm" onClick={() => setEditOpen(false)}>キャンセル</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm">
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 担当者追加モーダル */}
      <Modal title="先方担当者を追加" open={contactOpen} onClose={() => setContactOpen(false)}>
        <form onSubmit={handleAddContact} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">氏名 *</label>
              <input name="name" required className="input" placeholder="山田 太郎" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">役職</label>
              <input name="title" className="input" placeholder="代表取締役" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">メール</label>
              <input name="email" type="email" className="input" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">電話番号</label>
              <input name="phone" className="input" />
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input name="is_primary" type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" />
            主担当にする
          </label>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" className="btn-secondary text-sm" onClick={() => setContactOpen(false)}>キャンセル</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm">
              {saving ? '保存中...' : '追加'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
