'use client'

import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Modal } from '@/components/Modal'
import { fetchCustomers, insertCustomer, insertLeadCustomer, type DbCustomer } from '@/lib/db'
import { parseHojokinAppLeadText } from '@/lib/hojokin-app-lead-parser'

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
  const [leadModalOpen, setLeadModalOpen] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [leadResult, setLeadResult] = useState('')
  const [leadPaste, setLeadPaste] = useState('')
  const leadFormRef = useRef<HTMLFormElement>(null)

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
        address:        f.get('address') as string,
      })
      setModalOpen(false)
      load()
    } catch {
      setError('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  // hojokin-app画面からのコピペを各項目に振り分ける（貼り付け時に自動実行）
  const handleLeadPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text')
    setLeadPaste(text)
    applyParsedLead(text)
  }

  const applyParsedLead = (text: string) => {
    const parsed = parseHojokinAppLeadText(text)
    const form = leadFormRef.current
    if (!form) return
    const setVal = (name: string, value: string) => {
      const el = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null
      if (el) el.value = value
    }
    if (parsed.companyName) setVal('company_name', parsed.companyName)
    setVal('contact_name', parsed.contactName ?? '')
    setVal('email', parsed.email ?? '')
    setVal('phone', parsed.phone ?? '')
    setVal('industry', parsed.industry ?? '')
    setVal('employee_count', parsed.employeeCount != null ? String(parsed.employeeCount) : '')
    setVal('address', parsed.address ?? '')
    setVal('notes', parsed.notes)
    setVal('selected_subsidy_name', parsed.selectedSubsidyName ?? '')
    setVal('lead_registered_at', parsed.registeredAtLocal ?? '')
    const agencyEl = form.elements.namedItem('via_agency') as HTMLInputElement | null
    if (agencyEl) agencyEl.checked = parsed.viaAgency
  }

  const handleLeadSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const company_name = (f.get('company_name') as string)?.trim()
    if (!company_name) {
      setError('会社名を確認できませんでした。貼り付け内容に会社名が含まれているか、手動で入力してください')
      return
    }
    const email = (f.get('email') as string) || null
    const phone = (f.get('phone') as string) || null
    setSaving(true)
    setError('')
    try {
      const { wasUpdate } = await insertLeadCustomer({
        external_lead_id:      `hojokin_app:${(email ?? phone ?? company_name).trim()}`,
        lead_source:           'hojokin_app',
        company_name,
        contact_name:          f.get('contact_name') as string,
        email,
        phone,
        industry:              (f.get('industry') as string) || null,
        employee_count:        f.get('employee_count') ? Number(f.get('employee_count')) : null,
        address:               (f.get('address') as string) || null,
        notes:                 (f.get('notes') as string) || null,
        selected_subsidy_name: (f.get('selected_subsidy_name') as string) || null,
        matching_score:        null,
        matching_reason:       null,
        via_agency:            f.get('via_agency') === 'on',
        lead_registered_at:    (f.get('lead_registered_at') as string) || null,
      })
      setLeadModalOpen(false)
      setLeadPaste('')
      setLeadResult(wasUpdate ? '既存のリード（同じ会社/メール）を更新しました' : 'リードを新規登録しました')
      load()
    } catch {
      setError('リードの取り込みに失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader title="顧客管理" description={`全 ${customers.length} 社`}>
        <button className="btn-secondary text-sm" onClick={() => setLeadModalOpen(true)}>+ リードを取り込む</button>
        <button className="btn-primary text-sm" onClick={() => setModalOpen(true)}>+ 顧客を追加</button>
      </PageHeader>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}
      {leadResult && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {leadResult}
          <button className="text-xs text-emerald-600 hover:underline" onClick={() => setLeadResult('')}>閉じる</button>
        </div>
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

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <label className="mb-1.5 block text-sm font-medium text-slate-700">住所</label>
            <input name="address" className="input" placeholder="東京都渋谷区..." />
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

      <Modal title="hojokin-appからリードを取り込む" open={leadModalOpen} onClose={() => setLeadModalOpen(false)}>
        <form ref={leadFormRef} onSubmit={handleLeadSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              hojokin-appのリード詳細画面を選択してコピーし、ここに貼り付け
            </label>
            <textarea
              rows={6}
              className="input font-mono text-xs"
              placeholder="hojokin-appのリード詳細ページで会社名〜企業情報までをドラッグ選択してコピーし（Ctrl+C）、ここに貼り付けてください（Ctrl+V）。貼り付けた瞬間に下の項目が自動入力されます。"
              value={leadPaste}
              onChange={e => setLeadPaste(e.target.value)}
              onPaste={handleLeadPaste}
            />
            <button
              type="button"
              className="mt-1.5 text-xs font-medium text-brand-600 hover:underline"
              onClick={() => applyParsedLead(leadPaste)}
            >
              この内容で再解析する
            </button>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="mb-3 text-xs text-slate-500">自動入力された内容です。誤りがあれば修正してください。</p>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">会社名 *</label>
                  <input name="company_name" required className="input" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">担当者名</label>
                  <input name="contact_name" className="input" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">メールアドレス</label>
                  <input name="email" type="email" className="input" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">電話番号</label>
                  <input name="phone" className="input" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">業種</label>
                  <input name="industry" className="input" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">従業員数</label>
                  <input name="employee_count" type="number" className="input" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">所在地</label>
                <input name="address" className="input" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">選定補助金・希望区分</label>
                <input name="selected_subsidy_name" className="input" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">メモ（事業内容・プロジェクト情報など）</label>
                <textarea name="notes" rows={5} className="input font-mono text-xs" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">登録日時（hojokin-app上の登録日時）</label>
                <input name="lead_registered_at" type="datetime-local" className="input" />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input name="via_agency" type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" />
                代理店経由のリード
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" className="btn-secondary text-sm" onClick={() => setLeadModalOpen(false)}>キャンセル</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm">
              {saving ? '保存中...' : '取り込む'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
