'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { fetchBasicInfo, saveBasicInfo, type JizokukaBasicInfo } from '@/lib/jizokuka/db'
import { StepNav } from '@/components/jizokuka/step-nav'
// Salud本体の顧客管理データを読むためだけの依存（自動反映の利便性のため）。
// 書き込みは行わず、選んだ時点の値をこのケース独自のフォームへコピーするだけなので、
// jizokuka側のデータは引き続きこのテーブル単体で完結する。
import { fetchCustomers, type DbCustomer } from '@/lib/db'

type FormState = Record<keyof Omit<JizokukaBasicInfo, 'case_id'>, string>

const FIELD_KEYS = [
  'project_start_method', 'project_end_date', 'has_project_income', 'income_detail',
  'invoice_exception', 'wage_increase_exception', 'referred_chamber', 'chamber_membership',
  'postal_code', 'prefecture', 'city', 'address_detail', 'corporate_number', 'company_name_kana',
  'business_form', 'tax_status', 'representative_title', 'representative_birthdate',
  'representative_phone', 'company_phone', 'invoice_registration_number', 'website_url',
  'industry_category', 'capital_amount', 'established_date', 'office_count',
  'business_location_postal', 'business_location_address', 'gross_profit_recent',
  'operating_profit_recent', 'contact_last_name', 'contact_first_name', 'contact_title',
  'contact_phone', 'contact_mobile', 'contact_email', 'advice_from_other', 'advice_amount',
  'advice_provider', 'past_adoption_summary', 'priority_policy_points', 'policy_points',
] as const

function toFormState(info: JizokukaBasicInfo): FormState {
  const state = {} as FormState
  for (const key of FIELD_KEYS) {
    const value = info[key]
    state[key] = value === null || value === undefined ? '' : String(value)
  }
  return state
}

const BOOLEAN_KEYS = new Set(['has_project_income', 'advice_from_other'])
const NUMBER_KEYS = new Set(['capital_amount', 'office_count', 'gross_profit_recent', 'operating_profit_recent', 'advice_amount'])
const DATE_KEYS = new Set(['project_end_date', 'representative_birthdate', 'established_date'])

function Field({ label, value, onChange, type = 'text' }: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <input className="input" type={type} value={value} onChange={ev => onChange(ev.target.value)} />
    </div>
  )
}

function Select({ label, value, onChange, options }: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <select className="input" value={value} onChange={ev => onChange(ev.target.value)}>
        <option value="">未選択</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

export default function BasicInfoPage() {
  const { caseId } = useParams<{ caseId: string }>()
  const [form, setForm] = useState<FormState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [customers, setCustomers] = useState<DbCustomer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')

  useEffect(() => {
    fetchBasicInfo(caseId).then(info => setForm(toFormState(info))).finally(() => setLoading(false))
    fetchCustomers().then(setCustomers).catch(() => {})
  }, [caseId])

  const set = (key: keyof FormState) => (v: string) => setForm(f => (f ? { ...f, [key]: v } : f))

  const applyCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId)
    const customer = customers.find(c => c.id === customerId)
    if (!customer) return
    const primaryContact = customer.customer_contacts.find(c => c.is_primary) ?? customer.customer_contacts[0]
    const [contactLast, ...contactFirstParts] = (primaryContact?.name ?? '').split(/\s+/)
    setForm(f => (f ? {
      ...f,
      company_name_kana: customer.company_name_kana || f.company_name_kana,
      industry_category: customer.industry || f.industry_category,
      website_url: customer.website || f.website_url,
      company_phone: customer.phone || f.company_phone,
      address_detail: customer.address || f.address_detail,
      contact_last_name: contactLast || f.contact_last_name,
      contact_first_name: contactFirstParts.join(' ') || f.contact_first_name,
      contact_title: primaryContact?.title || f.contact_title,
      contact_phone: primaryContact?.phone || f.contact_phone,
      contact_email: primaryContact?.email || f.contact_email,
    } : f))
  }

  const persist = async () => {
    if (!form) return
    const payload: Record<string, string | number | boolean | null> = {}
    for (const key of FIELD_KEYS) {
      const raw = form[key]
      if (raw === '') { payload[key] = null; continue }
      if (BOOLEAN_KEYS.has(key)) payload[key] = raw === 'true'
      else if (NUMBER_KEYS.has(key)) payload[key] = Number(raw)
      else payload[key] = raw
    }
    await saveBasicInfo(caseId, payload)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await persist()
      setSavedAt(new Date())
    } catch (e) {
      alert(`保存に失敗しました: ${e instanceof Error ? e.message : e}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading || !form) return <div className="p-6 text-slate-400">読み込み中…</div>

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        title="基本情報（会社登記情報・応募者概要）"
        description="電子申請ポータルの「申請情報」「基本情報」「応募者の概要」「確認事項」「特例」入力にそのまま転記できる項目です"
      >
        <StepNav caseId={caseId} step="basic-info" onSave={persist} />
      </PageHeader>

      <div className="card flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">顧客管理から自動反映</h3>
          <p className="text-xs text-slate-500">選択すると、会社名カナ・業種・電話番号・住所・担当者情報を下のフォームにコピーします（その後は自由に編集できます）</p>
        </div>
        <select
          className="input sm:w-72"
          value={selectedCustomerId}
          onChange={ev => applyCustomer(ev.target.value)}
        >
          <option value="">顧客を選択…</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
        </select>
      </div>

      <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <h3 className="text-sm font-bold text-slate-900 sm:col-span-2">申請情報</h3>
        <Field label="事業開始日の決定方法" value={form.project_start_method} onChange={set('project_start_method')} />
        <Field label="事業終了日（公募・交付申請時）" type="date" value={form.project_end_date} onChange={set('project_end_date')} />
        <Select label="補助事業に関して生ずる収入金" value={form.has_project_income} onChange={set('has_project_income')}
          options={[{ value: 'true', label: '収入金有り' }, { value: 'false', label: '収入金無し' }]} />
        <Field label="収入の内容" value={form.income_detail} onChange={set('income_detail')} />
        <Select label="インボイス特例の希望" value={form.invoice_exception} onChange={set('invoice_exception')}
          options={[
            { value: '希望しない', label: '希望しない' },
            { value: '希望する（補助上限+50万円）', label: '希望する（補助上限+50万円）' },
          ]} />
        <Select label="賃金引上げ特例の希望" value={form.wage_increase_exception} onChange={set('wage_increase_exception')}
          options={[
            { value: '希望しない', label: '希望しない' },
            { value: '希望する（補助上限+50万円）', label: '希望する（補助上限+50万円）' },
            { value: '希望する（赤字事業者、補助上限+150万円、補助率3/4に引き上げ）', label: '希望する（赤字事業者、補助上限+150万円、補助率3/4に引き上げ）' },
          ]} />
        <Field label="依頼する商工会議所" value={form.referred_chamber} onChange={set('referred_chamber')} />
        <Select label="会員/非会員の選択" value={form.chamber_membership} onChange={set('chamber_membership')}
          options={[{ value: 'はい', label: '会員' }, { value: 'いいえ', label: '非会員' }]} />
      </div>

      <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <h3 className="text-sm font-bold text-slate-900 sm:col-span-2">基本情報（会社登記情報）</h3>
        <Field label="本社郵便番号" value={form.postal_code} onChange={set('postal_code')} />
        <Field label="本社所在地（都道府県）" value={form.prefecture} onChange={set('prefecture')} />
        <Field label="本社所在地（市区町村）" value={form.city} onChange={set('city')} />
        <Field label="本社所在地（番地・建物名等）" value={form.address_detail} onChange={set('address_detail')} />
        <Field label="法人番号/事業者識別番号" value={form.corporate_number} onChange={set('corporate_number')} />
        <Field label="法人名/屋号（カナ）" value={form.company_name_kana} onChange={set('company_name_kana')} />
        <Select label="事業形態" value={form.business_form} onChange={set('business_form')}
          options={[{ value: '法人', label: '法人' }, { value: '個人事業主', label: '個人事業主' }]} />
        <Field label="消費税の適用に関する事項" value={form.tax_status} onChange={set('tax_status')} />
        <Field label="代表者役職" value={form.representative_title} onChange={set('representative_title')} />
        <Field label="代表者生年月日" type="date" value={form.representative_birthdate} onChange={set('representative_birthdate')} />
        <Field label="代表者電話番号" value={form.representative_phone} onChange={set('representative_phone')} />
        <Field label="会社代表電話番号" value={form.company_phone} onChange={set('company_phone')} />
        <Field label="適格請求書発行事業者の登録番号" value={form.invoice_registration_number} onChange={set('invoice_registration_number')} />
      </div>

      <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <h3 className="text-sm font-bold text-slate-900 sm:col-span-2">応募者の概要（様式2）</h3>
        <Field label="自社ホームページのURL" value={form.website_url} onChange={set('website_url')} />
        <Field label="業種（日本標準産業分類）" value={form.industry_category} onChange={set('industry_category')} />
        <Field label="資本金額（円）" type="number" value={form.capital_amount} onChange={set('capital_amount')} />
        <Field label="設立年月日" type="date" value={form.established_date} onChange={set('established_date')} />
        <Field label="事業所数" type="number" value={form.office_count} onChange={set('office_count')} />
        <Field label="事業実施場所の郵便番号" value={form.business_location_postal} onChange={set('business_location_postal')} />
        <Field label="事業実施場所の住所" value={form.business_location_address} onChange={set('business_location_address')} />
        <Field label="直近1期の売上総利益（円）" type="number" value={form.gross_profit_recent} onChange={set('gross_profit_recent')} />
        <Field label="直近1期の経常利益（円）" type="number" value={form.operating_profit_recent} onChange={set('operating_profit_recent')} />
        <Field label="担当者（姓）" value={form.contact_last_name} onChange={set('contact_last_name')} />
        <Field label="担当者（名）" value={form.contact_first_name} onChange={set('contact_first_name')} />
        <Field label="担当者 役職名" value={form.contact_title} onChange={set('contact_title')} />
        <Field label="担当者 連絡先電話番号" value={form.contact_phone} onChange={set('contact_phone')} />
        <Field label="担当者 携帯電話番号" value={form.contact_mobile} onChange={set('contact_mobile')} />
        <Field label="担当者メールアドレス" type="email" value={form.contact_email} onChange={set('contact_email')} />
      </div>

      <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <h3 className="text-sm font-bold text-slate-900 sm:col-span-2">確認事項・希望する特例（様式2）</h3>
        <Select label="商工会・商工会議所以外からのアドバイスの有無" value={form.advice_from_other} onChange={set('advice_from_other')}
          options={[{ value: 'true', label: 'はい' }, { value: 'false', label: 'いいえ' }]} />
        <Field label="アドバイス料の金額（円）" type="number" value={form.advice_amount} onChange={set('advice_amount')} />
        <Field label="アドバイスをした第3者の名称" value={form.advice_provider} onChange={set('advice_provider')} />
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-slate-700">過去の補助事業の販路開拓先・方法・成果との違い</label>
          <textarea className="input min-h-24" value={form.past_adoption_summary} onChange={ev => set('past_adoption_summary')(ev.target.value)} />
        </div>
        <Field label="重点政策加点" value={form.priority_policy_points} onChange={set('priority_policy_points')} />
        <Field label="政策加点" value={form.policy_points} onChange={set('policy_points')} />
      </div>

      <div className="flex items-center justify-end gap-3">
        {savedAt && !saving && (
          <span className="text-xs text-slate-400">{savedAt.toLocaleTimeString('ja-JP')} に保存しました</span>
        )}
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? '保存中…' : '保存'}
        </button>
      </div>
    </div>
  )
}
