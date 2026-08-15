'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Modal } from '@/components/Modal'
import {
  fetchPartnerAgencies, insertPartnerAgency, updatePartnerAgency, deletePartnerAgency,
  type DbPartnerAgency,
} from '@/lib/db'

const SOURCE_LABEL: Record<DbPartnerAgency['source'], string> = {
  form: 'フォーム回答',
  manual: '手動登録',
  legacy_sheet: '既存リスト',
}
const SOURCE_BADGE: Record<DbPartnerAgency['source'], string> = {
  form: 'bg-brand-50 text-brand-700',
  manual: 'bg-slate-100 text-slate-600',
  legacy_sheet: 'bg-amber-50 text-amber-700',
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function AgenciesPage() {
  const [agencies, setAgencies] = useState<DbPartnerAgency[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [query,    setQuery]    = useState('')

  const [addOpen, setAddOpen] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [detail,  setDetail]  = useState<DbPartnerAgency | null>(null)

  const [syncing, setSyncing] = useState(false)
  const [syncMsg,  setSyncMsg] = useState('')

  const load = () => {
    fetchPartnerAgencies()
      .then(setAgencies)
      .catch(() => setError('代理店一覧の取得に失敗しました'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return agencies
    return agencies.filter(a =>
      a.company_name.toLowerCase().includes(q) ||
      (a.contact_person ?? '').toLowerCase().includes(q))
  }, [agencies, query])

  const handleSync = async () => {
    setSyncing(true)
    setSyncMsg('')
    try {
      const res = await fetch('/api/cron/sync-agencies', { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error ?? 'sync failed')
      setSyncMsg(body.imported > 0 ? `フォームから新規 ${body.imported} 件を取り込みました` : '新しい回答はありませんでした')
      load()
    } catch {
      setSyncMsg('同期に失敗しました')
    } finally {
      setSyncing(false)
    }
  }

  const handleAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    const f = new FormData(e.currentTarget)
    try {
      await insertPartnerAgency({
        company_name:   (f.get('company_name') as string).trim(),
        contact_person: (f.get('contact_person') as string)?.trim() || null,
        email:          (f.get('email') as string)?.trim() || null,
        phone:          (f.get('phone') as string)?.trim() || null,
        hp_url:         (f.get('hp_url') as string)?.trim() || null,
        address:        (f.get('address') as string)?.trim() || null,
        note:           (f.get('note') as string)?.trim() || null,
      })
      setAddOpen(false)
      load()
    } catch {
      setError('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader title="代理店登録管理表" description="募集フォームの回答を自動取込み、手動でも追加できる代理店の一覧です">
        <div className="flex gap-2">
          <button onClick={handleSync} disabled={syncing} className="btn-secondary text-sm">
            {syncing ? '同期中...' : '📥 フォームと今すぐ同期'}
          </button>
          <button className="btn-primary text-sm" onClick={() => setAddOpen(true)}>+ 代理店を追加</button>
        </div>
      </PageHeader>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}
      {syncMsg && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700">{syncMsg}</div>
      )}

      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="会社名・担当者名で検索"
        className="input sm:max-w-xs"
      />

      <div className="flex flex-col gap-2.5">
        {loading && <p className="p-12 text-center text-sm text-slate-400">読み込み中...</p>}

        {!loading && filtered.map(a => (
          <button
            key={a.id}
            onClick={() => setDetail(a)}
            className="card flex items-start gap-4 p-4 text-left transition-shadow hover:shadow-md"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`badge text-xs ${SOURCE_BADGE[a.source]}`}>{SOURCE_LABEL[a.source]}</span>
                <p className="text-sm font-semibold text-slate-900">{a.company_name}</p>
                {a.contact_person && <span className="text-xs text-slate-500">{a.contact_person}</span>}
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                {[a.email, a.phone, a.hp_url].filter(Boolean).join(' ・ ') || '連絡先未登録'}
              </p>
              <p className="mt-1.5 text-xs text-slate-400">
                {formatDate(a.updated_at)} 更新{a.editor ? ` · ${a.editor.full_name}` : ''}
              </p>
            </div>
          </button>
        ))}

        {!loading && filtered.length === 0 && (
          <div className="card p-12 text-center text-sm text-slate-400">
            {agencies.length === 0
              ? <>まだ代理店が登録されていません。「フォームと今すぐ同期」または「＋代理店を追加」から。</>
              : <>該当する代理店が見つかりませんでした。</>}
          </div>
        )}
      </div>

      {/* 追加モーダル */}
      <Modal title="代理店を追加" open={addOpen} onClose={() => setAddOpen(false)}>
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">会社名 *</label>
            <input name="company_name" required className="input" placeholder="株式会社〇〇" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">担当者名</label>
            <input name="contact_person" className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">メール</label>
              <input name="email" type="email" className="input" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">電話番号</label>
              <input name="phone" className="input" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">ホームページURL</label>
            <input name="hp_url" className="input" placeholder="https://" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">住所</label>
            <input name="address" className="input" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">メモ</label>
            <textarea name="note" rows={3} className="input resize-y" />
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" className="btn-secondary text-sm" onClick={() => setAddOpen(false)}>キャンセル</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm">{saving ? '保存中...' : '保存'}</button>
          </div>
        </form>
      </Modal>

      {/* 詳細・編集モーダル */}
      {detail && (
        <DetailModal
          agency={detail}
          onClose={() => setDetail(null)}
          onSaved={() => { setDetail(null); load() }}
        />
      )}
    </div>
  )
}

// フォーム回答由来のデータを、ラベル付きで読みやすく表示する
const FORM_DETAIL_FIELDS: Array<[keyof DbPartnerAgency, string]> = [
  ['business_description', '主な事業内容'],
  ['customer_count', '顧客数'],
  ['sales_staff_count', '営業担当スタッフ人数'],
  ['customer_industries', 'お客様の業界'],
  ['customer_regions', 'お客様の主な所在地'],
  ['desired_collaboration', '取り組みたい内容'],
  ['desired_support', 'ご希望のフォロー体制'],
  ['seminar_cooperation', 'セミナー開催時の協力'],
  ['seminar_reachable_count', 'セミナー案内が可能な数'],
  ['annual_referral_estimate', '年間紹介見込み件数'],
  ['has_current_prospects', '現在提案可能な顧客の有無'],
  ['target_customer_profile', '紹介を想定しているお客様像'],
  ['meeting_notes', '打ち合わせ候補日・その他要望'],
  ['info_delivery_method', '補助金のご案内方法'],
]

function DetailModal({ agency, onClose, onSaved }: {
  agency: DbPartnerAgency
  onClose: () => void
  onSaved: () => void
}) {
  const [companyName,    setCompanyName]    = useState(agency.company_name)
  const [contactPerson,  setContactPerson]  = useState(agency.contact_person ?? '')
  const [email,          setEmail]          = useState(agency.email ?? '')
  const [phone,          setPhone]          = useState(agency.phone ?? '')
  const [hpUrl,          setHpUrl]          = useState(agency.hp_url ?? '')
  const [address,        setAddress]        = useState(agency.address ?? '')
  const [note,           setNote]           = useState(agency.note ?? '')
  const [busy, setBusy] = useState(false)
  const [err,  setErr]  = useState('')

  const formDetails = FORM_DETAIL_FIELDS
    .map(([key, label]) => [label, agency[key] as string | null] as const)
    .filter(([, value]) => !!value)

  const save = async () => {
    setBusy(true)
    setErr('')
    try {
      await updatePartnerAgency(agency.id, {
        company_name: companyName.trim(),
        contact_person: contactPerson.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        hp_url: hpUrl.trim() || null,
        address: address.trim() || null,
        note: note.trim() || null,
      })
      onSaved()
    } catch {
      setErr('保存に失敗しました')
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!confirm('この代理店を削除しますか？')) return
    setBusy(true)
    try {
      await deletePartnerAgency(agency.id)
      onSaved()
    } catch {
      setErr('削除に失敗しました')
      setBusy(false)
    }
  }

  return (
    <Modal title="代理店の詳細" open onClose={onClose}>
      <div className="max-h-[75vh] space-y-4 overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">会社名</label>
            <input value={companyName} onChange={e => setCompanyName(e.target.value)} className="input" />
          </div>
          <div className="col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">担当者名</label>
            <input value={contactPerson} onChange={e => setContactPerson(e.target.value)} className="input" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">メール</label>
            <input value={email} onChange={e => setEmail(e.target.value)} className="input" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">電話番号</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} className="input" />
          </div>
          <div className="col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">ホームページURL</label>
            <input value={hpUrl} onChange={e => setHpUrl(e.target.value)} className="input" />
          </div>
          <div className="col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">住所</label>
            <input value={address} onChange={e => setAddress(e.target.value)} className="input" />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">メモ</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} className="input resize-y" />
        </div>

        {formDetails.length > 0 && (
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="mb-3 text-xs font-semibold text-slate-500">フォーム回答内容（参考・編集不可）</p>
            <dl className="space-y-2.5">
              {formDetails.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-medium text-slate-500">{label}</dt>
                  <dd className="text-sm text-slate-800">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <p className="text-xs text-slate-400">
          {SOURCE_LABEL[agency.source]}
          {agency.author ? ` · 登録: ${agency.author.full_name}` : ''}
          {agency.editor ? ` · 最終更新: ${agency.editor.full_name}` : ''}
        </p>

        {err && <p className="text-sm text-rose-600">{err}</p>}

        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <button onClick={remove} disabled={busy} className="text-sm text-rose-500 hover:text-rose-600">削除</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary text-sm">閉じる</button>
            <button onClick={save} disabled={busy} className="btn-primary text-sm">{busy ? '保存中...' : '保存'}</button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
